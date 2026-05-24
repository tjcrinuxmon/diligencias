const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

// Ensure uploads directory exists
if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'diligencias-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/usuarios',    require('./routes/usuarios'));
app.use('/api/diligencias', require('./routes/diligencias'));

// Serve SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Inicializar DB y arrancar servidor
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📋 Sistema de Diligencias iniciado`);
  });
}).catch(err => {
  console.error('❌ Error al inicializar la base de datos:', err);
  process.exit(1);
});
