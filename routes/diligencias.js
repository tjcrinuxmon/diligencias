const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database');
const mailer = require('../mailer');

// Auth middleware
function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}

// Multer — shared storage
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});

// Para acuses de seguimiento (PDF únicamente)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
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
    if (ALLOWED_DOC_MIMES.has(file.mimetype) || ALLOWED_DOC_EXTS.has(ext)) cb(null, true);
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

// GET all - with filters
router.get('/', auth, (req, res) => {
  const { estado, area, desde, hasta, buscar, page = 1, limit = 20 } = req.query;
  let where = ['1=1'];
  let params = [];

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
router.post('/', auth, (req, res) => {
  const {
    area_requirente, tiene_anexos, numero_oficio, id_sai,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia,
    autoridad_municipio, autoridad_estado, autoridad_cp, autoridad_referencia,
    tiene_termino_legal, termino_fecha, termino_hora, termino_observaciones,
    contacto_nombre, contacto_email, contacto_telefono, asignado_a
  } = req.body;

  if (!area_requirente || !numero_oficio || !autoridad_nombre || !autoridad_domicilio) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (id_sai && !/^\d+$/.test(String(id_sai).trim())) {
    return res.status(400).json({ error: 'El ID SAI debe ser un valor numérico' });
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
      creado_por, asignado_a
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    folio, area_requirente, conAnexos ? 1 : 0, numero_oficio, id_sai || null,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia || null,
    autoridad_municipio || null, autoridad_estado || null, autoridad_cp || null, autoridad_referencia || null,
    conTermino ? 1 : 0,
    conTermino ? (termino_fecha || null) : null,
    conTermino ? (termino_hora || null) : null,
    conTermino ? (termino_observaciones || null) : null,
    contacto_nombre || null, contacto_email || null, contacto_telefono || null,
    req.session.userId, asignado_a || null
  );

  const nueva = db.prepare('SELECT * FROM diligencias WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(nueva);
});

// POST upload documents to an existing diligencia
router.post('/:id/documentos', auth, uploadDocs.array('documentos', 10), (req, res) => {
  const diligencia_id = req.params.id;
  const d = db.prepare('SELECT id FROM diligencias WHERE id = ?').get(diligencia_id);
  if (!d) return res.status(404).json({ error: 'Diligencia no encontrada' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No se enviaron archivos' });

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

// PUT edit diligencia (creador o admin)
router.put('/:id', auth, (req, res) => {
  const d = db.prepare('SELECT creado_por FROM diligencias WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No encontrada' });

  const user = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(req.session.userId);
  if (d.creado_por !== req.session.userId && user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Sin permiso para editar esta diligencia' });
  }

  const {
    area_requirente, numero_oficio, id_sai,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia,
    autoridad_municipio, autoridad_estado, autoridad_cp, autoridad_referencia,
    tiene_termino_legal, termino_fecha, termino_hora, termino_observaciones,
    contacto_nombre, contacto_email, contacto_telefono
  } = req.body;

  if (!area_requirente || !numero_oficio || !autoridad_nombre || !autoridad_domicilio) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const conTermino = tiene_termino_legal === true || tiene_termino_legal === 'true' || tiene_termino_legal === 1 || tiene_termino_legal === '1' || tiene_termino_legal === 'on';

  db.prepare(`
    UPDATE diligencias SET
      area_requirente=?, numero_oficio=?, id_sai=?,
      autoridad_nombre=?, autoridad_domicilio=?, autoridad_colonia=?,
      autoridad_municipio=?, autoridad_estado=?, autoridad_cp=?, autoridad_referencia=?,
      tiene_termino_legal=?, termino_fecha=?, termino_hora=?, termino_observaciones=?,
      contacto_nombre=?, contacto_email=?, contacto_telefono=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    area_requirente, numero_oficio, id_sai || null,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia || null,
    autoridad_municipio || null, autoridad_estado || null, autoridad_cp || null, autoridad_referencia || null,
    conTermino ? 1 : 0,
    conTermino ? (termino_fecha || null) : null,
    conTermino ? (termino_hora || null) : null,
    conTermino ? (termino_observaciones || null) : null,
    contacto_nombre || null, contacto_email || null, contacto_telefono || null,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE diligencia (solo el creador)
router.delete('/:id', auth, (req, res) => {
  const d = db.prepare('SELECT creado_por FROM diligencias WHERE id = ?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'No encontrada' });
  if (d.creado_por !== req.session.userId) {
    return res.status(403).json({ error: 'Solo el creador puede eliminar esta diligencia' });
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

// PUT update estado
router.patch('/:id/estado', auth, (req, res) => {
  const { estado } = req.body;
  const valid = ['pendiente','en_proceso','entregado','no_entregado','cancelado'];
  if (!valid.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

  db.prepare('UPDATE diligencias SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(estado, req.params.id);
  res.json({ ok: true });
});

// POST seguimiento (con archivo)
router.post('/:id/seguimiento', auth, upload.single('archivo_acuse'), async (req, res) => {
  const { fecha_entrega, hora_entrega, nombre_recibio, observaciones, lugar, tipo } = req.body;
  const diligencia_id = req.params.id;
  const esFinal = tipo === 'final';

  const archivo = req.file ? `/uploads/${req.file.filename}` : null;

  db.prepare(`
    INSERT INTO seguimiento (diligencia_id, tipo, lugar, fecha_entrega, hora_entrega, nombre_recibio, observaciones, archivo_acuse, registrado_por)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(diligencia_id, esFinal ? 'final' : 'parcial', lugar || null, fecha_entrega, hora_entrega || null, nombre_recibio || null, observaciones || null, archivo, req.session.userId);

  if (esFinal) {
    // Entrega final: marcar como entregado
    db.prepare('UPDATE diligencias SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('entregado', diligencia_id);
  } else {
    // Tramo parcial: avanzar de pendiente a en_proceso sin retroceder
    db.prepare(`UPDATE diligencias SET estado = CASE WHEN estado = 'pendiente' THEN 'en_proceso' ELSE estado END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
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
  const total = db.prepare('SELECT COUNT(*) as n FROM diligencias').get().n;
  const pendiente = db.prepare("SELECT COUNT(*) as n FROM diligencias WHERE estado='pendiente'").get().n;
  const en_proceso = db.prepare("SELECT COUNT(*) as n FROM diligencias WHERE estado='en_proceso'").get().n;
  const entregado = db.prepare("SELECT COUNT(*) as n FROM diligencias WHERE estado='entregado'").get().n;
  const con_termino = db.prepare("SELECT COUNT(*) as n FROM diligencias WHERE tiene_termino_legal=1 AND estado NOT IN ('entregado','cancelado')").get().n;
  const vencen_hoy = db.prepare(`
    SELECT COUNT(*) as n FROM diligencias 
    WHERE tiene_termino_legal=1 AND termino_fecha = date('now') AND estado NOT IN ('entregado','cancelado')
  `).get().n;

  const por_area = db.prepare(`
    SELECT area_requirente, COUNT(*) as total FROM diligencias GROUP BY area_requirente ORDER BY total DESC
  `).all();

  res.json({ total, pendiente, en_proceso, entregado, con_termino, vencen_hoy, por_area });
});

module.exports = router;
