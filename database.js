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
try { db.exec(`ALTER TABLE diligencias ADD COLUMN instrucciones_adicionales TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_firma_deaj INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_imprimir INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_imprimir_hoja_verde INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_certificar INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_digitalizar INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_quemar_cd INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_usb INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_sobre_cerrado TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN anexo_otro TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN tantos_original INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN tantos_acuse INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN tantos_copias_conocimiento INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE diligencias ADD COLUMN tantos_traslados INTEGER DEFAULT 0`); } catch (_) {}

// Migration: add 'coordinador' role to CHECK constraint
try {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='usuarios'").get();
  if (row && row.sql && !row.sql.includes("'coordinador'")) {
    db.pragma('foreign_keys = OFF');
    // Clean up any leftover temp table from a previous failed attempt
    db.exec(`DROP TABLE IF EXISTS usuarios_new`);
    db.exec(`
      CREATE TABLE usuarios_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol TEXT DEFAULT 'usuario' CHECK(rol IN ('admin','usuario','notificador','coordinador')),
        area TEXT,
        activo INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      );
      INSERT INTO usuarios_new SELECT * FROM usuarios;
      DROP TABLE usuarios;
      ALTER TABLE usuarios_new RENAME TO usuarios;
    `);
    db.pragma('foreign_keys = ON');
    console.log('✅ Migración: rol coordinador agregado');
  }
} catch(e) {
  db.pragma('foreign_keys = ON');
  console.error('Migration coordinador:', e.message);
}

// Seed: default admin
if (!db.prepare(`SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1`).get()) {
  const adminPwd = process.env.ADMIN_SEED_PASSWORD || require('crypto').randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(adminPwd, 10);
  db.prepare(`INSERT INTO usuarios (nombre, email, password, rol, area) VALUES (?, ?, ?, ?, ?)`)
    .run('Administrador', 'admin@diligencias.gob.mx', hash, 'admin', 'Administración');
  console.log(`👤 Admin creado: admin@diligencias.gob.mx / ${adminPwd}  ← guarda esta contraseña`);
}

// Seed: Secretaría Particular (coordinador)
const COORD_AREA = 'Coordinación de Análisis de Información y Control Documental';
try {
  const existing = db.prepare(`SELECT id, area FROM usuarios WHERE email = 'secretaria@ine.mx' LIMIT 1`).get();
  if (!existing) {
    const secPwd = process.env.SECRETARIA_SEED_PASSWORD || require('crypto').randomBytes(12).toString('base64url');
    const hash = bcrypt.hashSync(secPwd, 10);
    db.prepare(`INSERT INTO usuarios (nombre, email, password, rol, area) VALUES (?, ?, ?, ?, ?)`)
      .run('Secretaría Particular', 'secretaria@ine.mx', hash, 'coordinador', COORD_AREA);
    console.log(`👤 Secretaría Particular creada: secretaria@ine.mx / ${secPwd}  ← guarda esta contraseña`);
  } else if (existing.area !== COORD_AREA) {
    db.prepare(`UPDATE usuarios SET area = ? WHERE id = ?`).run(COORD_AREA, existing.id);
    console.log('✅ Área de Secretaría Particular corregida');
  }
} catch(e) { console.error('Seed Secretaría Particular:', e.message); }

console.log('✅ Base de datos inicializada correctamente');

module.exports = db;
