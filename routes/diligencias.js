const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const mailer = require('../mailer');

// Auth middleware — re-validates user status on every request
function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  const u = db.prepare('SELECT id, rol, activo FROM usuarios WHERE id = ?').get(req.session.userId);
  if (!u || !u.activo) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  next();
}

// Multer — shared storage
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    // La extensión ya pasó por el fileFilter (lista blanca); el nombre no es adivinable.
    cb(null, Date.now() + '-' + require('crypto').randomUUID() + path.extname(file.originalname).toLowerCase());
  }
});

// Para acuses de seguimiento (PDF únicamente)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Extensión y tipo declarado; el contenido se verifica después (verificarContenido).
    if (file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'));
  }
});

// Para documentos adjuntos de la diligencia (PDF, DOC, DOCX, ZIP)
const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);
const ALLOWED_DOC_EXTS = new Set(['.pdf', '.doc', '.docx', '.zip']);
const uploadDocs = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Antes bastaba una de las dos: un .html con tipo application/pdf pasaba y se servía como página.
    if (ALLOWED_DOC_MIMES.has(file.mimetype) && ALLOWED_DOC_EXTS.has(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF, DOC, DOCX o ZIP'));
  }
});

// Generate folio
function generateFolio() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const last = db.prepare('SELECT id FROM diligencias ORDER BY id DESC LIMIT 1').get();
  const seq = String((last ? last.id : 0) + 1).padStart(5, '0');
  return `DIL-${year}${month}-${seq}`;
}

// Área de la coordinación central: sus coordinadores ven TODAS las diligencias.
// Los coordinadores de cualquier otra área quedan acotados a su propia área.
const COORD_AREA_GLOBAL = 'Coordinación de Análisis de Información y Control Documental';

// Helper: get user with role
function getUser(userId) {
  return db.prepare('SELECT id, rol, area FROM usuarios WHERE id = ?').get(userId);
}

// Coordinador acotado a un área específica (no es de la coordinación central)
function isCoordinadorDeArea(user) {
  return user?.rol === 'coordinador' && user.area !== COORD_AREA_GLOBAL;
}

// ¿Puede este usuario ver la diligencia? Mismas reglas que el listado (GET /).
function puedeVerDiligencia(user, d) {
  if (!user || !d) return false;
  if (user.rol === 'notificador') return d.asignado_a === user.id;
  if (user.rol === 'usuario')     return d.creado_por === user.id;
  if (user.rol === 'director')    return d.area_requirente === user.area;
  if (isCoordinadorDeArea(user))  return d.area_requirente === user.area;
  return true; // admin y coordinación central
}

// Carga la diligencia de :id y exige que el usuario pueda verla. Va antes de multer, para no
// escribir en disco archivos de una petición no autorizada.
function exigirDiligencia(req, res, next) {
  const d = db.prepare('SELECT id, creado_por, asignado_a, area_requirente FROM diligencias WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Diligencia no encontrada' });
  if (!puedeVerDiligencia(getUser(req.session.userId), d)) return res.status(403).json({ error: 'Sin acceso a esta diligencia' });
  req.diligencia = d;
  next();
}

// Firma de los primeros bytes según la extensión (el tipo que manda el navegador no es confiable).
const FIRMAS = {
  '.pdf':  [Buffer.from('%PDF-')],
  '.docx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
  '.zip':  [Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from([0x50, 0x4B, 0x05, 0x06])],
  '.doc':  [Buffer.from([0xD0, 0xCF, 0x11, 0xE0])],
};
function contenidoValido(file) {
  const firmas = FIRMAS[path.extname(file.filename).toLowerCase()];
  if (!firmas) return false;
  const buf = Buffer.alloc(8);
  const fd = fs.openSync(file.path, 'r');
  try { fs.readSync(fd, buf, 0, 8, 0); } finally { fs.closeSync(fd); }
  return firmas.some(f => buf.subarray(0, f.length).equals(f));
}
const borrarSubidos = (files = []) => files.forEach(f => fs.unlink(f.path, () => {}));

