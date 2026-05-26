require('dotenv').config();
process.env.TZ = 'America/Mexico_City';
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');
const fs      = require('fs');
require('./database'); // synchronous init — runs migrations and seeds on startup

if (!process.env.SESSION_SECRET || !process.env.PORTAL_SSO_SECRET) {
  console.error('FATAL: Faltan variables de entorno (SESSION_SECRET, PORTAL_SSO_SECRET)');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3002;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// CSRF protection — only checked for authenticated sessions on mutating requests
app.use((req, res, next) => {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE']
  const exempt   = ['/api/auth/login', '/api/auth/logout']
  if (mutating.includes(req.method) && !exempt.includes(req.path) && req.session?.userId) {
    if (!req.session.csrfToken || req.headers['x-csrf-token'] !== req.session.csrfToken) {
      return res.status(403).json({ error: 'CSRF token inválido' })
    }
  }
  next()
})

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/usuarios',    require('./routes/usuarios'));
app.use('/api/diligencias', require('./routes/diligencias'));

// Serve SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📋 Sistema de Diligencias iniciado`);
});
