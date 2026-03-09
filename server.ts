import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import db, { initDb } from "./src/db.js";
import cors from "cors";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── STARTUP ERROR LOGGING ────────────────────────────────────────────────────
const logFile = path.join(__dirname, "startup.log");
function writeLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(logFile, line); } catch {}
}
process.on("uncaughtException", (err) => {
  writeLog(`UNCAUGHT: ${err.stack || err.message}`);
  process.exit(1);
});
process.on("unhandledRejection", (reason: any) => {
  writeLog(`UNHANDLED REJECTION: ${reason?.stack || reason}`);
});

writeLog("Starting MONITRA server...");
writeLog(`NODE_ENV=${process.env.NODE_ENV}, DB_PATH=${process.env.DB_PATH || "(default)"}, __dirname=${__dirname}`);

// ─── KODE UNIK HELPER ─────────────────────────────────────────────────────────
const KODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I yang membingungkan
function generateKodeUnik(): string {
  let kode = '';
  for (let i = 0; i < 6; i++) kode += KODE_CHARS[Math.floor(Math.random() * KODE_CHARS.length)];
  return kode;
}
function uniqueKodeUnik(): string {
  let kode = generateKodeUnik();
  while (db.prepare('SELECT id FROM users WHERE kode_unik = ?').get(kode)) kode = generateKodeUnik();
  return kode;
}

// ─── SMTP HELPERS ─────────────────────────────────────────────────────────────
function getSmtpConfig() {
  const get = (k: string) =>
    (db.prepare("SELECT value FROM system_config WHERE key=?").get(k) as any)?.value ?? "";
  return {
    host:   get("smtp_host")   || process.env.SMTP_HOST   || "",
    port:   parseInt(get("smtp_port")   || process.env.SMTP_PORT   || "587"),
    secure: (get("smtp_secure") || process.env.SMTP_SECURE || "false") === "true",
    user:   get("smtp_user")   || process.env.SMTP_USER   || "",
    pass:   get("smtp_pass")   || process.env.SMTP_PASS   || "",
    from:   get("smtp_from")   || process.env.SMTP_FROM   || "MONITRA <noreply@monitra.id>",
  };
}

async function sendEmail(to: string, subject: string, html: string) {
  const c = getSmtpConfig();
  if (!c.host || !c.user || !c.pass)
    throw new Error("Konfigurasi SMTP belum diatur. Silakan hubungi Admin.");
  const transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  await transporter.sendMail({ from: c.from, to, subject, html });
}

