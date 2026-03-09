import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'audit_system.db');

let _db: any = null;

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function saveDb() {
  if (!_db) return;
  const data: Uint8Array = _db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// ─── BETTER-SQLITE3 COMPATIBILITY WRAPPER ────────────────────────────────────
type RunResult = { changes: number; lastInsertRowid: number };

function prepare(sql: string) {
  return {
    run(...args: any[]): RunResult {
      if (!_db) throw new Error('Database not initialized');
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      _db.run(sql, params.length ? params : undefined);
      saveDb();
      const changes: number = _db.getRowsModified();
      const r = _db.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid: number = r.length && r[0].values.length
        ? Number(r[0].values[0][0]) : 0;
      return { changes, lastInsertRowid };
    },
    get(...args: any[]): any {
      if (!_db) throw new Error('Database not initialized');
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      const stmt = _db.prepare(sql);
      try {
        if (params.length) stmt.bind(params);
        return stmt.step() ? stmt.getAsObject() : undefined;
      } finally {
        stmt.free();
      }
    },
    all(...args: any[]): any[] {
      if (!_db) throw new Error('Database not initialized');
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      const stmt = _db.prepare(sql);
      try {
        if (params.length) stmt.bind(params);
        const rows: any[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
      } finally {
        stmt.free();
      }
    },
  };
}

function dbExec(sql: string) {
  if (!_db) throw new Error('Database not initialized');
  _db.exec(sql);
  saveDb();
}

const db = {
  prepare,
  exec: dbExec,
  pragma: (_: string): any => undefined, // no-op: pragmas handled via PRAGMA sql in initDb
};

export { db };
export default db;

// ─── INIT ────────────────────────────────────────────────────────────────────
export async function initDb() {
  const SQL = await initSqlJs({
    locateFile: (filename: string) =>
      path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', filename),
  });

  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  _db.run('PRAGMA foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Migrations — safe for existing DB
  try { _db.exec('ALTER TABLE pts ADD COLUMN archived_at TEXT'); } catch { /* exists */ }
  try {
    _db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1');
    _db.exec('UPDATE users SET is_active = 1 WHERE is_active IS NULL');
  } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''"); } catch { /* exists */ }
  try { _db.exec('ALTER TABLE users ADD COLUMN email_reminder INTEGER DEFAULT 1'); } catch { /* exists */ }
  try { _db.exec('ALTER TABLE users ADD COLUMN kode_unik TEXT'); } catch { /* exists */ }
  try { _db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kode_unik ON users(kode_unik)'); } catch { /* exists */ }
  try { _db.exec('ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id)'); } catch { /* exists */ }

  _db.exec(`
    CREATE TABLE IF NOT EXISTS spv_daily_reports (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      tanggal    TEXT NOT NULL,
      judul      TEXT NOT NULL,
      isi        TEXT NOT NULL,
      kegiatan   TEXT DEFAULT '',
      kendala    TEXT DEFAULT '',
      rencana    TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      is_read    INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS pts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_pt TEXT NOT NULL,
      alamat TEXT,
      PIC TEXT,
      periode_start DATE,
      periode_end DATE,
      status TEXT DEFAULT 'Active'
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS audit_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pt_id INTEGER NOT NULL,
      auditor_id INTEGER NOT NULL,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'Active',
      FOREIGN KEY (pt_id) REFERENCES pts(id),
      FOREIGN KEY (auditor_id) REFERENCES users(id)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      tanggal DATE DEFAULT CURRENT_DATE,
      jam_mulai TEXT,
      jam_selesai TEXT,
      area_diaudit TEXT,
      deskripsi_pekerjaan TEXT,
      temuan TEXT,
      progress INTEGER DEFAULT 0,
      kendala TEXT,
      status TEXT DEFAULT 'Ongoing',
      approval_status TEXT DEFAULT 'Pending',
      approved_by INTEGER,
      approved_at DATETIME,
      supervisor_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES audit_assignments(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS visit_logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id    INTEGER NOT NULL,
      auditor_id       INTEGER NOT NULL,
      pt_id            INTEGER NOT NULL,
      type             TEXT NOT NULL CHECK(type IN ('check_in','check_out')),
      photo            TEXT,
      latitude         REAL,
      longitude        REAL,
      notes            TEXT DEFAULT '',
      approval_status  TEXT DEFAULT 'Pending' CHECK(approval_status IN ('Pending','Approved','Rejected')),
      supervisor_notes TEXT DEFAULT '',
      approved_by      INTEGER,
      timestamp        TEXT DEFAULT (datetime('now','localtime')),
      created_at       TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(assignment_id) REFERENCES audit_assignments(id),
      FOREIGN KEY(auditor_id)    REFERENCES users(id),
      FOREIGN KEY(pt_id)         REFERENCES pts(id)
    )
  `);

  // Seed roles
  ['Admin', 'Auditor', 'Supervisor', 'Manager'].forEach(name => {
    _db.run('INSERT OR IGNORE INTO roles (name) VALUES (?)', [name]);
  });

  // Generate kode_unik for users without one
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function makeKode(): string {
    let k = '';
    for (let i = 0; i < 6; i++) k += CHARS[Math.floor(Math.random() * CHARS.length)];
    return k;
  }

  const noKodeStmt = _db.prepare("SELECT id FROM users WHERE kode_unik IS NULL OR kode_unik = ''");
  const usersWithoutKode: any[] = [];
  while (noKodeStmt.step()) usersWithoutKode.push(noKodeStmt.getAsObject());
  noKodeStmt.free();

  for (const u of usersWithoutKode) {
    let kode = makeKode();
    // ensure no collision
    let checkStmt = _db.prepare('SELECT id FROM users WHERE kode_unik = ?');
    checkStmt.bind([kode]);
    while (checkStmt.step()) {
      kode = makeKode();
      checkStmt.reset();
      checkStmt.bind([kode]);
    }
    checkStmt.free();
    _db.run('UPDATE users SET kode_unik = ? WHERE id = ?', [kode, u.id]);
  }

  // Seed default users
  const seedUsers = [
    { username: 'admin',      password: 'admin123',      full_name: 'System Administrator', role: 'Admin' },
    { username: 'supervisor', password: 'supervisor123', full_name: 'John Supervisor',       role: 'Supervisor' },
    { username: 'manager',    password: 'manager123',    full_name: 'Jane Manager',          role: 'Manager' },
    { username: 'auditor1',   password: 'auditor123',    full_name: 'Alice Auditor',         role: 'Auditor' },
    { username: 'auditor2',   password: 'auditor123',    full_name: 'Bob Auditor',           role: 'Auditor' },
  ];

  for (const u of seedUsers) {
    const existStmt = _db.prepare('SELECT id, password FROM users WHERE username = ?');
    existStmt.bind([u.username]);
    const existing = existStmt.step() ? existStmt.getAsObject() : undefined;
    existStmt.free();

    const roleStmt = _db.prepare('SELECT id FROM roles WHERE name = ?');
    roleStmt.bind([u.role]);
    const roleRow = roleStmt.step() ? roleStmt.getAsObject() : undefined;
    roleStmt.free();

    if (!roleRow) continue;

    if (!existing) {
      const hashed = bcrypt.hashSync(u.password, 10);
      _db.run(
        'INSERT INTO users (username, password, full_name, role_id, is_active) VALUES (?, ?, ?, ?, 1)',
        [u.username, hashed, u.full_name, (roleRow as any).id]
      );
    } else {
      _db.run('UPDATE users SET is_active = 1 WHERE id = ?', [(existing as any).id]);
      if ((existing as any).password && !String((existing as any).password).startsWith('$2')) {
        const hashed = bcrypt.hashSync(u.password, 10);
        _db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, (existing as any).id]);
      }
    }
  }

  // Persist to disk once after all setup
  saveDb();
}