// Envuelve un middleware de multer para responder 400 en JSON (tipo o tamaño no permitido)
// en lugar de dejar el error al manejador por omisión de Express, que responde HTML con la traza.
const conSubida = (mw) => (req, res, next) => mw(req, res, (err) => {
  if (!err) return next();
  const msg = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo excede el tamaño máximo'
            : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Demasiados archivos'
            : err.message;
  res.status(400).json({ error: msg });
});

// GET /api/uploads/:archivo — sirve un documento o acuse solo a quien puede ver su diligencia.
// (Antes la carpeta se servía como estática, sin sesión.)
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
const TIPOS_SERVIDOS = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.zip': 'application/zip' };
function servirArchivo(req, res) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  const user = db.prepare('SELECT id, rol, area, activo FROM usuarios WHERE id = ?').get(req.session.userId);
  if (!user || !user.activo) return res.status(401).json({ error: 'Sesión inválida' });
  const nombre = path.basename(req.params.archivo); // sin rutas: solo el nombre del archivo
  const ruta = `/uploads/${nombre}`;
  const ref = db.prepare('SELECT diligencia_id, nombre_original FROM documentos WHERE archivo = ?').get(ruta)
           || db.prepare('SELECT diligencia_id, NULL AS nombre_original FROM seguimiento WHERE archivo_acuse = ?').get(ruta);
  const d = ref && db.prepare('SELECT id, creado_por, asignado_a, area_requirente FROM diligencias WHERE id = ?').get(ref.diligencia_id);
  if (!d || !puedeVerDiligencia(user, d)) return res.status(404).json({ error: 'Archivo no disponible' });
  const abs = path.join(UPLOAD_DIR, nombre);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Archivo no disponible' });
  const ext = path.extname(nombre).toLowerCase();
  res.setHeader('Content-Type', TIPOS_SERVIDOS[ext] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Los PDF se abren en el navegador (los enlaces usan target=_blank); el resto se descarga.
  if (ext === '.pdf') res.setHeader('Content-Disposition', 'inline');
  else res.attachment(ref.nombre_original || nombre);
  fs.createReadStream(abs).pipe(res);
}

