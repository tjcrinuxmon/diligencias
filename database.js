const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'diligencias.sqlite');
let _sqlJsDb = null;

function saveDb() {
  if (_sqlJsDb) {
    const data = _sqlJsDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// ── Compatibility wrapper (mimics better-sqlite3 API) ──
class Statement {
  constructor(sql) { this._sql = sql; }

  _exec(params) {
    const stmt = _sqlJsDb.prepare(this._sql);
    if (params && params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  get(...args)  { return this._exec(args.flat())[0] ?? undefined; }
  all(...args)  { return this._exec(args.flat()); }

  run(...args) {
    const params = args.flat();
    const stmt = _sqlJsDb.prepare(this._sql);
    if (params.length > 0) stmt.bind(params);
    stmt.step();
    stmt.free();

    const idStmt = _sqlJsDb.prepare('SELECT last_insert_rowid() as id');
    idStmt.step();
    const lastInsertRowid = idStmt.getAsObject().id;
    idStmt.free();

    const chgStmt = _sqlJsDb.prepare('SELECT changes() as n');
    chgStmt.step();
    const changes = chgStmt.getAsObject().n;
    chgStmt.free();

    saveDb();
    return { lastInsertRowid, changes };
  }
}

const db = {
  prepare(sql) { return new Statement(sql); },
  pragma(s)    { try { _sqlJsDb.run(`PRAGMA ${s};`); } catch (_) {} },
};

// ── Inicialización asíncrona ───────────────────────────
async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    _sqlJsDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _sqlJsDb = new SQL.Database();
  }

  _sqlJsDb.run('PRAGMA journal_mode = WAL;');
  _sqlJsDb.run('PRAGMA foreign_keys = ON;');

  _sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT DEFAULT 'usuario' CHECK(rol IN ('admin', 'usuario', 'notificador')),
      area TEXT,
      activo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  _sqlJsDb.run(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  _sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS seguimiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diligencia_id INTEGER REFERENCES diligencias(id),
      fecha_entrega TEXT,
      hora_entrega TEXT,
      nombre_recibio TEXT,
      observaciones TEXT,
      archivo_acuse TEXT,
      registrado_por INTEGER REFERENCES usuarios(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  _sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diligencia_id INTEGER REFERENCES diligencias(id),
      tipo TEXT,
      destinatario TEXT,
      enviado INTEGER DEFAULT 0,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Admin por defecto
  const adminStmt = _sqlJsDb.prepare('SELECT id FROM usuarios WHERE rol = ?');
  adminStmt.bind(['admin']);
  const hasAdmin = adminStmt.step();
  adminStmt.free();

  if (!hasAdmin) {
    const hash = bcrypt.hashSync('Admin1234!', 10);
    _sqlJsDb.run(
      'INSERT INTO usuarios (nombre, email, password, rol, area) VALUES (?,?,?,?,?)',
      ['Administrador', 'admin@diligencias.gob.mx', hash, 'admin', 'Administración']
    );
    console.log('👤 Usuario admin creado: admin@diligencias.gob.mx / Admin1234!');
  }

  // Migrations: partial delivery tracking
  try { _sqlJsDb.run(`ALTER TABLE seguimiento ADD COLUMN tipo TEXT NOT NULL DEFAULT 'final'`); } catch(_) {}
  try { _sqlJsDb.run(`ALTER TABLE seguimiento ADD COLUMN lugar TEXT`); } catch(_) {}

  saveDb();
  console.log('✅ Base de datos inicializada correctamente');
}

module.exports = db;
module.exports.initDatabase = initDatabase;
module.exports.saveDb = saveDb;
