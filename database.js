const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'diligencias.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'usuario' CHECK(rol IN ('admin', 'usuario', 'notificador')),
    area TEXT,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now','localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS diligencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,
    area_requirente TEXT NOT NULL,
    tiene_anexos INTEGER DEFAULT 0,
    numero_oficio TEXT NOT NULL,
    id_sai TEXT,
    autoridad_nombre TEXT NOT NULL,
    autoridad_domicilio TEXT NOT NULL,
    autoridad_colonia TEXT,
    autoridad_municipio TEXT,
    autoridad_estado TEXT,
    autoridad_cp TEXT,
    autoridad_referencia TEXT,
    tiene_termino_legal INTEGER DEFAULT 0,
    termino_fecha TEXT,
    termino_hora TEXT,
    termino_observaciones TEXT,
    contacto_nombre TEXT,
    contacto_email TEXT,
    contacto_telefono TEXT,
    estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_proceso','entregado','no_entregado','cancelado')),
    creado_por INTEGER REFERENCES usuarios(id),
    asignado_a INTEGER REFERENCES usuarios(id),
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    updated_at DATETIME DEFAULT (datetime('now','localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS seguimiento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diligencia_id INTEGER REFERENCES diligencias(id),
    fecha_entrega TEXT,
    hora_entrega TEXT,
    nombre_recibio TEXT,
    observaciones TEXT,
    archivo_acuse TEXT,
    registrado_por INTEGER REFERENCES usuarios(id),
    created_at DATETIME DEFAULT (datetime('now','localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diligencia_id INTEGER REFERENCES diligencias(id),
    tipo TEXT,
    destinatario TEXT,
    enviado INTEGER DEFAULT 0,
    error TEXT,
    created_at DATETIME DEFAULT (datetime('now','localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diligencia_id INTEGER NOT NULL REFERENCES diligencias(id),
    nombre_original TEXT NOT NULL,
    archivo TEXT NOT NULL,
    tipo TEXT,
    tamanio INTEGER,
    subido_por INTEGER REFERENCES usuarios(id),
    created_at DATETIME DEFAULT (datetime('now','localtime'))
  )
`);

// Migrations
try { db.exec(`ALTER TABLE seguimiento ADD COLUMN tipo TEXT NOT NULL DEFAULT 'final'`); } catch (_) {}
try { db.exec(`ALTER TABLE seguimiento ADD COLUMN lugar TEXT`); } catch (_) {}

// Seed: default admin
if (!db.prepare(`SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1`).get()) {
  const hash = bcrypt.hashSync('Admin1234!', 10);
  db.prepare(`INSERT INTO usuarios (nombre, email, password, rol, area) VALUES (?, ?, ?, ?, ?)`)
    .run('Administrador', 'admin@diligencias.gob.mx', hash, 'admin', 'Administración');
  console.log('👤 Usuario admin creado: admin@diligencias.gob.mx / Admin1234!');
}

console.log('✅ Base de datos inicializada correctamente');

module.exports = db;