function emailReminderTemplate(name: string, ptList: string, today: string) {
  const date = new Date(today + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const ptRows = ptList.split(",").map(pt => pt.trim()).filter(Boolean)
    .map(pt => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #dbeafe;color:#1e3a5f;font-size:14px;font-weight:500"><span style="color:#2563eb;font-size:16px">🏢</span>${pt}</div>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 32px">
      <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">🛡️ MONITRA</div>
      <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:2px">Monitoring & Tracking Audit</div>
    </div>
    <div style="padding:32px">
      <div style="font-size:22px;margin-bottom:8px">⏰ Pengingat Laporan Harian</div>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px">
        Halo <strong>${name}</strong>,<br><br>
        Kami mengingatkan bahwa Anda <strong>belum mengisi laporan harian</strong> untuk hari ini, <strong>${date}</strong>.
      </p>
      <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:12px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">PT yang belum dilaporkan:</div>
        ${ptRows}
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">Buka MONITRA &amp; Isi Laporan →</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
        Harap segera isi laporan sebelum hari berakhir.<br>
        Untuk berhenti menerima email ini, matikan di <em>Pengaturan → Notifikasi</em>.
      </p>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
      <div style="color:#6b7280;font-size:11px">© 2025 MONITRA — Kantor Budiandru dan Rekan</div>
    </div>
  </div>
</body></html>`;
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: login required" });
  }
  const user = db.prepare("SELECT id, username, full_name, role_id FROM users WHERE id = ?").get(userId) as any;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized: invalid user" });
  }
  (req as any).currentUser = user;
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).currentUser;
    const roleRow = db.prepare("SELECT name FROM roles WHERE id = ?").get(user.role_id) as any;
    if (!roleRow || !roles.includes(roleRow.name)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    }
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // ─── PUBLIC: Login ────────────────────────────────────────────────────────
  app.post("/api/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi" });
    }

    const user = db.prepare(`
      SELECT u.*, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username = ?
    `).get(username) as any;

    if (!user) {
      return res.status(401).json({ error: "Username atau password salah" });
    }

    // Support bcrypt hash & plain text (auto-upgrade ke bcrypt saat login)
    let match = false;
    if (user.password.startsWith("$2")) {
      match = await bcrypt.compare(password, user.password);
    } else {
      match = user.password === password;
      if (match) {
        const hashed = await bcrypt.hash(password, 10);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashed, user.id);
      }
    }

    if (!match) {
      return res.status(401).json({ error: "Username atau password salah" });
    }

    const { password: _pw, ...safe } = user;
    res.json(safe);
  });

  // ─── PUBLIC: Auditor Login (Kode Unik + Email, no password) ─────────────
  app.post("/api/login/auditor", (req: Request, res: Response) => {
    const { kode_unik, email } = req.body;
    if (!kode_unik || !email) {
      return res.status(400).json({ error: "Kode Unik dan Email wajib diisi" });
    }

    const user = db.prepare(`
      SELECT u.*, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.kode_unik = ? AND r.name = 'Auditor' AND u.is_active = 1
    `).get(String(kode_unik).toUpperCase().trim()) as any;

    if (!user) {
      return res.status(401).json({ error: "Kode Unik tidak ditemukan atau bukan akun Auditor aktif" });
    }

    if (!user.email || user.email.trim() === '') {
      return res.status(401).json({ error: "Email belum terdaftar untuk akun ini. Hubungi Admin untuk menambahkan email." });
    }

    if (user.email.toLowerCase().trim() !== String(email).toLowerCase().trim()) {
      return res.status(401).json({ error: "Kode Unik atau Email tidak cocok" });
    }

    const { password: _pw, ...safe } = user;
    res.json(safe);
  });

  // ─── PROTECTED: Users ────────────────────────────────────────────────────
  app.get("/api/users", requireAuth, (_req: Request, res: Response) => {
    const users = (db.prepare(`
      SELECT u.id, u.username, u.full_name, r.name as role, u.is_active,
             COALESCE(u.email, '') as email,
             COALESCE(u.kode_unik, '') as kode_unik,
             u.supervisor_id,
             spv.full_name as supervisor_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN users spv ON u.supervisor_id = spv.id
      ORDER BY r.name, u.full_name
    `).all() as any[]).map(u => ({ ...u, is_active: u.is_active === 1 || u.is_active === true }));
    res.json(users);
  });

  // GET /api/supervisors — daftar supervisor aktif untuk dropdown
  app.get("/api/supervisors", requireAuth, (_req: Request, res: Response) => {
    const supervisors = db.prepare(`
      SELECT u.id, u.full_name
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'Supervisor' AND u.is_active = 1
      ORDER BY u.full_name
    `).all();
    res.json(supervisors);
  });

  app.get("/api/auditors", requireAuth, (_req: Request, res: Response) => {
    const auditors = db.prepare(`
      SELECT u.id, u.full_name, u.supervisor_id
      FROM users u JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'Auditor' AND u.is_active = 1
      ORDER BY u.full_name
    `).all();
    res.json(auditors);
  });

  // POST /api/users — buat akun baru (Admin only)
  app.post("/api/users", requireAuth, requireRole("Admin"), async (req: Request, res: Response) => {
    const { username, password, full_name, role, email, supervisor_id } = req.body;
    if (!username || !full_name || !role) {
      return res.status(400).json({ error: "Nama, username, dan role wajib diisi" });
    }
    if (!["Auditor", "Supervisor", "Manager", "Admin"].includes(role)) {
      return res.status(400).json({ error: "Role tidak valid" });
    }
    // Auditor login pakai Kode Unik + Email — password opsional (auto-generate jika kosong)
    const isAuditor = role === "Auditor";
    if (isAuditor && (!email || !email.includes('@'))) {
      return res.status(400).json({ error: "Email wajib diisi untuk akun Auditor" });
    }
    if (!isAuditor && (!password || password.length < 6)) {
      return res.status(400).json({ error: "Password minimal 6 karakter" });
    }
    // Cek email duplikat untuk Auditor
    if (email) {
      const emailExists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim());
      if (emailExists) return res.status(409).json({ error: "Email sudah digunakan oleh user lain" });
    }
    // Auto-generate password aman untuk Auditor (mereka tidak akan menggunakannya)
    const AUTO_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^';
    const finalPassword = isAuditor && (!password || password.length < 6)
      ? Array.from({ length: 16 }, () => AUTO_CHARS[Math.floor(Math.random() * AUTO_CHARS.length)]).join('')
      : password;
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) {
      return res.status(409).json({ error: "Username sudah digunakan" });
    }
    const roleRow = db.prepare("SELECT id FROM roles WHERE name = ?").get(role) as any;
    if (!roleRow) return res.status(400).json({ error: "Role tidak ditemukan" });
    const hashed = await bcrypt.hash(finalPassword, 10);
    const kodeUnik = uniqueKodeUnik();
    const finalEmail = email ? email.trim().toLowerCase() : null;
    const finalSpvId = (isAuditor && supervisor_id) ? Number(supervisor_id) : null;
    const result = db.prepare(
      "INSERT INTO users (username, password, full_name, role_id, is_active, kode_unik, email, supervisor_id) VALUES (?, ?, ?, ?, 1, ?, ?, ?)"
    ).run(username, hashed, full_name, roleRow.id, kodeUnik, finalEmail, finalSpvId);
    res.status(201).json({ id: result.lastInsertRowid, username, full_name, role, kode_unik: kodeUnik, email: finalEmail, supervisor_id: finalSpvId });
  });

  // PATCH /api/users/:id — edit data user (Admin only)
  app.patch("/api/users/:id", requireAuth, requireRole("Admin"), (req: Request, res: Response) => {
    const { full_name, role, is_active, email, supervisor_id } = req.body;
    const existing = db.prepare("SELECT id, role_id FROM users WHERE id = ?").get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: "User tidak ditemukan" });
    if (role) {
      const roleRow = db.prepare("SELECT id FROM roles WHERE name = ?").get(role) as any;
      if (!roleRow) return res.status(400).json({ error: "Role tidak valid" });
      db.prepare("UPDATE users SET role_id = ? WHERE id = ?").run(roleRow.id, req.params.id);
    }
    if (full_name) {
      db.prepare("UPDATE users SET full_name = ? WHERE id = ?").run(full_name, req.params.id);
    }
    if (is_active !== undefined) {
      db.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(is_active ? 1 : 0, req.params.id);
    }
    // Update email jika dikirim (boleh dikosongkan untuk hapus email)
    if (email !== undefined) {
      const trimmed = email ? email.trim().toLowerCase() : null;
      if (trimmed) {
        const emailExists = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(trimmed, req.params.id);
        if (emailExists) return res.status(409).json({ error: "Email sudah digunakan oleh user lain" });
      }
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(trimmed, req.params.id);
    }
    // Update supervisor_id — null untuk hapus assignment
    if (supervisor_id !== undefined) {
      const spvId = supervisor_id ? Number(supervisor_id) : null;
      db.prepare("UPDATE users SET supervisor_id = ? WHERE id = ?").run(spvId, req.params.id);
    }
    res.json({ success: true });
  });

  // PATCH /api/users/:id/password — reset password
  // Admin bisa reset siapa saja, user biasa hanya bisa ganti password sendiri (perlu old_password)
  app.patch("/api/users/:id/password", requireAuth, async (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;
    const isAdmin = roleRow?.name === "Admin";
    const isSelf = String(currentUser.id) === String(req.params.id);

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "Tidak diizinkan mengubah password user lain" });
    }

    const target = db.prepare("SELECT id, password FROM users WHERE id = ?").get(req.params.id) as any;
    if (!target) return res.status(404).json({ error: "User tidak ditemukan" });

    const { new_password, old_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: "Password baru minimal 6 karakter" });
    }

    // Kalau bukan admin, wajib cek old_password
    if (!isAdmin) {
      if (!old_password) return res.status(400).json({ error: "Password lama wajib diisi" });
      const match = await bcrypt.compare(old_password, target.password);
      if (!match) return res.status(401).json({ error: "Password lama tidak sesuai" });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashed, req.params.id);
    res.json({ success: true });
  });

  // PATCH /api/users/:id/regenerate-kode — Admin regenerate kode unik auditor
  app.patch("/api/users/:id/regenerate-kode", requireAuth, requireRole("Admin"), (req: Request, res: Response) => {
    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: "User tidak ditemukan" });
    const kodeUnik = uniqueKodeUnik();
    db.prepare("UPDATE users SET kode_unik = ? WHERE id = ?").run(kodeUnik, req.params.id);
    res.json({ kode_unik: kodeUnik });
  });

  // ─── PROTECTED: PTs ──────────────────────────────────────────────────────
  app.get("/api/pts", requireAuth, (_req: Request, res: Response) => {
    // Hanya tampilkan PT yang belum diarsipkan — PT Archived punya endpoint sendiri
    const pts = db.prepare("SELECT * FROM pts WHERE status != 'Archived' ORDER BY id DESC").all();
    res.json(pts);
  });

  app.post("/api/pts", requireAuth, requireRole("Admin", "Supervisor", "Manager"), (req: Request, res: Response) => {
    const { nama_pt, alamat, PIC, periode_start, periode_end } = req.body;
    if (!nama_pt || !PIC) {
      return res.status(400).json({ error: "Nama PT dan PIC wajib diisi" });
    }
    const result = db.prepare(`
      INSERT INTO pts (nama_pt, alamat, PIC, periode_start, periode_end)
      VALUES (?, ?, ?, ?, ?)
    `).run(nama_pt, alamat || "", PIC, periode_start, periode_end);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  // FIX #4 — Edit PT
  app.patch("/api/pts/:id", requireAuth, requireRole("Admin", "Supervisor", "Manager"), (req: Request, res: Response) => {
    const { nama_pt, alamat, PIC, periode_start, periode_end, status } = req.body;
    const existing = db.prepare("SELECT id FROM pts WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "PT tidak ditemukan" });
    db.prepare(`
      UPDATE pts SET nama_pt=?, alamat=?, PIC=?, periode_start=?, periode_end=?, status=?
      WHERE id=?
    `).run(nama_pt, alamat, PIC, periode_start, periode_end, status, req.params.id);
    res.json({ success: true });
  });

  // ─── PROTECTED: Assignments ───────────────────────────────────────────────
  app.get("/api/assignments", requireAuth, (_req: Request, res: Response) => {
    const assignments = db.prepare(`
      SELECT a.*, p.nama_pt, u.full_name as auditor_name
      FROM audit_assignments a
      JOIN pts p ON a.pt_id = p.id
      JOIN users u ON a.auditor_id = u.id
      WHERE p.archived_at IS NULL
      ORDER BY a.id DESC
    `).all();
    res.json(assignments);
  });

  app.post("/api/assignments", requireAuth, requireRole("Admin", "Supervisor", "Manager"), (req: Request, res: Response) => {
    const { pt_id, auditor_id, start_date, end_date } = req.body;
    if (!pt_id || !auditor_id) {
      return res.status(400).json({ error: "PT dan Auditor wajib dipilih" });
    }
    const result = db.prepare(`
      INSERT INTO audit_assignments (pt_id, auditor_id, start_date, end_date)
      VALUES (?, ?, ?, ?)
    `).run(pt_id, auditor_id, start_date, end_date);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.get("/api/my-assignments/:userId", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const assignments = db.prepare(`
      SELECT a.*, p.nama_pt
      FROM audit_assignments a
      JOIN pts p ON a.pt_id = p.id
      WHERE a.auditor_id = ? AND a.status = 'Active' AND p.archived_at IS NULL
    `).all(currentUser.id);
    res.json(assignments);
  });

  // ─── PROTECTED: Daily Reports ─────────────────────────────────────────────
  app.get("/api/reports", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;

    const reports = roleRow.name === "Auditor"
      ? db.prepare(`
          SELECT r.*, p.nama_pt, u.full_name as auditor_name, a.auditor_id
          FROM daily_reports r
          JOIN audit_assignments a ON r.assignment_id = a.id
          JOIN pts p ON a.pt_id = p.id
          JOIN users u ON a.auditor_id = u.id
          WHERE a.auditor_id = ? AND p.archived_at IS NULL
          ORDER BY r.tanggal DESC, r.created_at DESC
        `).all(currentUser.id)
      : db.prepare(`
          SELECT r.*, p.nama_pt, u.full_name as auditor_name, a.auditor_id
          FROM daily_reports r
          JOIN audit_assignments a ON r.assignment_id = a.id
          JOIN pts p ON a.pt_id = p.id
          JOIN users u ON a.auditor_id = u.id
          WHERE p.archived_at IS NULL
          ORDER BY r.tanggal DESC, r.created_at DESC
        `).all();

    res.json(reports);
  });

  app.post("/api/reports", requireAuth, requireRole("Auditor", "Supervisor", "Manager"), (req: Request, res: Response) => {
    const {
      assignment_id, tanggal, jam_mulai, jam_selesai,
      area_diaudit, deskripsi_pekerjaan, temuan, progress, kendala, status
    } = req.body;

    if (!assignment_id || !jam_mulai || !jam_selesai || !area_diaudit || !deskripsi_pekerjaan) {
      return res.status(400).json({ error: "Field wajib belum lengkap" });
    }

    const currentUser = (req as any).currentUser;
    const assignment = db.prepare(
      "SELECT id FROM audit_assignments WHERE id = ? AND auditor_id = ?"
    ).get(assignment_id, currentUser.id);
    if (!assignment) {
      return res.status(403).json({ error: "Assignment tidak valid atau bukan milik Anda" });
    }

    const result = db.prepare(`
      INSERT INTO daily_reports (
        assignment_id, tanggal, jam_mulai, jam_selesai, area_diaudit,
        deskripsi_pekerjaan, temuan, progress, kendala, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assignment_id,
      tanggal || new Date().toISOString().split("T")[0],
      jam_mulai, jam_selesai, area_diaudit,
      deskripsi_pekerjaan, temuan || "", progress || 0, kendala || "", status || "Ongoing"
    );

    broadcast({ type: "NEW_REPORT", data: { id: result.lastInsertRowid } });
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.patch("/api/reports/:id/approve", requireAuth, requireRole("Supervisor", "Manager", "Admin"), (req: Request, res: Response) => {
    const { status, supervisor_notes } = req.body;
    const currentUser = (req as any).currentUser;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    // Ambil info auditor + nama PT untuk notifikasi yang kaya
    const report = db.prepare(`
      SELECT r.id, a.auditor_id, a.pt_id, p.nama_pt
      FROM daily_reports r
      JOIN audit_assignments a ON r.assignment_id = a.id
      JOIN pts p ON a.pt_id = p.id
      WHERE r.id = ?
    `).get(req.params.id) as any;

    if (!report) return res.status(404).json({ error: "Laporan tidak ditemukan" });

    db.prepare(`
      UPDATE daily_reports
      SET approval_status=?, approved_by=?, approved_at=CURRENT_TIMESTAMP, supervisor_notes=?
      WHERE id=?
    `).run(status, currentUser.id, supervisor_notes || "", req.params.id);

    // Kirim notifikasi TARGETED hanya ke auditor pemilik laporan
    sendToUser(report.auditor_id, {
      type: "REPORT_STATUS_CHANGED",
      data: {
        reportId:        String(req.params.id),
        status,
        ptName:          report.nama_pt,
        supervisorNotes: supervisor_notes || "",
        supervisorName:  currentUser.full_name,
      },
    });

    // Broadcast umum ke semua (supervisor/admin bisa refresh data)
    broadcast({ type: "REPORT_UPDATED", data: { id: req.params.id, status } });

    // Cek apakah PT ini sudah memenuhi syarat auto-archive (hanya kalau Approved)
    if (status === "Approved") {
      checkAndAutoArchivePT(report.pt_id);
    }

    res.json({ success: true });
  });

  // ─── PROTECTED: Stats ─────────────────────────────────────────────────────
  // Stats bersifat role-aware:
  //   Auditor  → hanya melihat data PT & laporan miliknya sendiri
  //   Admin/Supervisor → melihat semua data
  app.get("/api/stats", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;
    const isAuditor = roleRow?.name === "Auditor";

    let totalPT: number, totalAuditors: number | null, pendingApprovals: number,
        totalFindings: number, totalReports: number | null, ptProgress: any[];

    if (isAuditor) {
      // ── Auditor: hanya data PT yang dia tangani ──────────────────────────
      totalPT = (db.prepare(`
        SELECT COUNT(DISTINCT pt_id) as count
        FROM audit_assignments
        WHERE auditor_id = ? AND status = 'Active'
      `).get(currentUser.id) as any).count;

      totalAuditors = null; // tidak relevan untuk auditor

      totalReports = (db.prepare(`
        SELECT COUNT(*) as count
        FROM daily_reports r
        JOIN audit_assignments a ON r.assignment_id = a.id
        WHERE a.auditor_id = ?
      `).get(currentUser.id) as any).count;

      pendingApprovals = (db.prepare(`
        SELECT COUNT(*) as count
        FROM daily_reports r
        JOIN audit_assignments a ON r.assignment_id = a.id
        WHERE a.auditor_id = ? AND r.approval_status = 'Pending'
      `).get(currentUser.id) as any).count;

      totalFindings = (db.prepare(`
        SELECT COUNT(*) as count
        FROM daily_reports r
        JOIN audit_assignments a ON r.assignment_id = a.id
        WHERE a.auditor_id = ? AND r.temuan IS NOT NULL AND r.temuan != ''
      `).get(currentUser.id) as any).count;

      // Progress hanya PT yang dia tangani, berdasarkan laporan terbaru miliknya
      ptProgress = db.prepare(`
        SELECT p.nama_pt,
          COALESCE((
            SELECT r2.progress
            FROM daily_reports r2
            JOIN audit_assignments a2 ON r2.assignment_id = a2.id
            WHERE a2.pt_id = p.id AND a2.auditor_id = ?
            ORDER BY r2.tanggal DESC, r2.created_at DESC
            LIMIT 1
          ), 0) as avg_progress
        FROM pts p
        JOIN audit_assignments aa ON p.id = aa.pt_id
        WHERE aa.auditor_id = ? AND aa.status = 'Active' AND p.status = 'Active'
        GROUP BY p.id
        ORDER BY p.id
      `).all(currentUser.id, currentUser.id) as any[];

    } else {
      // ── Admin / Supervisor: semua data ───────────────────────────────────
      totalPT = (db.prepare("SELECT COUNT(*) as count FROM pts WHERE status='Active'").get() as any).count;
      totalAuditors = (db.prepare("SELECT COUNT(DISTINCT auditor_id) as count FROM audit_assignments WHERE status='Active'").get() as any).count;
      totalReports = null;
      pendingApprovals = (db.prepare("SELECT COUNT(*) as count FROM daily_reports WHERE approval_status='Pending'").get() as any).count;
      totalFindings = (db.prepare("SELECT COUNT(*) as count FROM daily_reports WHERE temuan IS NOT NULL AND temuan != ''").get() as any).count;

      ptProgress = db.prepare(`
        SELECT p.nama_pt,
          COALESCE((
            SELECT r2.progress
            FROM daily_reports r2
            JOIN audit_assignments a2 ON r2.assignment_id = a2.id
            WHERE a2.pt_id = p.id
            ORDER BY r2.tanggal DESC, r2.created_at DESC
            LIMIT 1
          ), 0) as avg_progress
        FROM pts p
        WHERE p.status = 'Active'
        ORDER BY p.id
      `).all() as any[];
    }

    res.json({ totalPT, totalAuditors, pendingApprovals, totalFindings, ptProgress, totalReports, isAuditor });
  });

  // ─── PROTECTED: Progress per Auditor per PT ───────────────────────────────
  app.get("/api/progress", requireAuth, requireRole("Admin", "Supervisor", "Manager"), (req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT
        p.id           AS pt_id,
        p.nama_pt,
        p.periode_start,
        p.periode_end,
        u.id           AS auditor_id,
        u.full_name    AS auditor_name,
        aa.id          AS assignment_id,
        COALESCE((
          SELECT r.progress FROM daily_reports r
          WHERE r.assignment_id = aa.id
          ORDER BY r.tanggal DESC, r.created_at DESC LIMIT 1
        ), 0)          AS latest_progress,
        (SELECT COUNT(*) FROM daily_reports r WHERE r.assignment_id = aa.id)                                     AS total_reports,
        (SELECT COUNT(*) FROM daily_reports r WHERE r.assignment_id = aa.id AND r.approval_status = 'Approved') AS approved_reports,
        (SELECT COUNT(*) FROM daily_reports r WHERE r.assignment_id = aa.id AND r.approval_status = 'Pending')  AS pending_reports,
        (SELECT COUNT(*) FROM daily_reports r WHERE r.assignment_id = aa.id AND r.approval_status = 'Rejected') AS rejected_reports,
        (SELECT r.tanggal FROM daily_reports r WHERE r.assignment_id = aa.id ORDER BY r.tanggal DESC LIMIT 1)   AS latest_report_date
      FROM audit_assignments aa
      JOIN pts p  ON aa.pt_id      = p.id
      JOIN users u ON aa.auditor_id = u.id
      WHERE aa.status = 'Active' AND p.status = 'Active'
      ORDER BY p.nama_pt, u.full_name
    `).all();
    res.json(rows);
  });

  // ─── AUTO-ARCHIVE HELPER ─────────────────────────────────────────────────────
  // Dipanggil setiap kali SPV approve laporan.
  // Kondisi auto-archive:
  //   1. Semua assignment aktif PT ini punya latest progress = 100%
  //   2. Tidak ada laporan berstatus Pending
  //   3. Minimal ada 1 laporan yang sudah Approved
  function checkAndAutoArchivePT(ptId: number) {
    // Cek ada assignment aktif
    const assignments = db.prepare(`
      SELECT id FROM audit_assignments WHERE pt_id = ? AND status = 'Active'
    `).all(ptId) as any[];
    if (assignments.length === 0) return;

    // Cek: tidak boleh ada laporan Pending
    const pending = (db.prepare(`
      SELECT COUNT(*) as cnt
      FROM daily_reports r
      JOIN audit_assignments aa ON r.assignment_id = aa.id
      WHERE aa.pt_id = ? AND r.approval_status = 'Pending'
    `).get(ptId) as any).cnt;
    if (pending > 0) return;

    // Cek: semua assignment harus punya latest progress = 100%
    const progRows = db.prepare(`
      SELECT aa.id,
        COALESCE((
          SELECT r.progress FROM daily_reports r
          WHERE r.assignment_id = aa.id
          ORDER BY r.tanggal DESC, r.created_at DESC LIMIT 1
        ), 0) AS latest_progress
      FROM audit_assignments aa
      WHERE aa.pt_id = ? AND aa.status = 'Active'
    `).all(ptId) as any[];

    const allHundred = progRows.length > 0 && progRows.every(a => a.latest_progress >= 100);
    if (!allHundred) return;

    // Cek: minimal ada 1 laporan Approved
    const approved = (db.prepare(`
      SELECT COUNT(*) as cnt
      FROM daily_reports r
      JOIN audit_assignments aa ON r.assignment_id = aa.id
      WHERE aa.pt_id = ? AND r.approval_status = 'Approved'
    `).get(ptId) as any).cnt;
    if (approved === 0) return;

    // Semua kondisi terpenuhi → arsipkan PT otomatis
    const changed = db.prepare(`
      UPDATE pts
      SET status = 'Archived', archived_at = datetime('now','localtime')
      WHERE id = ? AND status = 'Active'
    `).run(ptId);

    if (changed.changes > 0) {
      const pt = db.prepare("SELECT nama_pt FROM pts WHERE id = ?").get(ptId) as any;
      broadcast({ type: "PT_AUTO_ARCHIVED", data: { ptId, ptName: pt?.nama_pt } });
    }
  }

  // ─── PROTECTED: PT Archive ───────────────────────────────────────────────────
  // GET /api/archive — semua PT yang sudah diarsipkan + statistik lengkap
  // GET /api/archive — role-aware:
  //   Auditor  → hanya PT yang dia ikut assignment-nya
  //   Admin/SPV → semua PT yang diarsipkan
  app.get("/api/archive", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow     = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;
    const isAuditor   = roleRow?.name === "Auditor";

    const rows = isAuditor
      ? db.prepare(`
          SELECT
            p.*,
            COUNT(DISTINCT aa.auditor_id)                                                   AS total_auditors,
            GROUP_CONCAT(DISTINCT u.full_name)                                              AS auditor_names,
            COUNT(DISTINCT r.id)                                                            AS total_reports,
            SUM(CASE WHEN r.approval_status = 'Approved' THEN 1 ELSE 0 END)                AS approved_reports,
            SUM(CASE WHEN r.temuan IS NOT NULL AND r.temuan != '' THEN 1 ELSE 0 END)       AS total_findings,
            COALESCE((
              SELECT r2.progress FROM daily_reports r2
              JOIN audit_assignments aa2 ON r2.assignment_id = aa2.id
              WHERE aa2.pt_id = p.id AND aa2.auditor_id = ?
              ORDER BY r2.tanggal DESC, r2.created_at DESC LIMIT 1
            ), 0)                                                                           AS final_progress
          FROM pts p
          JOIN audit_assignments aa ON p.id = aa.pt_id AND aa.auditor_id = ?
          LEFT JOIN users u ON aa.auditor_id = u.id
          LEFT JOIN daily_reports r ON aa.id = r.assignment_id
          WHERE p.status = 'Archived'
          GROUP BY p.id
          ORDER BY p.archived_at DESC
        `).all(currentUser.id, currentUser.id)
      : db.prepare(`
          SELECT
            p.*,
            COUNT(DISTINCT aa.auditor_id)                                                   AS total_auditors,
            GROUP_CONCAT(DISTINCT u.full_name)                                              AS auditor_names,
            COUNT(DISTINCT r.id)                                                            AS total_reports,
            SUM(CASE WHEN r.approval_status = 'Approved' THEN 1 ELSE 0 END)                AS approved_reports,
            SUM(CASE WHEN r.temuan IS NOT NULL AND r.temuan != '' THEN 1 ELSE 0 END)       AS total_findings,
            COALESCE((
              SELECT r2.progress FROM daily_reports r2
              JOIN audit_assignments aa2 ON r2.assignment_id = aa2.id
              WHERE aa2.pt_id = p.id
              ORDER BY r2.tanggal DESC, r2.created_at DESC LIMIT 1
            ), 0)                                                                           AS final_progress
          FROM pts p
          LEFT JOIN audit_assignments aa ON p.id = aa.pt_id
          LEFT JOIN users u ON aa.auditor_id = u.id
          LEFT JOIN daily_reports r ON aa.id = r.assignment_id
          WHERE p.status = 'Archived'
          GROUP BY p.id
          ORDER BY p.archived_at DESC
        `).all();

    res.json(rows);
  });

  // GET /api/archive/reports/:ptId — laporan harian untuk 1 PT arsip (role-aware)
  app.get("/api/archive/reports/:ptId", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow     = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;
    const isAuditor   = roleRow?.name === "Auditor";

    // Pastikan PT memang diarsipkan
    const pt = db.prepare("SELECT id FROM pts WHERE id = ? AND status = 'Archived'").get(req.params.ptId);
    if (!pt) return res.status(404).json({ error: "PT tidak ditemukan di arsip" });

    const reports = isAuditor
      ? db.prepare(`
          SELECT r.*,
            u.full_name AS auditor_name,
            p.nama_pt
          FROM daily_reports r
          JOIN audit_assignments a ON r.assignment_id = a.id
          JOIN users u ON a.auditor_id = u.id
          JOIN pts p ON a.pt_id = p.id
          WHERE a.pt_id = ? AND a.auditor_id = ?
          ORDER BY r.tanggal DESC, r.created_at DESC
        `).all(req.params.ptId, currentUser.id)
      : db.prepare(`
          SELECT r.*,
            u.full_name AS auditor_name,
            p.nama_pt
          FROM daily_reports r
          JOIN audit_assignments a ON r.assignment_id = a.id
          JOIN users u ON a.auditor_id = u.id
          JOIN pts p ON a.pt_id = p.id
          WHERE a.pt_id = ?
          ORDER BY r.tanggal DESC, r.created_at DESC
        `).all(req.params.ptId);

    res.json(reports);
  });

  // PATCH /api/pts/:id/archive — arsipkan manual
  app.patch("/api/pts/:id/archive", requireAuth, requireRole("Admin", "Supervisor", "Manager"), (req: Request, res: Response) => {
    const pt = db.prepare("SELECT id, nama_pt FROM pts WHERE id = ? AND status != 'Archived'").get(req.params.id) as any;
    if (!pt) return res.status(404).json({ error: "PT tidak ditemukan atau sudah diarsipkan" });
    db.prepare("UPDATE pts SET status = 'Archived', archived_at = datetime('now','localtime') WHERE id = ?")
      .run(req.params.id);
    broadcast({ type: "PT_ARCHIVED", data: { ptId: pt.id, ptName: pt.nama_pt } });
    res.json({ success: true });
  });

  // PATCH /api/pts/:id/restore — pulihkan PT dari arsip
  app.patch("/api/pts/:id/restore", requireAuth, requireRole("Admin", "Supervisor", "Manager"), (req: Request, res: Response) => {
    const pt = db.prepare("SELECT id, nama_pt FROM pts WHERE id = ? AND status = 'Archived'").get(req.params.id) as any;
    if (!pt) return res.status(404).json({ error: "PT tidak ditemukan di arsip" });
    db.prepare("UPDATE pts SET status = 'Active', archived_at = NULL WHERE id = ?")
      .run(req.params.id);
    res.json({ success: true });
  });

  // ─── SPV / Manager Daily Log ─────────────────────────────────────────────────
  app.get("/api/spv-reports", requireAuth, requireRole("Supervisor", "Manager", "Admin"), (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;
    const isAdmin = roleRow?.name === "Admin";
    const rows = isAdmin
      ? db.prepare(`
          SELECT r.*, u.full_name AS author_name, ro.name AS author_role
          FROM spv_daily_reports r
          JOIN users u ON r.user_id = u.id
          JOIN roles ro ON u.role_id = ro.id
          ORDER BY r.tanggal DESC, r.created_at DESC
        `).all()
      : db.prepare(`
          SELECT r.*, u.full_name AS author_name, ro.name AS author_role
          FROM spv_daily_reports r
          JOIN users u ON r.user_id = u.id
          JOIN roles ro ON u.role_id = ro.id
          WHERE r.user_id = ?
          ORDER BY r.tanggal DESC, r.created_at DESC
        `).all(currentUser.id);
    res.json(rows);
  });

  app.post("/api/spv-reports", requireAuth, requireRole("Supervisor", "Manager"), (req: Request, res: Response) => {
    const { tanggal, judul, isi, kegiatan, kendala, rencana } = req.body;
    if (!judul?.trim() || !isi?.trim()) {
      return res.status(400).json({ error: "Judul dan isi wajib diisi" });
    }
    const currentUser = (req as any).currentUser;
    const result = db.prepare(`
      INSERT INTO spv_daily_reports (user_id, tanggal, judul, isi, kegiatan, kendala, rencana)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      currentUser.id,
      tanggal || new Date().toISOString().split("T")[0],
      judul.trim(), isi.trim(),
      kegiatan?.trim() || "", kendala?.trim() || "", rencana?.trim() || ""
    );
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.patch("/api/spv-reports/:id", requireAuth, requireRole("Supervisor", "Manager"), (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const existing = db.prepare("SELECT id FROM spv_daily_reports WHERE id = ? AND user_id = ?").get(req.params.id, currentUser.id);
    if (!existing) return res.status(404).json({ error: "Catatan tidak ditemukan atau bukan milik Anda" });
    const { tanggal, judul, isi, kegiatan, kendala, rencana } = req.body;
    if (!judul?.trim() || !isi?.trim()) {
      return res.status(400).json({ error: "Judul dan isi wajib diisi" });
    }
    db.prepare(`
      UPDATE spv_daily_reports
      SET tanggal = ?, judul = ?, isi = ?, kegiatan = ?, kendala = ?, rencana = ?,
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(tanggal, judul.trim(), isi.trim(), kegiatan?.trim() || "", kendala?.trim() || "", rencana?.trim() || "", req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/spv-reports/:id", requireAuth, requireRole("Supervisor", "Manager"), (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const existing = db.prepare("SELECT id FROM spv_daily_reports WHERE id = ? AND user_id = ?").get(req.params.id, currentUser.id);
    if (!existing) return res.status(404).json({ error: "Catatan tidak ditemukan atau bukan milik Anda" });
    db.prepare("DELETE FROM spv_daily_reports WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // ─── PROTECTED: Visit Logs ───────────────────────────────────────────────────
  // GET /api/visits — role-aware: Auditor = data sendiri, SPV/Admin = semua
  app.get("/api/visits", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;
    const isAuditor = roleRow?.name === "Auditor";

    const rows = isAuditor
      ? db.prepare(`
          SELECT v.*, p.nama_pt, u.full_name AS auditor_name
          FROM visit_logs v
          JOIN audit_assignments aa ON v.assignment_id = aa.id
          JOIN pts p  ON v.pt_id      = p.id
          JOIN users u ON v.auditor_id = u.id
          WHERE v.auditor_id = ?
          ORDER BY v.timestamp DESC
        `).all(currentUser.id)
      : db.prepare(`
          SELECT v.*, p.nama_pt, u.full_name AS auditor_name
          FROM visit_logs v
          JOIN audit_assignments aa ON v.assignment_id = aa.id
          JOIN pts p  ON v.pt_id      = p.id
          JOIN users u ON v.auditor_id = u.id
          ORDER BY v.timestamp DESC
        `).all();

    res.json(rows);
  });

  // POST /api/visits — Auditor / Supervisor check-in / check-out
  app.post("/api/visits", requireAuth, requireRole("Auditor", "Supervisor", "Manager"), (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const { assignment_id, type, photo, latitude, longitude, notes } = req.body;

    if (!assignment_id || !["check_in", "check_out"].includes(type)) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }
    if (!photo) {
      return res.status(400).json({ error: "Foto bukti wajib disertakan" });
    }

    // Pastikan assignment milik auditor ini dan masih aktif
    const assignment = db.prepare(`
      SELECT aa.id, aa.pt_id, p.nama_pt
      FROM audit_assignments aa
      JOIN pts p ON aa.pt_id = p.id
      WHERE aa.id = ? AND aa.auditor_id = ? AND aa.status = 'Active'
    `).get(assignment_id, currentUser.id) as any;

    if (!assignment) {
      return res.status(403).json({ error: "Assignment tidak valid atau bukan milik Anda" });
    }

    const result = db.prepare(`
      INSERT INTO visit_logs (assignment_id, auditor_id, pt_id, type, photo, latitude, longitude, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assignment_id,
      currentUser.id,
      assignment.pt_id,
      type,
      photo,
      latitude  ?? null,
      longitude ?? null,
      notes     || ""
    );

    // Broadcast ke SPV/Admin agar dashboard real-time update
    broadcast({
      type: "VISIT_CHECKIN",
      data: {
        auditorName: currentUser.full_name,
        ptName:      assignment.nama_pt,
        visitType:   type,
      },
    });

    res.status(201).json({ id: result.lastInsertRowid });
  });

  // PATCH /api/visits/:id/status — SPV/Admin approve or reject
  app.patch("/api/visits/:id/status", requireAuth, requireRole("Supervisor", "Manager", "Admin"), (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const { status, supervisor_notes } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    const visit = db.prepare(
      "SELECT id, auditor_id FROM visit_logs WHERE id = ?"
    ).get(req.params.id) as any;

    if (!visit) return res.status(404).json({ error: "Kunjungan tidak ditemukan" });

    db.prepare(`
      UPDATE visit_logs
      SET approval_status = ?, supervisor_notes = ?, approved_by = ?
      WHERE id = ?
    `).run(status, supervisor_notes || "", currentUser.id, req.params.id);

    // Kirim notifikasi ke auditor pemilik kunjungan
    sendToUser(visit.auditor_id, {
      type: "VISIT_STATUS_CHANGED",
      data: {
        status,
        supervisorNotes: supervisor_notes || "",
        supervisorName:  currentUser.full_name,
      },
    });

    res.json({ success: true });
  });

  // ─── PROTECTED: User Profile Self-Service ──────────────────────────────────
  // Ambil profil sendiri (termasuk email)
  app.get("/api/users/:id/profile", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;
    const isAdmin = roleRow?.name === "Admin";
    const isSelf = String(currentUser.id) === String(req.params.id);
    if (!isAdmin && !isSelf) return res.status(403).json({ error: "Tidak diizinkan" });
    const profile = db.prepare(
      "SELECT id, full_name, email, email_reminder FROM users WHERE id = ?"
    ).get(req.params.id) as any;
    if (!profile) return res.status(404).json({ error: "User tidak ditemukan" });
    res.json({ ...profile, email_reminder: profile.email_reminder !== 0 });
  });

  // Update profil sendiri (full_name, email, email_reminder) — tidak perlu Admin
  app.patch("/api/users/:id/profile", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    const roleRow = db.prepare("SELECT name FROM roles WHERE id = ?").get(currentUser.role_id) as any;
    const isAdmin = roleRow?.name === "Admin";
    const isSelf = String(currentUser.id) === String(req.params.id);
    if (!isAdmin && !isSelf) return res.status(403).json({ error: "Tidak diizinkan" });
    const { full_name, email, email_reminder } = req.body;
    if (full_name !== undefined) db.prepare("UPDATE users SET full_name=? WHERE id=?").run(full_name, req.params.id);
    if (email !== undefined)     db.prepare("UPDATE users SET email=? WHERE id=?").run(email, req.params.id);
    if (email_reminder !== undefined) db.prepare("UPDATE users SET email_reminder=? WHERE id=?").run(email_reminder ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  // ─── PROTECTED: Notifications ─────────────────────────────────────────────
  app.get("/api/notifications", requireAuth, (_req: Request, res: Response) => {
    const currentUser = (_req as any).currentUser;
    const notifs = db.prepare(
      "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50"
    ).all(currentUser.id);
    res.json(notifs);
  });

  app.patch("/api/notifications/read-all", requireAuth, (_req: Request, res: Response) => {
    const currentUser = (_req as any).currentUser;
    db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=?").run(currentUser.id);
    res.json({ success: true });
  });

  app.patch("/api/notifications/:id/read", requireAuth, (req: Request, res: Response) => {
    const currentUser = (req as any).currentUser;
    db.prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?")
      .run(req.params.id, currentUser.id);
    res.json({ success: true });
  });

  // ─── PROTECTED: SMTP Config (Admin only) ──────────────────────────────────
  app.get("/api/config", requireAuth, requireRole("Admin"), (_req: Request, res: Response) => {
    const rows = db.prepare("SELECT key, value FROM system_config").all() as any[];
    const config: Record<string, string> = {};
    rows.forEach(r => { config[r.key] = r.key === "smtp_pass" ? "••••••••" : r.value; });
    res.json(config);
  });

  app.patch("/api/config", requireAuth, requireRole("Admin"), (req: Request, res: Response) => {
    const allowed = ["smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from", "reminder_time"];
    for (const [k, v] of Object.entries(req.body)) {
      if (!allowed.includes(k)) continue;
      db.prepare(`
        INSERT INTO system_config (key, value) VALUES (?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now','localtime')
      `).run(k, v as string);
    }
    res.json({ success: true });
  });

  app.post("/api/config/test-email", requireAuth, requireRole("Admin"), async (req: Request, res: Response) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "Email tujuan wajib diisi" });
    try {
      await sendEmail(to, "✅ Test Email — MONITRA",
        `<div style="font-family:Arial;padding:24px"><h2>✅ Konfigurasi SMTP berhasil!</h2>
        <p>Email test dari MONITRA berhasil diterima.</p>
        <p style="color:#666;font-size:13px">Dikirim pada ${new Date().toLocaleString("id-ID")}</p></div>`
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Static serving: production = dist/, dev = Vite middleware
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    // SPA fallback — semua route non-API dikembalikan ke index.html
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // ─── WEBSOCKETS ───────────────────────────────────────────────────────────
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Map userId → WebSocket untuk targeted notifications
  const clientsByUser = new Map<number, WebSocket>();

  wss.on("connection", (ws) => {
    let registeredUserId: number | null = null;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Client mengirim AUTH setelah koneksi terbuka, supaya server tahu siapa dia
        if (msg.type === "AUTH" && msg.userId) {
          registeredUserId = Number(msg.userId);
          clientsByUser.set(registeredUserId, ws);
        }
      } catch { /* abaikan pesan non-JSON */ }
    });

    ws.on("close", () => {
      if (registeredUserId !== null) clientsByUser.delete(registeredUserId);
    });
    ws.on("error", () => {
      if (registeredUserId !== null) clientsByUser.delete(registeredUserId);
      ws.close();
    });
  });

  // Kirim ke semua klien yang terkoneksi
  function broadcast(message: any) {
    const payload = JSON.stringify(message);
    clientsByUser.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  }

  // Kirim ke satu user spesifik (berdasarkan userId)
  function sendToUser(userId: number, message: any) {
    const client = clientsByUser.get(userId);
    if (client?.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  // ─── NOTIFICATION HELPER ─────────────────────────────────────────────────
  function createNotif(userId: number, type: string, title: string, body: string) {
    const row = db.prepare(
      "INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)"
    ).run(userId, type, title, body);
    sendToUser(userId, {
      type: "NEW_NOTIFICATION",
      data: {
        id: Number(row.lastInsertRowid), type, title, body,
        is_read: 0, created_at: new Date().toLocaleString("id-ID"),
      },
    });
  }

  // ─── CRON: Pengingat Laporan Harian (jam 16:00 Senin–Jumat) ──────────────
  // Format: 'menit jam * * hari' (0=Minggu, 1=Senin, ..., 5=Jumat)
  cron.schedule("0 16 * * 1-5", async () => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Cari auditor aktif yang belum isi laporan hari ini, per assignment
    const auditors = db.prepare(`
      SELECT DISTINCT u.id, u.full_name, u.email, u.email_reminder,
             GROUP_CONCAT(DISTINCT p.nama_pt) as pt_list
      FROM users u
      JOIN audit_assignments aa ON aa.auditor_id = u.id
      JOIN pts p ON aa.pt_id = p.id
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'Auditor'
        AND aa.status = 'Active'
        AND p.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM daily_reports dr
          WHERE dr.assignment_id = aa.id AND dr.tanggal = ?
        )
      GROUP BY u.id
    `).all(today) as any[];

    for (const aud of auditors) {
      // 1. Notifikasi in-app
      createNotif(
        aud.id,
        "REMINDER",
        "⏰ Pengingat Laporan Harian",
        `Anda belum mengisi laporan hari ini untuk: ${aud.pt_list}`
      );

      // 2. Email (jika email diisi dan reminder diaktifkan)
      if (aud.email && aud.email_reminder !== 0) {
        try {
          await sendEmail(
            aud.email,
            "🔔 Pengingat: Laporan Harian Belum Diisi — MONITRA",
            emailReminderTemplate(aud.full_name, aud.pt_list, today)
          );
          console.log(`[MONITRA] Reminder email → ${aud.email}`);
        } catch (err: any) {
          console.error(`[MONITRA] Gagal kirim email ke ${aud.email}: ${err.message}`);
        }
      }
    }

    console.log(`[MONITRA] Daily reminder selesai: ${auditors.length} auditor belum laporan`);
  }, { timezone: "Asia/Jakarta" });
}

// Initialize DB (async/WASM) then start server — NO top-level await so require() works
initDb()
  .then(() => {
    writeLog("Database initialized OK");
    return startServer();
  })
  .catch((err: any) => {
    writeLog(`STARTUP FAILED: ${err.stack || err.message}`);
    process.exit(1);
  });
