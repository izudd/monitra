import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

// Di Railway: set DB_PATH=/data/audit_system.db (persistent volume)
// Di lokal: default ke audit_system.db di root project
const db = new Database(process.env.DB_PATH || 'audit_system.db');

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);

  db.exec(`
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

  // Migration: tambah kolom archived_at di pts (safe untuk DB lama)
  try { db.exec('ALTER TABLE pts ADD COLUMN archived_at TEXT'); } catch { /* sudah ada */ }

  // Migration: tambah kolom is_active kalau belum ada (safe untuk DB lama)
  try {
    db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1');
    db.exec('UPDATE users SET is_active = 1 WHERE is_active IS NULL');
  } catch { /* kolom sudah ada, skip */ }

  // Migration: email + email_reminder untuk notifikasi pengingat
  try { db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''"); } catch { /* sudah ada */ }
  try { db.exec('ALTER TABLE users ADD COLUMN email_reminder INTEGER DEFAULT 1'); } catch { /* sudah ada */ }

  // Migration: kode_unik — kode login unik 6 karakter untuk Auditor
  // CATATAN: SQLite tidak support UNIQUE constraint di ALTER TABLE ADD COLUMN,
  // jadi kolom ditambah dulu tanpa UNIQUE, lalu UNIQUE index dibuat terpisah.
  try { db.exec('ALTER TABLE users ADD COLUMN kode_unik TEXT'); } catch { /* sudah ada */ }
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kode_unik ON users(kode_unik)'); } catch { /* sudah ada */ }

  // Migration: supervisor_id — assign Auditor ke SPV tertentu
  try { db.exec('ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id)'); } catch { /* sudah ada */ }

  // SPV / Manager Daily Log — catatan harian bebas, tidak terikat PT
  db.exec(`
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

  // Generate kode_unik untuk user yang belum punya (user lama / baru sebelum migrasi)
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I yang membingungkan
  function makeKode(): string {
    let k = '';
    for (let i = 0; i < 6; i++) k += CHARS[Math.floor(Math.random() * CHARS.length)];
    return k;
  }
  const usersWithoutKode = db.prepare('SELECT id FROM users WHERE kode_unik IS NULL OR kode_unik = \'\'').all() as any[];
  for (const u of usersWithoutKode) {
    let kode = makeKode();
    // pastikan tidak collision
    while (db.prepare('SELECT id FROM users WHERE kode_unik = ?').get(kode)) kode = makeKode();
    db.prepare('UPDATE users SET kode_unik = ? WHERE id = ?').run(kode, u.id);
  }

  // Tabel notifikasi in-app
  db.exec(`
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

  // Tabel konfigurasi sistem (SMTP dsb) — key-value
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.exec(`
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

  db.exec(`
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

  db.exec(`
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

  db.exec(`
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
  ['Admin', 'Auditor', 'Supervisor', 'Manager'].forEach(name =>
    db.prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)').run(name)
  );

  // Seed users dengan bcrypt hash
  const seedUsers = [
    { username: 'admin',      password: 'admin123',      full_name: 'System Administrator', role: 'Admin' },
    { username: 'supervisor', password: 'supervisor123', full_name: 'John Supervisor',       role: 'Supervisor' },
    { username: 'manager',    password: 'manager123',    full_name: 'Jane Manager',          role: 'Manager' },
    { username: 'auditor1',   password: 'auditor123',    full_name: 'Alice Auditor',         role: 'Auditor' },
    { username: 'auditor2',   password: 'auditor123',    full_name: 'Bob Auditor',           role: 'Auditor' },
  ];

  for (const u of seedUsers) {
    const existing = db.prepare('SELECT id, password FROM users WHERE username = ?').get(u.username) as any;
    const roleRow  = db.prepare('SELECT id FROM roles WHERE name = ?').get(u.role) as any;
    if (!roleRow) continue;

    if (!existing) {
      // User baru — hash password, set is_active = 1
      const hashed = bcrypt.hashSync(u.password, 10);
      db.prepare('INSERT INTO users (username, password, full_name, role_id, is_active) VALUES (?, ?, ?, ?, 1)')
        .run(u.username, hashed, u.full_name, roleRow.id);
    } else {
      // Pastikan semua seed user selalu aktif
      db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(existing.id);
    }
    if (existing && !existing.password.startsWith('$2')) {
      // User lama dengan plain text — upgrade ke bcrypt
      const hashed = bcrypt.hashSync(u.password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, existing.id);
    }
  }
}

export default db;
