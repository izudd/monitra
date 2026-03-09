import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import net from 'net';
// ─── CONNECTION POOL ──────────────────────────────────────────────────────────
// Force IPv4 TCP so MySQL sees connection as @'127.0.0.1' (matches user grant)
// Using stream factory: net.connect({ family: 4 }) bypasses Node.js IPv6 preference
const pool = mysql.createPool({
    stream: () => net.connect({ host: '127.0.0.1', port: 3306, family: 4 }),
    database: process.env.DB_NAME || 'u846640655_dbmonit',
    user: process.env.DB_USER || 'u846640655_usermonit',
    password: process.env.DB_PASS || 'Monitra2026',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
});
// ─── CORE HELPERS ─────────────────────────────────────────────────────────────
export async function dbRun(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return { changes: result.affectedRows, lastInsertRowid: result.insertId };
}
export async function dbGet(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows[0];
}
export async function dbAll(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}
export async function dbExec(sql) {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
        await pool.query(stmt);
    }
}
// ─── BETTER-SQLITE3 COMPATIBILITY WRAPPER ────────────────────────────────────
function prepare(sql) {
    return {
        run: (...args) => {
            const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
            return dbRun(sql, params);
        },
        get: (...args) => {
            const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
            return dbGet(sql, params);
        },
        all: (...args) => {
            const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
            return dbAll(sql, params);
        },
    };
}
const db = {
    prepare,
    exec: dbExec,
    pragma: (_) => undefined,
};
export { db };
export default db;
// ─── INIT ────────────────────────────────────────────────────────────────────
export async function initDb() {
    // Roles
    await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id   INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL
    ) CHARACTER SET utf8mb4
  `);
    // Users
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      username       VARCHAR(100) UNIQUE NOT NULL,
      password       TEXT NOT NULL,
      full_name      TEXT NOT NULL,
      role_id        INT NOT NULL,
      is_active      TINYINT(1) DEFAULT 1,
      email          VARCHAR(255) DEFAULT '',
      email_reminder TINYINT(1) DEFAULT 1,
      kode_unik      VARCHAR(20),
      supervisor_id  INT,
      FOREIGN KEY (role_id)       REFERENCES roles(id),
      FOREIGN KEY (supervisor_id) REFERENCES users(id)
    ) CHARACTER SET utf8mb4
  `);
    // SPV Daily Reports
    await pool.query(`
    CREATE TABLE IF NOT EXISTS spv_daily_reports (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      tanggal    DATE NOT NULL,
      judul      TEXT NOT NULL,
      isi        TEXT NOT NULL,
      kegiatan   TEXT DEFAULT '',
      kendala    TEXT DEFAULT '',
      rencana    TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) CHARACTER SET utf8mb4
  `);
    // Notifications
    await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      type       VARCHAR(50) NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      is_read    TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) CHARACTER SET utf8mb4
  `);
    // System Config
    await pool.query(`
    CREATE TABLE IF NOT EXISTS system_config (
      \`key\`     VARCHAR(100) PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `);
    // PTs
    await pool.query(`
    CREATE TABLE IF NOT EXISTS pts (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      nama_pt       VARCHAR(255) NOT NULL,
      alamat        TEXT,
      PIC           VARCHAR(255),
      periode_start DATE,
      periode_end   DATE,
      status        VARCHAR(50) DEFAULT 'Active',
      archived_at   DATETIME
    ) CHARACTER SET utf8mb4
  `);
    // Audit Assignments
    await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_assignments (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      pt_id       INT NOT NULL,
      auditor_id  INT NOT NULL,
      start_date  DATE,
      end_date    DATE,
      status      VARCHAR(50) DEFAULT 'Active',
      FOREIGN KEY (pt_id)      REFERENCES pts(id),
      FOREIGN KEY (auditor_id) REFERENCES users(id)
    ) CHARACTER SET utf8mb4
  `);
    // Daily Reports
    await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id                   INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id        INT NOT NULL,
      tanggal              DATE DEFAULT (CURDATE()),
      jam_mulai            VARCHAR(10),
      jam_selesai          VARCHAR(10),
      area_diaudit         TEXT,
      deskripsi_pekerjaan  TEXT,
      temuan               TEXT,
      progress             INT DEFAULT 0,
      kendala              TEXT,
      status               VARCHAR(50) DEFAULT 'Ongoing',
      approval_status      VARCHAR(50) DEFAULT 'Pending',
      approved_by          INT,
      approved_at          DATETIME,
      supervisor_notes     TEXT,
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES audit_assignments(id),
      FOREIGN KEY (approved_by)   REFERENCES users(id)
    ) CHARACTER SET utf8mb4
  `);
    // Visit Logs
    await pool.query(`
    CREATE TABLE IF NOT EXISTS visit_logs (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id    INT NOT NULL,
      auditor_id       INT NOT NULL,
      pt_id            INT NOT NULL,
      type             VARCHAR(20) NOT NULL,
      photo            TEXT,
      latitude         DOUBLE,
      longitude        DOUBLE,
      notes            TEXT DEFAULT '',
      approval_status  VARCHAR(20) DEFAULT 'Pending',
      supervisor_notes TEXT DEFAULT '',
      approved_by      INT,
      timestamp        DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES audit_assignments(id),
      FOREIGN KEY (auditor_id)    REFERENCES users(id),
      FOREIGN KEY (pt_id)         REFERENCES pts(id)
    ) CHARACTER SET utf8mb4
  `);
    // Seed roles
    for (const name of ['Admin', 'Auditor', 'Supervisor', 'Manager']) {
        await pool.query('INSERT IGNORE INTO roles (name) VALUES (?)', [name]);
    }
    // Generate kode_unik for users without one
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function makeKode() {
        let k = '';
        for (let i = 0; i < 6; i++)
            k += CHARS[Math.floor(Math.random() * CHARS.length)];
        return k;
    }
    const noKode = await dbAll("SELECT id FROM users WHERE kode_unik IS NULL OR kode_unik = ''");
    for (const u of noKode) {
        let kode = makeKode();
        while (await dbGet('SELECT id FROM users WHERE kode_unik = ?', [kode]))
            kode = makeKode();
        await dbRun('UPDATE users SET kode_unik = ? WHERE id = ?', [kode, u.id]);
    }
    // Seed default users — hanya INSERT jika belum ada, TIDAK update existing
    // (mencegah user yang sudah dihapus muncul lagi setelah restart)
    const seedUsers = [
        { username: 'admin', password: 'admin123', full_name: 'System Administrator', role: 'Admin' },
        { username: 'supervisor', password: 'supervisor123', full_name: 'John Supervisor', role: 'Supervisor' },
        { username: 'manager', password: 'manager123', full_name: 'Jane Manager', role: 'Manager' },
        { username: 'auditor1', password: 'auditor123', full_name: 'Alice Auditor', role: 'Auditor' },
        { username: 'auditor2', password: 'auditor123', full_name: 'Bob Auditor', role: 'Auditor' },
    ];
    for (const u of seedUsers) {
        const existing = await dbGet('SELECT id FROM users WHERE username = ?', [u.username]);
        if (existing)
            continue; // sudah ada — skip, jangan restore
        const roleRow = await dbGet('SELECT id FROM roles WHERE name = ?', [u.role]);
        if (!roleRow)
            continue;
        let kode = makeKode();
        while (await dbGet('SELECT id FROM users WHERE kode_unik = ?', [kode]))
            kode = makeKode();
        const hashed = bcrypt.hashSync(u.password, 10);
        await dbRun('INSERT INTO users (username, password, full_name, role_id, is_active, kode_unik) VALUES (?, ?, ?, ?, 1, ?)', [u.username, hashed, u.full_name, roleRow.id, kode]);
    }
}
