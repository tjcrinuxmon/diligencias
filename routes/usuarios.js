const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  const u = db.prepare('SELECT id, activo FROM usuarios WHERE id = ?').get(req.session.userId);
  if (!u || !u.activo) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  next();
}
function adminOnly(req, res, next) {
  if (req.session.userRol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  next();
}

function notNotificador(req, res, next) {
  if (req.session.userRol === 'notificador') return res.status(403).json({ error: 'Sin permisos' });
  next();
}

router.get('/', auth, notNotificador, (req, res) => {
  const { rol } = req.query;
  let sql = 'SELECT id, nombre, email, rol, area, activo, created_at FROM usuarios';
  const params = [];
  if (rol) { sql += ' WHERE rol = ?'; params.push(rol); }
  sql += ' ORDER BY nombre';
  const users = db.prepare(sql).all(...params);
  res.json(users);
});

router.post('/', auth, adminOnly, (req, res) => {
  const { nombre, email, password, rol, area } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Campos requeridos' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO usuarios (nombre, email, password, rol, area) VALUES (?,?,?,?,?)')
      .run(nombre, email, hash, rol || 'usuario', area || null);
    res.status(201).json({ id: result.lastInsertRowid, nombre, email, rol, area });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email ya registrado' });
    throw e;
  }
});

router.patch('/:id', auth, adminOnly, (req, res) => {
  const { nombre, rol, area, activo } = req.body;
  db.prepare('UPDATE usuarios SET nombre=?, rol=?, area=?, activo=? WHERE id=?')
    .run(nombre, rol, area, activo ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.patch('/:id/password', auth, (req, res) => {
  // Only admin or self can change password
  if (req.session.userRol !== 'admin' && req.session.userId !== Number(req.params.id)) {
    return res.status(403).json({ error: 'Sin permisos' });
  }
  const { password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE usuarios SET password=? WHERE id=?').run(hash, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
