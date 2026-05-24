const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db = require('../database');
const PORTAL_SSO_SECRET = process.env.PORTAL_SSO_SECRET || 'ine_portal_sso_dilig_2026';

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Credenciales requeridas' });

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  req.session.userId = user.id;
  req.session.userRol = user.rol;
  req.session.userName = user.nombre;

  res.json({
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    area: user.area
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  const user = db.prepare('SELECT id, nombre, email, rol, area FROM usuarios WHERE id = ?').get(req.session.userId);
  res.json(user);
});

// GET /api/auth/sso?sso_token=xxx  — portal SSO entry point
router.get('/sso', (req, res) => {
  const { sso_token } = req.query;
  if (!sso_token) return res.redirect('/?error=missing_token');
  try {
    const payload = jwt.verify(sso_token, PORTAL_SSO_SECRET);
    let user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(payload.email);
    if (!user) {
      // Auto-create user on first SSO login
      const hash = bcrypt.hashSync('sso_placeholder', 4);
      db.prepare('INSERT OR IGNORE INTO usuarios (nombre, email, password, rol, area, activo) VALUES (?,?,?,?,?,1)')
        .run(payload.nombre, payload.email, hash, payload.rol || 'usuario', payload.area || '');
      user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(payload.email);
    }
    req.session.userId   = user.id;
    req.session.userRol  = user.rol;
    req.session.userName = user.nombre;
    res.redirect('/diligencias');
  } catch {
    res.redirect('/diligencias?error=invalid_token');
  }
});

module.exports = router;