// GET all - with filters
router.get('/', auth, (req, res) => {
  const { estado, area, desde, hasta, buscar, page = 1, limit = 20 } = req.query;
  const currentUser = getUser(req.session.userId);
  let where = ['1=1'];
  let params = [];

  // Notificadores only see their assigned diligencias
  if (currentUser?.rol === 'notificador') {
    where.push('d.asignado_a = ?');
    params.push(req.session.userId);
  }
  // Usuarios only see their own created diligencias
  if (currentUser?.rol === 'usuario') {
    where.push('d.creado_por = ?');
    params.push(req.session.userId);
  }
  // Directores ven todas las solicitudes de SU área
  if (currentUser?.rol === 'director') {
    where.push('d.area_requirente = ?');
    params.push(currentUser.area || '');
  }
  // Coordinadores de área ven solo su área; la coordinación central ve todo
  if (isCoordinadorDeArea(currentUser)) {
    where.push('d.area_requirente = ?');
    params.push(currentUser.area || '');
  }

  if (estado) { where.push('d.estado = ?'); params.push(estado); }
  if (area) { where.push('d.area_requirente = ?'); params.push(area); }
  if (desde) { where.push('d.created_at >= ?'); params.push(desde); }
  if (hasta) { where.push('d.created_at <= ?'); params.push(hasta + ' 23:59:59'); }
  if (buscar) {
    where.push('(d.folio LIKE ? OR d.numero_oficio LIKE ? OR d.autoridad_nombre LIKE ? OR d.id_sai LIKE ?)');
    const q = `%${buscar}%`;
    params.push(q, q, q, q);
  }

  const offset = (page - 1) * limit;
  const sql = `
    SELECT d.*,
      u1.nombre as creado_por_nombre,
      u2.nombre as asignado_a_nombre,
      s.fecha_entrega, s.nombre_recibio
    FROM diligencias d
    LEFT JOIN usuarios u1 ON d.creado_por = u1.id
    LEFT JOIN usuarios u2 ON d.asignado_a = u2.id
    LEFT JOIN seguimiento s ON s.id = (
      SELECT id FROM seguimiento WHERE diligencia_id = d.id ORDER BY id DESC LIMIT 1
    )
    WHERE ${where.join(' AND ')}
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const countSql = `SELECT COUNT(*) as total FROM diligencias d WHERE ${where.join(' AND ')}`;

  const rows = db.prepare(sql).all(...params, Number(limit), Number(offset));
  const { total } = db.prepare(countSql).get(...params);

  res.json({ data: rows, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// GET single
router.get('/:id', auth, (req, res) => {
  const d = db.prepare(`
    SELECT d.*, u1.nombre as creado_por_nombre, u2.nombre as asignado_a_nombre
    FROM diligencias d
    LEFT JOIN usuarios u1 ON d.creado_por = u1.id
    LEFT JOIN usuarios u2 ON d.asignado_a = u2.id
    WHERE d.id = ?
  `).get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No encontrada' });

  if (!puedeVerDiligencia(getUser(req.session.userId), d)) {
    return res.status(403).json({ error: 'Sin acceso a esta diligencia' });
  }

  const seguimiento = db.prepare(`
    SELECT s.*, u.nombre as registrado_por_nombre
    FROM seguimiento s
    LEFT JOIN usuarios u ON s.registrado_por = u.id
    WHERE s.diligencia_id = ?
    ORDER BY s.created_at ASC
  `).all(req.params.id);

  const documentos = db.prepare(`
    SELECT doc.*, u.nombre as subido_por_nombre
    FROM documentos doc
    LEFT JOIN usuarios u ON doc.subido_por = u.id
    WHERE doc.diligencia_id = ?
    ORDER BY doc.created_at ASC
  `).all(req.params.id);

  res.json({ ...d, seguimiento, documentos });
});

// POST create (JSON only — files uploaded separately to /:id/documentos)
// Notificadores cannot create diligencias
router.post('/', auth, (req, res) => {
  const currentUser = getUser(req.session.userId);
  if (currentUser?.rol === 'notificador') {
    return res.status(403).json({ error: 'Los notificadores no pueden crear diligencias' });
  }
  const {
    area_requirente, tiene_anexos, numero_oficio, id_sai,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia,
    autoridad_municipio, autoridad_estado, autoridad_cp, autoridad_referencia,
    tiene_termino_legal, termino_fecha, termino_hora, termino_observaciones,
    contacto_nombre, contacto_email, contacto_telefono, asignado_a,
    instrucciones_adicionales,
    anexo_firma_deaj, anexo_imprimir, anexo_imprimir_hoja_verde,
    anexo_digitalizar, anexo_quemar_cd, anexo_usb, anexo_sobre_cerrado, anexo_otro,
    tantos_original, tantos_acuse, tantos_copias_conocimiento, tantos_traslados
  } = req.body;
  const toBool = v => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
  const toInt  = v => { const n = parseInt(v, 10); return isNaN(n) || n < 0 ? 0 : n; };

  if (!area_requirente || !numero_oficio || !autoridad_nombre || !autoridad_domicilio) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (id_sai && !/^\d+$/.test(String(id_sai).trim())) {
    return res.status(400).json({ error: 'El ID SAI debe ser un valor numérico' });
  }
  const existing = db.prepare('SELECT folio FROM diligencias WHERE numero_oficio = ?').get(numero_oficio.trim());
  if (existing) {
    return res.status(409).json({ error: `El número de oficio ya está registrado en la diligencia ${existing.folio}` });
  }

  const folio = generateFolio();
  const conAnexos = tiene_anexos === true || tiene_anexos === 'true' || tiene_anexos === 1 || tiene_anexos === '1';
  const conTermino = tiene_termino_legal === true || tiene_termino_legal === 'true' || tiene_termino_legal === 1 || tiene_termino_legal === '1';

  const result = db.prepare(`
    INSERT INTO diligencias (
      folio, area_requirente, tiene_anexos, numero_oficio, id_sai,
      autoridad_nombre, autoridad_domicilio, autoridad_colonia,
      autoridad_municipio, autoridad_estado, autoridad_cp, autoridad_referencia,
      tiene_termino_legal, termino_fecha, termino_hora, termino_observaciones,
      contacto_nombre, contacto_email, contacto_telefono,
      instrucciones_adicionales, creado_por, asignado_a,
      anexo_firma_deaj, anexo_imprimir, anexo_imprimir_hoja_verde,
      anexo_digitalizar, anexo_quemar_cd, anexo_usb, anexo_sobre_cerrado, anexo_otro,
      tantos_original, tantos_acuse, tantos_copias_conocimiento, tantos_traslados
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    folio, area_requirente, conAnexos ? 1 : 0, numero_oficio, id_sai || null,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia || null,
    autoridad_municipio || null, autoridad_estado || null, autoridad_cp || null, autoridad_referencia || null,
    conTermino ? 1 : 0,
    conTermino ? (termino_fecha || null) : null,
    conTermino ? (termino_hora || null) : null,
    conTermino ? (termino_observaciones || null) : null,
    contacto_nombre || null, contacto_email || null, contacto_telefono || null,
    instrucciones_adicionales || null, req.session.userId, asignado_a || null,
    conAnexos ? (toBool(anexo_firma_deaj) ? 1 : 0) : 0,
    conAnexos ? (toBool(anexo_imprimir) ? 1 : 0) : 0,
    conAnexos ? (toBool(anexo_imprimir_hoja_verde) ? 1 : 0) : 0,
    conAnexos ? (toBool(anexo_digitalizar) ? 1 : 0) : 0,
    conAnexos ? (toBool(anexo_quemar_cd) ? 1 : 0) : 0,
    conAnexos ? (toBool(anexo_usb) ? 1 : 0) : 0,
    conAnexos ? (anexo_sobre_cerrado || null) : null,
    conAnexos ? (anexo_otro || null) : null,
    toInt(tantos_original), toInt(tantos_acuse),
    toInt(tantos_copias_conocimiento), toInt(tantos_traslados)
  );

  const nueva = db.prepare('SELECT * FROM diligencias WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(nueva);
});

// POST upload documents to an existing diligencia
router.post('/:id/documentos', auth, exigirDiligencia, conSubida(uploadDocs.array('documentos', 10)), (req, res) => {
  const diligencia_id = req.diligencia.id;
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No se enviaron archivos' });
  if (!req.files.every(contenidoValido)) {
    borrarSubidos(req.files);
    return res.status(400).json({ error: 'El contenido de algún archivo no corresponde a PDF, DOC, DOCX o ZIP' });
  }

  const docStmt = db.prepare(`INSERT INTO documentos (diligencia_id, nombre_original, archivo, tipo, tamanio, subido_por) VALUES (?,?,?,?,?,?)`);
  req.files.forEach(f => {
    docStmt.run(diligencia_id, f.originalname, `/uploads/${f.filename}`, f.mimetype, f.size, req.session.userId);
  });

  res.json({ ok: true, count: req.files.length });
});

// DELETE a single document (creador de la diligencia o admin)
router.delete('/:id/documentos/:docId', auth, (req, res) => {
  const doc = db.prepare('SELECT doc.*, d.creado_por FROM documentos doc JOIN diligencias d ON d.id = doc.diligencia_id WHERE doc.id = ? AND doc.diligencia_id = ?').get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

  const user = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(req.session.userId);
  if (doc.creado_por !== req.session.userId && user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  // Delete physical file
  const filePath = path.join(__dirname, '..', 'public', doc.archivo);
  try { require('fs').unlinkSync(filePath); } catch (_) {}

  db.prepare('DELETE FROM documentos WHERE id = ?').run(req.params.docId);
  res.json({ ok: true });
});

// PUT edit diligencia (creador, admin o coordinador)
router.put('/:id', auth, (req, res) => {
  const d = db.prepare('SELECT creado_por, area_requirente FROM diligencias WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No encontrada' });

  const user = getUser(req.session.userId);
  // El coordinador de área solo puede editar diligencias de su área
  const coordPuede = user?.rol === 'coordinador' &&
    (!isCoordinadorDeArea(user) || d.area_requirente === user.area);
  const canEdit = d.creado_por === req.session.userId || user?.rol === 'admin' || coordPuede;
  if (!canEdit) {
    return res.status(403).json({ error: 'Sin permiso para editar esta diligencia' });
  }

  const {
    area_requirente, tiene_anexos, numero_oficio, id_sai,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia,
    autoridad_municipio, autoridad_estado, autoridad_cp, autoridad_referencia,
    tiene_termino_legal, termino_fecha, termino_hora, termino_observaciones,
    contacto_nombre, contacto_email, contacto_telefono, instrucciones_adicionales,
    anexo_firma_deaj, anexo_imprimir, anexo_imprimir_hoja_verde,
    anexo_digitalizar, anexo_quemar_cd, anexo_usb, anexo_sobre_cerrado, anexo_otro,
    tantos_original, tantos_acuse, tantos_copias_conocimiento, tantos_traslados
  } = req.body;
  const toBool = v => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
  const toInt  = v => { const n = parseInt(v, 10); return isNaN(n) || n < 0 ? 0 : n; };
  const conAnexosPut = toBool(tiene_anexos);

  if (!area_requirente || !numero_oficio || !autoridad_nombre || !autoridad_domicilio) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  const dupEdit = db.prepare('SELECT folio FROM diligencias WHERE numero_oficio = ? AND id != ?').get(numero_oficio.trim(), req.params.id);
  if (dupEdit) {
    return res.status(409).json({ error: `El número de oficio ya está registrado en la diligencia ${dupEdit.folio}` });
  }

  const conTermino = tiene_termino_legal === true || tiene_termino_legal === 'true' || tiene_termino_legal === 1 || tiene_termino_legal === '1' || tiene_termino_legal === 'on';

  db.prepare(`
    UPDATE diligencias SET
      area_requirente=?, tiene_anexos=?, numero_oficio=?, id_sai=?,
      autoridad_nombre=?, autoridad_domicilio=?, autoridad_colonia=?,
      autoridad_municipio=?, autoridad_estado=?, autoridad_cp=?, autoridad_referencia=?,
      tiene_termino_legal=?, termino_fecha=?, termino_hora=?, termino_observaciones=?,
      contacto_nombre=?, contacto_email=?, contacto_telefono=?,
      instrucciones_adicionales=?,
      anexo_firma_deaj=?, anexo_imprimir=?, anexo_imprimir_hoja_verde=?, anexo_digitalizar=?,
      anexo_quemar_cd=?, anexo_usb=?, anexo_sobre_cerrado=?, anexo_otro=?,
      tantos_original=?, tantos_acuse=?, tantos_copias_conocimiento=?, tantos_traslados=?,
      updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(
    area_requirente, conAnexosPut ? 1 : 0, numero_oficio, id_sai || null,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia || null,
    autoridad_municipio || null, autoridad_estado || null, autoridad_cp || null, autoridad_referencia || null,
    conTermino ? 1 : 0,
    conTermino ? (termino_fecha || null) : null,
    conTermino ? (termino_hora || null) : null,
    conTermino ? (termino_observaciones || null) : null,
    contacto_nombre || null, contacto_email || null, contacto_telefono || null,
    instrucciones_adicionales || null,
    conAnexosPut ? (toBool(anexo_firma_deaj) ? 1 : 0) : 0,
    conAnexosPut ? (toBool(anexo_imprimir) ? 1 : 0) : 0,
    conAnexosPut ? (toBool(anexo_imprimir_hoja_verde) ? 1 : 0) : 0,
    conAnexosPut ? (toBool(anexo_digitalizar) ? 1 : 0) : 0,
    conAnexosPut ? (toBool(anexo_quemar_cd) ? 1 : 0) : 0,
    conAnexosPut ? (toBool(anexo_usb) ? 1 : 0) : 0,
    conAnexosPut ? (anexo_sobre_cerrado || null) : null,
    conAnexosPut ? (anexo_otro || null) : null,
    toInt(tantos_original), toInt(tantos_acuse),
    toInt(tantos_copias_conocimiento), toInt(tantos_traslados),
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE diligencia (solo el creador, y solo si no está entregada o cancelada)
router.delete('/:id', auth, (req, res) => {
  const d = db.prepare('SELECT creado_por, estado FROM diligencias WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No encontrada' });
  if (d.creado_por !== req.session.userId) {
    return res.status(403).json({ error: 'Solo el creador puede eliminar esta diligencia' });
  }
  if (['entregado', 'cancelado'].includes(d.estado)) {
    return res.status(403).json({ error: 'No se puede eliminar una diligencia que ya fue entregada o cancelada' });
  }

  // Delete physical files
  const docs = db.prepare('SELECT archivo FROM documentos WHERE diligencia_id = ?').all(req.params.id);
  const fs = require('fs');
  docs.forEach(doc => {
    try { fs.unlinkSync(path.join(__dirname, '..', 'public', doc.archivo)); } catch (_) {}
  });

  db.transaction(() => {
    db.prepare('DELETE FROM documentos  WHERE diligencia_id = ?').run(req.params.id);
    db.prepare('DELETE FROM seguimiento WHERE diligencia_id = ?').run(req.params.id);
    db.prepare('DELETE FROM notificaciones WHERE diligencia_id = ?').run(req.params.id);
    db.prepare('DELETE FROM diligencias  WHERE id = ?').run(req.params.id);
  })();

  res.json({ ok: true });
});

// PATCH assign diligencia to notificador (admin o coordinador only)
router.patch('/:id/asignar', auth, (req, res) => {
  const currentUser = getUser(req.session.userId);
  if (!['admin', 'coordinador'].includes(currentUser?.rol)) {
    return res.status(403).json({ error: 'Solo coordinadores y administradores pueden asignar diligencias' });
  }

  const d = db.prepare('SELECT id, area_requirente FROM diligencias WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No encontrada' });

  // El coordinador de área solo puede asignar diligencias de su área
  if (isCoordinadorDeArea(currentUser) && d.area_requirente !== currentUser.area) {
    return res.status(403).json({ error: 'Sin acceso a esta diligencia' });
  }

  const { asignado_a } = req.body;
  if (asignado_a) {
    const notificador = db.prepare("SELECT id FROM usuarios WHERE id = ? AND rol = 'notificador' AND activo = 1").get(asignado_a);
    if (!notificador) return res.status(400).json({ error: 'Notificador no válido' });
  }

  db.prepare(`UPDATE diligencias SET asignado_a = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(asignado_a || null, req.params.id);
  res.json({ ok: true });
});

// PUT update estado
router.patch('/:id/estado', auth, (req, res) => {
  const { estado } = req.body;
  const valid = ['pendiente','en_proceso','entregado','no_entregado','cancelado'];
  if (!valid.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

  const currentUser = getUser(req.session.userId);

  // Solo coordinador, notificador y admin pueden cambiar el estado
  if (!['admin', 'coordinador', 'notificador'].includes(currentUser?.rol)) {
    return res.status(403).json({ error: 'Solo el coordinador o el notificador pueden cambiar el estado' });
  }

  const d = db.prepare('SELECT creado_por, asignado_a, area_requirente FROM diligencias WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No encontrado' });

  // Notificadores: solo sus diligencias asignadas
  if (currentUser?.rol === 'notificador' && d.asignado_a !== req.session.userId) {
    return res.status(403).json({ error: 'Solo puedes modificar las diligencias asignadas a ti' });
  }

  // Coordinador de área: solo diligencias de su área
  if (isCoordinadorDeArea(currentUser) && d.area_requirente !== currentUser.area) {
    return res.status(403).json({ error: 'Sin acceso a esta diligencia' });
  }

  // Solo el creador puede cancelar
  if (estado === 'cancelado' && d.creado_por !== req.session.userId) {
    return res.status(403).json({ error: 'Solo el creador puede cancelar esta notificación' });
  }

  db.prepare(`UPDATE diligencias SET estado = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(estado, req.params.id);
  res.json({ ok: true });
});

// POST seguimiento (con archivo)
router.post('/:id/seguimiento', auth, exigirDiligencia, conSubida(upload.single('archivo_acuse')), async (req, res) => {
  const { fecha_entrega, hora_entrega, nombre_recibio, observaciones, lugar, tipo } = req.body;
  const diligencia_id = req.params.id;

  const currentUser = getUser(req.session.userId);

  // La visibilidad ya la validó exigirDiligencia (antes de guardar el archivo).
  const rechazar = (status, error) => { borrarSubidos(req.file ? [req.file] : []); return res.status(status).json({ error }); };
  if (req.file && !contenidoValido(req.file)) return rechazar(400, 'El archivo no es un PDF válido');

  const esFinal = tipo === 'final';

  // Solo admin/coordinador/notificador pueden hacer el cierre (entrega final)
  if (esFinal && !['admin', 'coordinador', 'notificador'].includes(currentUser?.rol)) {
    return rechazar(403, 'Solo el coordinador o el notificador pueden registrar la entrega final');
  }

  // La hora es obligatoria en la entrega final
  if (esFinal && !hora_entrega) {
    return rechazar(400, 'La hora de entrega es obligatoria para la entrega final');
  }

  const archivo = req.file ? `/uploads/${req.file.filename}` : null;

  db.prepare(`
    INSERT INTO seguimiento (diligencia_id, tipo, lugar, fecha_entrega, hora_entrega, nombre_recibio, observaciones, archivo_acuse, registrado_por)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(diligencia_id, esFinal ? 'final' : 'parcial', lugar || null, fecha_entrega, hora_entrega || null, nombre_recibio || null, observaciones || null, archivo, req.session.userId);

  if (esFinal) {
    // Entrega final: marcar como entregado
    db.prepare(`UPDATE diligencias SET estado = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run('entregado', diligencia_id);
  } else {
    // Tramo parcial: avanzar de pendiente a en_proceso sin retroceder
    db.prepare(`UPDATE diligencias SET estado = CASE WHEN estado = 'pendiente' THEN 'en_proceso' ELSE estado END, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(diligencia_id);
  }

  // Notificación por email solo en la entrega final
  if (esFinal) {
    const d = db.prepare('SELECT * FROM diligencias WHERE id = ?').get(diligencia_id);
    if (d && d.contacto_email) {
      try {
        await mailer.sendNotificacion(d, { fecha_entrega, hora_entrega, nombre_recibio, observaciones });
      } catch(e) {
        console.error('Email error:', e.message);
      }
    }
  }

  res.json({ ok: true, archivo });
});

// GET stats for dashboard
router.get('/stats/resumen', auth, (req, res) => {
  const currentUser = getUser(req.session.userId);
  const isNotificador = currentUser?.rol === 'notificador';
  const isUsuario     = currentUser?.rol === 'usuario';
  const isDirector    = currentUser?.rol === 'director';
  const isCoordArea   = isCoordinadorDeArea(currentUser);   // coordinador acotado a su área
  const porArea       = isDirector || isCoordArea;
  const filterClause = isNotificador ? 'AND asignado_a = ?'
                     : isUsuario     ? 'AND creado_por = ?'
                     : porArea       ? 'AND area_requirente = ?'   // director / coordinador de área: solo su área
                     : '';
  const filterParams = (isNotificador || isUsuario) ? [req.session.userId]
                     : porArea ? [currentUser.area || '']
                     : [];

  const count = (extra = '') =>
    db.prepare(`SELECT COUNT(*) as n FROM diligencias WHERE 1=1 ${filterClause} ${extra}`).get(...filterParams).n;

  const total      = count();
  const pendiente  = count(`AND estado='pendiente'`);
  const en_proceso = count(`AND estado='en_proceso'`);
  const entregado  = count(`AND estado='entregado'`);
  const con_termino = count(`AND tiene_termino_legal=1 AND estado NOT IN ('entregado','cancelado')`);
  const vencen_hoy  = count(`AND tiene_termino_legal=1 AND termino_fecha = date('now') AND estado NOT IN ('entregado','cancelado')`);

  const por_area = db.prepare(
    `SELECT area_requirente, COUNT(*) as total FROM diligencias WHERE 1=1 ${filterClause} GROUP BY area_requirente ORDER BY total DESC`
  ).all(...filterParams);

  res.json({ total, pendiente, en_proceso, entregado, con_termino, vencen_hoy, por_area });
});

module.exports = router;
module.exports.servirArchivo = servirArchivo;
