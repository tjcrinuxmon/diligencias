const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const db        = require('../database');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
});
const PORTAL_SSO_SECRET = process.env.PORTAL_SSO_SECRET;
if (!PORTAL_SSO_SECRET) { console.error('FATAL: PORTAL_SSO_SECRET no definido'); process.exit(1); }

router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Credenciales requeridas' });

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  req.session.userId = user.id;
  req.session.userRol = user.rol;
  req.session.userName = user.nombre;
  req.session.csrfToken = crypto.randomBytes(24).toString('hex');

  res.json({
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    area: user.area,
    csrfToken: req.session.csrfToken,
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  const user = db.prepare('SELECT id, nombre, email, rol, area FROM usuarios WHERE id = ?').get(req.session.userId);
  res.json(user);
});

router.get('/csrf', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  res.json({ csrfToken: req.session.csrfToken || '' });
});

// GET /api/auth/sso?sso_token=xxx  — portal SSO entry point
router.get('/sso', (req, res) => {
  const { sso_token } = req.query;
  if (!sso_token) return res.redirect('/?error=missing_token');
  try {
    const payload = jwt.verify(sso_token, PORTAL_SSO_SECRET);
    let user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(payload.email);
    if (!user) {
      return res.redirect('/diligencias?error=no_access');
    }
    // Sync from portal on every SSO login
    db.prepare('UPDATE usuarios SET nombre=?, rol=?, area=?, activo=1 WHERE email=?')
      .run(payload.nombre, payload.rol || 'usuario', payload.area || '', payload.email);
    user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(payload.email);
    req.session.userId    = user.id;
    req.session.userRol   = user.rol;
    req.session.userName  = user.nombre;
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    res.redirect('/diligencias');
  } catch {
    res.redirect('/diligencias?error=invalid_token');
  }
});

module.exports = router;
