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

// Multer config
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'));
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

  res.json({ ...d, seguimiento });
});

// POST create
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

  const folio = generateFolio();

  const stmt = db.prepare(`
    INSERT INTO diligencias (
      folio, area_requirente, tiene_anexos, numero_oficio, id_sai,
      autoridad_nombre, autoridad_domicilio, autoridad_colonia,
      autoridad_municipio, autoridad_estado, autoridad_cp, autoridad_referencia,
      tiene_termino_legal, termino_fecha, termino_hora, termino_observaciones,
      contacto_nombre, contacto_email, contacto_telefono,
      creado_por, asignado_a
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const result = stmt.run(
    folio, area_requirente, tiene_anexos ? 1 : 0, numero_oficio, id_sai || null,
    autoridad_nombre, autoridad_domicilio, autoridad_colonia || null,
    autoridad_municipio || null, autoridad_estado || null, autoridad_cp || null, autoridad_referencia || null,
    tiene_termino_legal ? 1 : 0,
    tiene_termino_legal ? termino_fecha : null,
    tiene_termino_legal ? termino_hora : null,
    tiene_termino_legal ? termino_observaciones : null,
    contacto_nombre || null, contacto_email || null, contacto_telefono || null,
    req.session.userId, asignado_a || null
  );

  const nueva = db.prepare('SELECT * FROM diligencias WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(nueva);
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
