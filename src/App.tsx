/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, createContext, useContext, useCallback, CSSProperties } from 'react';
import {
  LayoutDashboard, Building2, Users, FileText,
  LogOut, Plus, AlertCircle, Clock, CheckCircle2, XCircle,
  Menu, X, Activity, Shield, TrendingUp, ChevronLeft,
  ChevronUp, ChevronDown, Edit2, Save, Wifi, WifiOff,
  UserCog, KeyRound, UserCheck, UserX, Eye, EyeOff,
  Settings, Bell, Palette, Info, Camera, AtSign, Phone, MapPin,
  Download, FileSpreadsheet, FileDown, BarChart2, Target, Award, AlertTriangle,
  Navigation, Footprints, ImageOff, Crosshair, ThumbsUp, ThumbsDown, ZoomIn,
  Archive, RotateCcw, Search, CalendarDays, BadgeCheck,
  Mail, Server, SendHorizontal, TestTube2, BellRing, BellOff, Dot,
  Copy, RefreshCw, BookOpen, Trash2, Pencil, NotebookPen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { formatDate } from './lib/utils';
import { User, PT, Assignment, DailyReport } from './types';
import logoMonitra from './logo monitra.png';

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
const T = {
  blue900: '#1e3a5f', blue800: '#1a4478', blue700: '#1a56db',
  blue600: '#1c64f2', blue500: '#3b82f6', blue100: '#dbeafe', blue50: '#eff6ff',
  gray900: '#111928', gray800: '#1f2a37', gray700: '#374151', gray600: '#4b5563',
  gray500: '#6b7280', gray400: '#9ca3af', gray300: '#d1d5db', gray200: '#e5e7eb',
  gray100: '#f3f4f6', gray50: '#f9fafb',
  green: '#057a55', greenBg: '#def7ec',
  red: '#c81e1e', redBg: '#fde8e8',
  yellow: '#92400e', yellowBg: '#fef3c7',
  white: '#ffffff', bg: '#f0f2f5', surface: '#ffffff',
  sidebarBg: '#1e3a5f', sidebarActive: '#1c64f2', sidebarHover: 'rgba(255,255,255,0.07)',
};
const MONO = "'Roboto Mono', monospace";
const SANS = "'Roboto', sans-serif";
const SIDEBAR_FULL = 220;
const SIDEBAR_MINI = 60;

// ─── THEMES ──────────────────────────────────────────────────────────────────
type ThemeKey = 'blue' | 'green' | 'purple';
const THEMES: Record<ThemeKey, Partial<typeof T>> = {
  blue: {
    blue900: '#1e3a5f', blue800: '#1a4478', blue700: '#1a56db',
    blue600: '#1c64f2', blue500: '#3b82f6', blue100: '#dbeafe', blue50: '#eff6ff',
    sidebarBg: '#1e3a5f', sidebarActive: '#1c64f2',
  },
  green: {
    blue900: '#064e3b', blue800: '#065f46', blue700: '#059669',
    blue600: '#10b981', blue500: '#34d399', blue100: '#d1fae5', blue50: '#ecfdf5',
    sidebarBg: '#064e3b', sidebarActive: '#059669',
  },
  purple: {
    blue900: '#2d1b69', blue800: '#3b1d9a', blue700: '#5521b5',
    blue600: '#6d28d9', blue500: '#8b5cf6', blue100: '#ede9fe', blue50: '#f5f3ff',
    sidebarBg: '#2d1b69', sidebarActive: '#7c3aed',
  },
};
// ─── GLOBAL CSS INJECTION ─────────────────────────────────────────────────────
(() => {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.25)} }
    @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html { scroll-behavior: smooth; }
    body { overscroll-behavior: none; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    input, button, select, textarea { touch-action: manipulation; font-family: inherit; }

    /* Thin scrollbar */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 99px; }

    /* Mobile helpers — used via className */
    @media (max-width: 767px) {
      .mob-hide    { display: none !important; }
      .mob-full    { width: 100% !important; max-width: 100% !important; }
      .mob-col     { flex-direction: column !important; }
      .mob-wrap    { flex-wrap: wrap !important; }
      .mob-p12     { padding: 12px !important; }
      .mob-p14     { padding: 14px !important; }
      .mob-scroll  { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
      .mob-sheet   {
        position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
        max-width: 100% !important; border-radius: 18px 18px 0 0 !important;
        max-height: 92vh !important; overflow-y: auto;
      }
    }
  `;
  document.head.appendChild(style);
})();

// Apply saved theme on module init (before any React render)
// Tema disimpan per-user: monitra_theme_<userId> — supaya tiap akun punya tema sendiri
const _savedThemeKey = (() => {
  try {
    const u = JSON.parse(localStorage.getItem('audit_user') || 'null');
    if (u?.id) {
      const k = localStorage.getItem(`monitra_theme_${u.id}`) as ThemeKey;
      if (k && THEMES[k]) return k;
    }
  } catch { /* ignore */ }
  return 'blue' as ThemeKey;
})();
if (THEMES[_savedThemeKey]) Object.assign(T, THEMES[_savedThemeKey]);

// ─── CONTEXT ────────────────────────────────────────────────────────────────
interface AuthCtxType {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
  themeKey: ThemeKey;
  applyTheme: (key: ThemeKey) => void;
}
const AuthContext = createContext<AuthCtxType | null>(null);
const useAuth = () => { const c = useContext(AuthContext); if (!c) throw new Error('no auth'); return c; };

// ─── MOBILE CONTEXT ──────────────────────────────────────────────────────────
const MobileContext = createContext<boolean>(false);
const useMobile = () => useContext(MobileContext);

// ─── TOAST NOTIFICATION ─────────────────────────────────────────────────────
interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info'; }
const ToastContext = createContext<(msg: string, type?: Toast['type']) => void>(() => {});
const useToast = () => useContext(ToastContext);

const ToastContainer = ({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) => (
  <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div key={t.id}
          initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', borderRadius: 8, minWidth: 260,
            background: t.type === 'success' ? T.greenBg : t.type === 'error' ? T.redBg : T.blue50,
            border: `1px solid ${t.type === 'success' ? '#a7f3d0' : t.type === 'error' ? '#fca5a5' : T.blue100}`,
            color: t.type === 'success' ? T.green : t.type === 'error' ? T.red : T.blue700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13, fontFamily: SANS,
          }}
        >
          {t.type === 'success' ? <CheckCircle2 size={15} /> : t.type === 'error' ? <XCircle size={15} /> : <Activity size={15} />}
          <span style={{ flex: 1 }}>{t.msg}</span>
          <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={14} /></button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ─── AUDIT NOTIFICATION (floating rich card for approval events) ─────────────
interface AuditNotif {
  id: number;
  status: 'Approved' | 'Rejected';
  ptName: string;
  supervisorNotes: string;
  supervisorName: string;
}

const AuditNotifContainer = ({ notifs, remove }: { notifs: AuditNotif[]; remove: (id: number) => void }) => (
  <div style={{ position: 'fixed', top: 72, right: 20, zIndex: 9998, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, width: 'calc(100vw - 40px)' }}>
    <AnimatePresence>
      {notifs.map(n => {
        const isApproved = n.status === 'Approved';
        const accentColor = isApproved ? T.green : T.red;
        const bgColor     = isApproved ? T.greenBg : T.redBg;
        const borderColor = isApproved ? '#a7f3d0' : '#fca5a5';
        return (
          <motion.div key={n.id}
            initial={{ opacity: 0, x: 80, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{
              background: T.white, borderRadius: 14, overflow: 'hidden', fontFamily: SANS,
              boxShadow: `0 12px 40px rgba(0,0,0,0.16), 0 0 0 1px ${borderColor}`,
              borderLeft: `5px solid ${accentColor}`,
            }}
          >
            {/* ── Header ── */}
            <div style={{ padding: '14px 14px 10px 14px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: bgColor, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 0 3px ${borderColor}`,
              }}>
                {isApproved
                  ? <CheckCircle2 size={20} style={{ color: accentColor }} />
                  : <XCircle     size={20} style={{ color: accentColor }} />
                }
              </div>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.gray900 }}>
                    Laporan {isApproved ? 'Disetujui' : 'Ditolak'}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                    background: bgColor, color: accentColor, border: `1px solid ${borderColor}`,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {isApproved ? '✓ Approved' : '✗ Rejected'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.gray500, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={11} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: T.gray700 }}>{n.ptName}</span>
                  <span style={{ color: T.gray300 }}>·</span>
                  <Shield size={11} style={{ flexShrink: 0 }} />
                  <span>{n.supervisorName}</span>
                </div>
              </div>
              {/* Dismiss */}
              <button onClick={() => remove(n.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: T.gray400, padding: 4, borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}>
                <X size={14} />
              </button>
            </div>

            {/* ── Supervisor Notes ── */}
            {n.supervisorNotes && (
              <div style={{ margin: '0 14px 12px 14px', padding: '9px 12px', borderRadius: 8, background: bgColor, borderLeft: `3px solid ${accentColor}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  💬 Catatan Supervisor
                </div>
                <div style={{ fontSize: 12, color: T.gray700, fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{n.supervisorNotes}"
                </div>
              </div>
            )}

            {/* ── Auto-dismiss progress bar ── */}
            <motion.div
              initial={{ scaleX: 1 }} animate={{ scaleX: 0 }}
              transition={{ duration: 8, ease: 'linear' }}
              style={{ height: 3, background: accentColor, transformOrigin: 'left', borderRadius: '0 0 0 0' }}
            />
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);

// ─── API HELPER ──────────────────────────────────────────────────────────────
// Semua request otomatis sisipkan X-User-Id header untuk auth
function apiFetch(url: string, userId: number | null | undefined, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (userId) headers['X-User-Id'] = String(userId);
  return fetch(url, { ...options, headers });
}

// ─── SHARED STYLES ───────────────────────────────────────────────────────────
const card = (extra?: CSSProperties): CSSProperties => ({
  background: T.white, borderRadius: 8, border: `1px solid ${T.gray200}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', ...extra,
});
const inp: CSSProperties = {
  width: '100%', background: T.white, border: `1px solid ${T.gray300}`,
  borderRadius: 6, color: T.gray900, fontFamily: SANS, fontSize: 14,
  padding: '9px 12px', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
};
const labelSt: CSSProperties = {
  display: 'block', fontFamily: SANS, fontSize: 13, fontWeight: 500,
  color: T.gray700, marginBottom: 6,
};

// ─── BADGE ───────────────────────────────────────────────────────────────────
const Badge = ({ children, type = 'default' }: { children: React.ReactNode; type?: string }) => {
  const s: Record<string, CSSProperties> = {
    success: { background: T.greenBg, color: T.green, border: '1px solid #a7f3d0' },
    danger:  { background: T.redBg,   color: T.red,   border: '1px solid #fca5a5' },
    warning: { background: T.yellowBg, color: T.yellow, border: '1px solid #fcd34d' },
    info:    { background: T.blue50,   color: T.blue700, border: `1px solid ${T.blue100}` },
    default: { background: T.gray100,  color: T.gray600, border: `1px solid ${T.gray200}` },
  };
  return <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4, ...s[type] || s.default }}>{children}</span>;
};

const approvalBadge = (s: string) => {
  if (s === 'Approved') return <Badge type="success">● Approved</Badge>;
  if (s === 'Rejected') return <Badge type="danger">● Rejected</Badge>;
  return <Badge type="warning">● Pending</Badge>;
};

// ─── BUTTONS ────────────────────────────────────────────────────────────────
const BtnPrimary = ({ children, onClick, type = 'button', fullWidth = false, sm = false, disabled = false }: any) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: disabled ? T.gray300 : T.blue700, color: T.white,
    fontFamily: SANS, fontWeight: 500, fontSize: sm ? 12 : 13,
    padding: sm ? '6px 14px' : '9px 18px', borderRadius: 6, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', width: fullWidth ? '100%' : undefined,
    transition: 'background 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  }}
    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = T.blue600; }}
    onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = disabled ? T.gray300 : T.blue700; }}
  >{children}</button>
);

const BtnSecondary = ({ children, onClick, type = 'button', sm = false, disabled = false, style: extraStyle = {} }: any) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: T.white, color: disabled ? T.gray400 : T.gray700, fontFamily: SANS, fontWeight: 500,
    fontSize: sm ? 12 : 13, padding: sm ? '5px 12px' : '8px 16px',
    borderRadius: 6, border: `1px solid ${T.gray300}`, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, transition: 'background 0.15s', ...extraStyle,
  }}
    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = T.gray50; }}
    onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = T.white; }}
  >{children}</button>
);

// ─── INPUT COMPONENTS ────────────────────────────────────────────────────────
const focus = { borderColor: T.blue700, boxShadow: `0 0 0 3px ${T.blue50}` };
const blur  = { borderColor: T.gray300, boxShadow: 'none' };

const Input = ({ value, onChange, type = 'text', placeholder = '', required = false, name = '' }: any) => (
  <input type={type} value={value} name={name} onChange={onChange} placeholder={placeholder} required={required}
    style={inp} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
);

const Textarea = ({ value, onChange, rows = 3, placeholder = '', required = false }: any) => (
  <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} required={required}
    style={{ ...inp, resize: 'vertical' }} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
);

const Select = ({ value, onChange, children, required = false }: any) => (
  <select value={value} onChange={onChange} required={required}
    style={{ ...inp, cursor: 'pointer' }} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)}>
    {children}
  </select>
);

const Field = ({ label, children, half = false }: { label: string; children: React.ReactNode; half?: boolean }) => (
  <div style={{ marginBottom: 16, flex: half ? '1 1 45%' : '1 1 100%' }}>
    <label style={labelSt}>{label}</label>
    {children}
  </div>
);

// ─── MODAL ──────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, subtitle, children, wide = false }: any) => (
  <AnimatePresence>
    {open && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(17,25,40,0.55)', backdropFilter: 'blur(4px)' }}>
        <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.18 }}
          style={{ ...card(), width: '100%', maxWidth: wide ? 640 : 480 }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.gray200}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.gray50 }}>
            <div>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 15, color: T.gray900 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12, color: T.gray500, marginTop: 2 }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.gray400, padding: 4, borderRadius: 4, display: 'flex' }}><X size={18} /></button>
          </div>
          <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>{children}</div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// ─── STAT CARD ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, bg, note }: any) => (
  <motion.div whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} transition={{ duration: 0.15 }}
    style={{ ...card({ padding: 20 }) }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.gray500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 500, color: T.gray900, lineHeight: 1 }}>{value ?? '—'}</div>
        {note && <div style={{ fontSize: 12, color: T.gray400, marginTop: 6 }}>{note}</div>}
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
  </motion.div>
);

// ─── PAGE HEADER ─────────────────────────────────────────────────────────────
const PageHeader = ({ title, breadcrumb, children }: any) => (
  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
    {breadcrumb && (
      <div style={{ fontSize: 12, color: T.gray400, marginBottom: 4 }}>
        <span>Dashboard</span> <span style={{ margin: '0 2px' }}>›</span>
        <span style={{ color: T.gray600 }}>{breadcrumb}</span>
      </div>
    )}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <h1 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: T.gray900, margin: 0 }}>{title}</h1>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </div>
    <div style={{ height: 1, background: T.gray200, marginTop: 16 }} />
  </motion.div>
);

// ─── DATA TABLE ───────────────────────────────────────────────────────────────
const DataTable = ({ cols, children, title }: any) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={card()}>
    {title && (
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.gray200}`, background: T.gray50 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.gray800 }}>{title}</span>
      </div>
    )}
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: T.gray50, borderBottom: `1px solid ${T.gray200}` }}>
            {cols.map((c: string, i: number) => (
              <th key={i} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.gray500, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  </motion.div>
);

const Td = ({ children, mono = false, sub }: any) => (
  <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}`, verticalAlign: 'middle' }}>
    {mono
      ? <span style={{ fontFamily: MONO, fontSize: 12, color: T.gray600 }}>{children}</span>
      : <div>
          <div style={{ fontSize: 13, color: T.gray800 }}>{children}</div>
          {sub && <div style={{ fontSize: 11, color: T.gray400, marginTop: 2 }}>{sub}</div>}
        </div>
    }
  </td>
);

// ─── SIDEBAR ITEM ────────────────────────────────────────────────────────────
const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: any) => (
  <button onClick={onClick} title={collapsed ? label : undefined} style={{
    display: 'flex', alignItems: 'center', width: '100%',
    padding: collapsed ? '10px 0' : '10px 14px', justifyContent: collapsed ? 'center' : 'flex-start',
    gap: 10, borderRadius: 6, marginBottom: 2,
    background: active ? T.sidebarActive : 'transparent',
    border: 'none', color: active ? T.white : 'rgba(255,255,255,0.65)',
    fontFamily: SANS, fontSize: 13, fontWeight: active ? 500 : 400,
    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
  }}
    onMouseEnter={e => { if (!active) { (e.currentTarget).style.background = T.sidebarHover; (e.currentTarget).style.color = T.white; } }}
    onMouseLeave={e => { if (!active) { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.color = 'rgba(255,255,255,0.65)'; } }}
  >
    <Icon size={17} style={{ flexShrink: 0 }} />
    {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
  </button>
);

// ─── PROGRESS RING (SVG animated circle) ─────────────────────────────────────
const ProgressRing = ({ value, size = 80, stroke = 8 }: { value: number; size?: number; stroke?: number }) => {
  const clr = value >= 80 ? T.green : value >= 50 ? T.blue700 : value >= 30 ? '#d97706' : T.red;
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.gray100} strokeWidth={stroke} />
        <motion.circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={clr} strokeWidth={stroke}
          strokeDasharray={circ} strokeLinecap="round"
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: size * 0.21, color: clr, lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: size * 0.12, color: T.gray400, marginTop: 1 }}>%</span>
      </div>
    </div>
  );
};

// ─── PT ARCHIVE PAGE ──────────────────────────────────────────────────────────
const PTArchive = () => {
  const { user } = useAuth();
  const toast     = useToast();
  const isMobile  = useMobile();
  const isAuditor = user?.role === 'Auditor';

  const [data,        setData]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [fYear,       setFYear]       = useState('');
  const [fMonth,      setFMonth]      = useState('');
  const [restoring,   setRestoring]   = useState<number | null>(null);

  // Expandable reports state
  const [expandedPT,    setExpandedPT]    = useState<number | null>(null);
  const [ptReports,     setPtReports]     = useState<Record<number, any[]>>({});
  const [loadingReps,   setLoadingReps]   = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/archive', user?.id);
      if (r.ok) setData(await r.json());
    } catch {} finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Expand/collapse laporan untuk sebuah PT
  const toggleReports = async (ptId: number) => {
    if (expandedPT === ptId) { setExpandedPT(null); return; }
    setExpandedPT(ptId);
    if (ptReports[ptId]) return; // sudah di-cache
    setLoadingReps(ptId);
    try {
      const r = await apiFetch(`/api/archive/reports/${ptId}`, user?.id);
      if (r.ok) {
        const reports = await r.json();
        setPtReports(prev => ({ ...prev, [ptId]: reports }));
      }
    } catch { toast('Gagal memuat laporan', 'error'); }
    finally { setLoadingReps(null); }
  };

  // Restore PT ke Active (Admin/SPV only)
  const restore = async (id: number, name: string) => {
    setRestoring(id);
    try {
      const r = await apiFetch(`/api/pts/${id}/restore`, user?.id, { method: 'PATCH' });
      if (!r.ok) throw new Error();
      toast(`✅ PT "${name}" berhasil dipulihkan ke Active`, 'success');
      setData(prev => prev.filter(p => p.id !== id));
    } catch { toast('Gagal memulihkan PT', 'error'); } finally { setRestoring(null); }
  };

  const years = ([...new Set(data.map((p: any) => (p.archived_at ?? '').slice(0, 4)).filter((y: string) => y.length === 4))] as string[]).sort((a, b) => b.localeCompare(a));

  const filtered = data.filter(p => {
    const q = search.toLowerCase();
    if (q && !p.nama_pt?.toLowerCase().includes(q) && !p.PIC?.toLowerCase().includes(q) && !p.alamat?.toLowerCase().includes(q)) return false;
    if (fYear  && !(p.archived_at || '').startsWith(fYear)) return false;
    if (fMonth && (p.archived_at || '').slice(5, 7) !== fMonth) return false;
    return true;
  });

  const fmtPeriode = (s: string, e: string) => {
    const fmt = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '?';
    return (!s && !e) ? '—' : `${fmt(s)} — ${fmt(e)}`;
  };
  const fmtTs = (ts: string) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const inp: CSSProperties = { width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 6, border: `1.5px solid ${T.gray300}`, outline: 'none', background: T.white, color: T.gray800, boxSizing: 'border-box' };

  const approvalColor = (s: string) =>
    s === 'Approved' ? { bg: T.greenBg, color: T.green } :
    s === 'Rejected' ? { bg: T.redBg,   color: T.red   } :
    { bg: T.yellowBg, color: T.yellow };

  return (
    <div>
      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Archive size={17} style={{ color: T.white }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: T.gray900 }}>
              {isAuditor ? 'Arsip Laporan Saya' : 'Arsip PT'}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: T.gray500 }}>
              {isAuditor
                ? 'PT yang sudah selesai diaudit beserta seluruh laporan harian Anda'
                : 'PT yang telah selesai diaudit — otomatis masuk arsip saat progress 100% & semua laporan Approved'}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            {[
              { label: 'PT Diarsipkan',  value: data.length,                                                                                          icon: Archive,      color: T.blue700 },
              { label: 'Tahun Ini',      value: data.filter(p => (p.archived_at||'').startsWith(new Date().getFullYear().toString())).length,          icon: CalendarDays, color: T.green },
              { label: 'Total Laporan',  value: data.reduce((s, p) => s + (p.total_reports  || 0), 0),                                               icon: FileText,     color: '#7c3aed' },
              { label: 'Total Temuan',   value: data.reduce((s, p) => s + (p.total_findings || 0), 0),                                               icon: AlertTriangle, color: '#d97706' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: T.white, borderRadius: 8, border: `1px solid ${T.gray200}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <s.icon size={15} style={{ color: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 18, fontWeight: 700, color: T.gray900 }}>{s.value}</span>
                <span style={{ fontSize: 11, color: T.gray500 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{ background: T.white, borderRadius: 8, border: `1px solid ${T.gray200}`, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama PT, PIC, alamat..." style={{ ...inp, paddingLeft: 32 }} />
        </div>
        <select value={fYear}  onChange={e => setFYear(e.target.value)}  style={{ ...inp, width: 110, flex: '0 0 110px' }}>
          <option value="">Semua Tahun</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={fMonth} onChange={e => setFMonth(e.target.value)} style={{ ...inp, width: 130, flex: '0 0 130px' }}>
          <option value="">Semua Bulan</option>
          {monthNames.map((m, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        {(search || fYear || fMonth) && (
          <button onClick={() => { setSearch(''); setFYear(''); setFMonth(''); }}
            style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${T.gray300}`, background: T.white, fontSize: 12, color: T.gray600, cursor: 'pointer' }}>Reset</button>
        )}
        <span style={{ fontSize: 12, color: T.gray400, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{filtered.length} PT</span>
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 10 }}>
          <Archive size={28} style={{ color: T.blue700 }} /><span style={{ fontSize: 13, color: T.gray400 }}>Memuat arsip...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: T.white, borderRadius: 10, border: `1px solid ${T.gray200}`, padding: '52px 24px', textAlign: 'center' }}>
          <Archive size={44} style={{ color: T.gray200, marginBottom: 14 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T.gray500, marginBottom: 6 }}>
            {search || fYear || fMonth ? 'Tidak ada hasil pencarian' : 'Belum ada PT yang diarsipkan'}
          </div>
          <div style={{ fontSize: 12, color: T.gray400, maxWidth: 340, margin: '0 auto' }}>
            PT otomatis masuk arsip saat progress 100% dan semua laporan disetujui SPV
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(pt => {
            const archivedAt = pt.archived_at ? new Date(pt.archived_at) : null;
            const auditors: string[] = pt.auditor_names ? pt.auditor_names.split(',').map((s: string) => s.trim()) : [];
            const isExpanded = expandedPT === pt.id;
            const reps: any[] = ptReports[pt.id] || [];

            return (
              <motion.div key={pt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: T.white, borderRadius: 10, border: `1px solid ${T.gray200}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

                {/* ── Card Header (dark) ── */}
                <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a4478 100%)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.nama_pt}</div>
                      {pt.alamat && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.alamat}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
                      <Archive size={10} style={{ color: 'rgba(255,255,255,0.7)' }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>ARSIP</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, background: '#ecfdf5', border: '1px solid #6ee7b7' }}>
                      <BadgeCheck size={11} style={{ color: T.green }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: T.green }}>100% Selesai</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                      Diarsipkan: {archivedAt ? archivedAt.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                    </span>
                  </div>
                </div>

                {/* ── Card Body ── */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Info + stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '8px 10px', background: T.gray50, borderRadius: 7 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>PIC</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.gray700 }}>{pt.PIC || '—'}</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: T.gray50, borderRadius: 7 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Periode Audit</div>
                      <div style={{ fontSize: 11, color: T.gray700 }}>{fmtPeriode(pt.periode_start, pt.periode_end)}</div>
                    </div>
                  </div>

                  {/* Stats mini */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Auditor',  value: pt.total_auditors  || 0, color: T.blue700 },
                      { label: 'Laporan',  value: pt.total_reports   || 0, color: '#7c3aed' },
                      { label: 'Approved', value: pt.approved_reports|| 0, color: T.green   },
                      { label: 'Temuan',   value: pt.total_findings  || 0, color: '#d97706' },
                    ].map(s => (
                      <div key={s.label} style={{ flex: '1 1 56px', textAlign: 'center', padding: '6px 4px', background: T.gray50, borderRadius: 6 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: T.gray400, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Auditor chips */}
                  {auditors.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {auditors.map((name, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: T.blue50, color: T.blue700, fontWeight: 500, border: `1px solid ${T.blue100}` }}>{name}</span>
                      ))}
                    </div>
                  )}

                  {/* ── Tombol Lihat Laporan ── */}
                  <button onClick={() => toggleReports(pt.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '9px 0', borderRadius: 7, border: `1.5px solid ${isExpanded ? T.blue700 : T.gray300}`, background: isExpanded ? T.blue50 : T.white, color: isExpanded ? T.blue700 : T.gray700, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                    <FileText size={13} />
                    {loadingReps === pt.id ? 'Memuat laporan...' : isExpanded ? 'Sembunyikan Laporan' : `Lihat ${pt.total_reports || 0} Laporan Harian`}
                    {loadingReps !== pt.id && <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />}
                  </button>

                  {/* ── Expandable Laporan List ── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                        <div style={{ borderTop: `1px solid ${T.gray100}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {reps.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: T.gray400 }}>Tidak ada laporan tercatat</div>
                          ) : reps.map(r => {
                            const ac = approvalColor(r.approval_status);
                            return (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 0, border: `1px solid ${T.gray200}`, borderRadius: 8, overflow: 'hidden' }}>
                                {/* Left accent stripe */}
                                <div style={{ width: 3, background: r.approval_status === 'Approved' ? T.green : r.approval_status === 'Rejected' ? T.red : T.gray300, flexShrink: 0, alignSelf: 'stretch' }} />
                                {/* Date block */}
                                <div style={{ width: 46, padding: '10px 6px', background: T.gray50, textAlign: 'center', flexShrink: 0 }}>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: T.gray800, lineHeight: 1 }}>
                                    {r.tanggal ? new Date(r.tanggal).getDate() : '—'}
                                  </div>
                                  <div style={{ fontSize: 9, color: T.gray400, textTransform: 'uppercase', marginTop: 2 }}>
                                    {r.tanggal ? new Date(r.tanggal).toLocaleDateString('id-ID', { month: 'short' }) : ''}
                                  </div>
                                </div>
                                {/* Main info */}
                                <div style={{ flex: 1, padding: '8px 10px', minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: T.gray800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{r.area_diaudit}</span>
                                    {!isAuditor && r.auditor_name && (
                                      <span style={{ fontSize: 10, color: T.gray500 }}>— {r.auditor_name}</span>
                                    )}
                                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: ac.bg, color: ac.color, fontWeight: 600, marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                      {r.approval_status}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {/* Progress bar mini */}
                                    <div style={{ flex: 1, height: 4, background: T.gray100, borderRadius: 99, overflow: 'hidden', maxWidth: 120 }}>
                                      <div style={{ height: '100%', width: `${r.progress || 0}%`, background: T.green, borderRadius: 99 }} />
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: T.green, fontFamily: MONO, flexShrink: 0 }}>{r.progress || 0}%</span>
                                    <span style={{ fontSize: 10, color: T.gray400, flexShrink: 0 }}>{r.jam_mulai}–{r.jam_selesai}</span>
                                    {r.temuan && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#fef3c7', color: '#92400e', flexShrink: 0 }}>⚠ Temuan</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Restore button — Admin/SPV only */}
                  {!isAuditor && (
                    <button onClick={() => restore(pt.id, pt.nama_pt)} disabled={restoring === pt.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '8px 0', borderRadius: 7, border: `1.5px solid ${T.gray300}`, background: T.white, color: T.gray700, fontSize: 12, fontWeight: 600, cursor: restoring === pt.id ? 'wait' : 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget).style.background = T.gray50; (e.currentTarget).style.borderColor = T.gray400; }}
                      onMouseLeave={e => { (e.currentTarget).style.background = T.white; (e.currentTarget).style.borderColor = T.gray300; }}>
                      <RotateCcw size={13} style={{ color: T.blue700 }} />
                      {restoring === pt.id ? 'Memulihkan...' : 'Pulihkan ke Aktif'}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── VISIT LOGS PAGE ──────────────────────────────────────────────────────────
const VisitLogs = () => {
  const { user }  = useAuth();
  const toast     = useToast();
  const isAuditor = user?.role === 'Auditor';
  // SPV & Manager juga bisa Check In/Out seperti Auditor
  const canSubmit = user?.role === 'Auditor' || user?.role === 'Supervisor' || user?.role === 'Manager';

  // ── data ──────────────────────────────────────────────────────────────────
  const [visits,      setVisits]      = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);   // for auditor/spv dropdown
  const [auditorList, setAuditorList] = useState<any[]>([]);   // for spv filter
  const [ptList,      setPtList]      = useState<any[]>([]);   // for spv filter

  // ── check-in/out modal ────────────────────────────────────────────────────
  const [modal,      setModal]      = useState<false | 'check_in' | 'check_out'>(false);
  const [selAssign,  setSelAssign]  = useState('');
  const [photo,      setPhoto]      = useState<string | null>(null);
  const [gps,        setGps]        = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoad,    setGpsLoad]    = useState(false);
  const [visitNote,  setVisitNote]  = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── review modal (SPV/Admin) ──────────────────────────────────────────────
  const [reviewItem,  setReviewItem]  = useState<any | null>(null);
  const [reviewNote,  setReviewNote]  = useState('');
  const [reviewing,   setReviewing]   = useState(false);

  // ── photo lightbox ────────────────────────────────────────────────────────
  const [lightbox, setLightbox] = useState<string | null>(null);

  // ── SPV filters ───────────────────────────────────────────────────────────
  const [fAuditor, setFAuditor] = useState('');
  const [fPT,      setFPT]      = useState('');
  const [fDate,    setFDate]    = useState('');
  const [fType,    setFType]    = useState('');

  // ── load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/visits', user?.id);
      if (r.ok) setVisits(await r.json());
    } catch {} finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    load();
    // Auditor: ambil penugasan sendiri; SPV/Manager: ambil semua assignment tim mereka
    if (canSubmit) {
      const assignUrl = isAuditor ? `/api/my-assignments/${user?.id}` : '/api/assignments';
      apiFetch(assignUrl, user?.id)
        .then(r => r.json()).then(setAssignments).catch(() => {});
    }
    // SPV & Admin: ambil daftar auditor & PT untuk filter panel
    if (!isAuditor) {
      Promise.all([
        apiFetch('/api/auditors', user?.id).then(r => r.json()),
        apiFetch('/api/pts', user?.id).then(r => r.json()),
      ]).then(([a, p]) => { setAuditorList(a); setPtList(p); }).catch(() => {});
    }
  }, [load, isAuditor, canSubmit, user?.id]);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const getGPS = () => {
    if (!navigator.geolocation) { toast('GPS tidak didukung di browser ini', 'error'); return; }
    setGpsLoad(true);
    navigator.geolocation.getCurrentPosition(
      p => { setGps({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsLoad(false); },
      () => { toast('Gagal mendapatkan lokasi GPS', 'error'); setGpsLoad(false); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // ── photo resize via canvas ───────────────────────────────────────────────
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast('File harus gambar', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        const MAX = 800;
        let [w, h] = [img.width, img.height];
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        cv.width = w; cv.height = h;
        cv.getContext('2d')!.drawImage(img, 0, 0, w, h);
        setPhoto(cv.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ── submit check-in/out ───────────────────────────────────────────────────
  const submitVisit = async () => {
    if (!selAssign) { toast('Pilih PT terlebih dahulu', 'error'); return; }
    if (!photo)     { toast('Foto bukti wajib diambil', 'error');  return; }
    setSubmitting(true);
    try {
      const r = await apiFetch('/api/visits', user?.id, {
        method: 'POST',
        body: JSON.stringify({
          assignment_id: Number(selAssign),
          type:      modal,
          photo,
          latitude:  gps?.lat ?? null,
          longitude: gps?.lng ?? null,
          notes:     visitNote,
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast(modal === 'check_in' ? '✅ Check In berhasil dicatat!' : '✅ Check Out berhasil dicatat!', 'success');
      closeModal(); load();
    } catch (e: any) {
      toast(e.message || 'Gagal menyimpan kunjungan', 'error');
    } finally { setSubmitting(false); }
  };

  const closeModal = () => { setModal(false); setSelAssign(''); setPhoto(null); setGps(null); setVisitNote(''); };

  // ── submit review ─────────────────────────────────────────────────────────
  const submitReview = async (status: 'Approved' | 'Rejected') => {
    setReviewing(true);
    try {
      const r = await apiFetch(`/api/visits/${reviewItem.id}/status`, user?.id, {
        method: 'PATCH',
        body: JSON.stringify({ status, supervisor_notes: reviewNote }),
      });
      if (!r.ok) throw new Error();
      toast(`Kunjungan ${status === 'Approved' ? 'disetujui ✅' : 'ditolak ❌'}`, 'success');
      setReviewItem(null); setReviewNote(''); load();
    } catch { toast('Gagal memperbarui status', 'error'); } finally { setReviewing(false); }
  };

  // ── helpers ───────────────────────────────────────────────────────────────
  const fmtTs = (ts: string) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };
  const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
  const today   = new Date().toISOString().split('T')[0];

  const badgeColor = (s: string) =>
    s === 'Approved' ? { bg: T.greenBg, color: T.green } :
    s === 'Rejected' ? { bg: T.redBg,   color: T.red }   :
    { bg: T.yellowBg, color: T.yellow };

  const typeLabel = (t: string) => t === 'check_in' ? 'Check In' : 'Check Out';
  const typeColor = (t: string) => t === 'check_in'
    ? { bg: '#ecfdf5', color: '#065f46' }
    : { bg: '#eff6ff', color: '#1e40af' };

  // Untuk SPV: hanya auditor yang di-assign ke SPV ini
  const isSupervisor = user?.role === 'Supervisor';
  const myAuditorIds = isSupervisor
    ? new Set(auditorList.filter((a: any) => a.supervisor_id === user?.id).map((a: any) => a.id))
    : null;

  // filtered list for SPV
  const filtered = visits.filter(v => {
    // SPV hanya lihat auditor yang assigned ke mereka
    if (isSupervisor && myAuditorIds && myAuditorIds.size > 0 && !myAuditorIds.has(v.auditor_id)) return false;
    if (fAuditor && String(v.auditor_id) !== fAuditor) return false;
    if (fPT      && String(v.pt_id)      !== fPT)      return false;
    if (fDate    && !(v.timestamp || '').startsWith(fDate)) return false;
    if (fType    && v.type !== fType)                   return false;
    return true;
  });

  // Daftar auditor untuk filter panel (SPV hanya lihat auditornya sendiri)
  const filteredAuditorList = isSupervisor && myAuditorIds && myAuditorIds.size > 0
    ? auditorList.filter((a: any) => myAuditorIds.has(a.id))
    : auditorList;

  // today's pending reviews count for SPV
  const pendingCount = visits.filter(v => v.approval_status === 'Pending').length;

  // ── shared style helpers ──────────────────────────────────────────────────
  const inp: CSSProperties = {
    width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 6,
    border: `1.5px solid ${T.gray300}`, outline: 'none', background: T.white,
    color: T.gray800, boxSizing: 'border-box',
  };

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.gray900 }}>
            {isAuditor ? 'Kunjungan Saya' : canSubmit ? 'Kunjungan & Monitor' : 'Monitor Kunjungan'}
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: T.gray500 }}>
            {isAuditor ? 'Rekam setiap kunjungan ke lokasi PT dengan bukti foto & GPS'
            : canSubmit ? 'Rekam kunjungan Anda & pantau kunjungan seluruh tim ke lokasi PT'
                        : 'Pantau dan verifikasi bukti kunjungan ke lokasi PT'}
          </p>
        </div>
        {canSubmit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setModal('check_in');  setSelAssign(assignments.length === 1 ? String(assignments[0].id) : ''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', background: T.green, color: T.white, fontSize: 13, fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
              <Navigation size={14} /> Check In
            </button>
            <button onClick={() => { setModal('check_out'); setSelAssign(assignments.length === 1 ? String(assignments[0].id) : ''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', background: T.blue700, color: T.white, fontSize: 13, fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
              <Footprints size={14} /> Check Out
            </button>
          </div>
        )}
        {!isAuditor && pendingCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 8, background: T.yellowBg, border: `1px solid ${T.yellow}` }}>
            <AlertTriangle size={14} style={{ color: T.yellow }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.yellow }}>{pendingCount} kunjungan menunggu verifikasi</span>
          </div>
        )}
      </div>

      {/* ── SPV STAT CARDS ── */}
      {!isAuditor && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Kunjungan',  value: visits.length,                                             icon: MapPin,       color: T.blue700 },
            { label: 'Hari Ini',         value: visits.filter(v => (v.timestamp||'').startsWith(today)).length, icon: Clock,    color: T.green },
            { label: 'Menunggu Review',  value: pendingCount,                                              icon: AlertCircle,  color: '#d97706' },
            { label: 'Sudah Disetujui',  value: visits.filter(v => v.approval_status === 'Approved').length, icon: CheckCircle2, color: T.green },
          ].map(s => (
            <div key={s.label} style={{ ...card(), padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.gray900, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: T.gray500, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SPV FILTER BAR ── */}
      {!isAuditor && (
        <div style={{ ...card(), padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={fAuditor} onChange={e => setFAuditor(e.target.value)} style={{ ...inp, width: 160 }}>
            <option value="">Semua Auditor</option>
            {filteredAuditorList.map((a: any) => <option key={a.id} value={String(a.id)}>{a.full_name}</option>)}
          </select>
          <select value={fPT} onChange={e => setFPT(e.target.value)} style={{ ...inp, width: 160 }}>
            <option value="">Semua PT</option>
            {ptList.map((p: any) => <option key={p.id} value={String(p.id)}>{p.nama_pt}</option>)}
          </select>
          <select value={fType} onChange={e => setFType(e.target.value)} style={{ ...inp, width: 130 }}>
            <option value="">Semua Tipe</option>
            <option value="check_in">Check In</option>
            <option value="check_out">Check Out</option>
          </select>
          <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={{ ...inp, width: 145 }} />
          {(fAuditor || fPT || fDate || fType) && (
            <button onClick={() => { setFAuditor(''); setFPT(''); setFDate(''); setFType(''); }}
              style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${T.gray300}`, background: T.white, fontSize: 12, color: T.gray600, cursor: 'pointer' }}>
              Reset
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: T.gray400 }}>{filtered.length} data</span>
        </div>
      )}

      {/* ── VISIT LIST ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
          <MapPin size={22} style={{ color: T.blue700 }} />
          <span style={{ fontSize: 13, color: T.gray400 }}>Memuat data kunjungan...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card(), padding: 48, textAlign: 'center' }}>
          <Footprints size={40} style={{ color: T.gray300, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: T.gray500 }}>Belum ada kunjungan</div>
          {isAuditor && <div style={{ fontSize: 12, color: T.gray400, marginTop: 4 }}>Klik tombol "Check In" untuk mencatat kunjungan pertama</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(v => {
            const sc = badgeColor(v.approval_status);
            const tc = typeColor(v.type);
            return (
              <motion.div key={v.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{ ...card(), padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                  {/* Color strip */}
                  <div style={{ width: 4, background: v.type === 'check_in' ? T.green : T.blue700, flexShrink: 0 }} />

                  {/* Photo thumbnail */}
                  <div style={{ width: 76, flexShrink: 0, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: v.photo ? 'pointer' : 'default', overflow: 'hidden' }}
                    onClick={() => v.photo && setLightbox(v.photo)}>
                    {v.photo
                      ? <img src={v.photo} alt="bukti" style={{ width: 76, height: 76, objectFit: 'cover' }} />
                      : <ImageOff size={20} style={{ color: T.gray300 }} />
                    }
                    {v.photo && (
                      <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.4)', borderRadius: 4, padding: '2px 4px' }}>
                        <ZoomIn size={10} style={{ color: T.white }} />
                      </div>
                    )}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: tc.bg, color: tc.color }}>{typeLabel(v.type)}</span>
                      {!isAuditor && <span style={{ fontSize: 13, fontWeight: 600, color: T.gray800 }}>{v.auditor_name}</span>}
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.gray800 }}>{v.nama_pt}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, marginLeft: 'auto' }}>{v.approval_status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.gray500 }}>
                        <Clock size={11} /> {fmtTs(v.timestamp)}
                      </span>
                      {v.latitude && v.longitude && (
                        <a href={mapsUrl(v.latitude, v.longitude)} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.blue700, textDecoration: 'none', fontWeight: 500 }}>
                          <Crosshair size={11} /> Lihat Lokasi
                        </a>
                      )}
                      {v.notes && (
                        <span style={{ fontSize: 12, color: T.gray500, fontStyle: 'italic' }}>"{v.notes}"</span>
                      )}
                    </div>
                    {v.supervisor_notes && v.supervisor_notes !== '' && (
                      <div style={{ marginTop: 6, padding: '5px 10px', background: T.gray50, borderRadius: 5, borderLeft: `3px solid ${T.gray300}`, fontSize: 12, color: T.gray600, fontStyle: 'italic' }}>
                        💬 {v.supervisor_notes}
                      </div>
                    )}
                  </div>

                  {/* SPV review button */}
                  {!isAuditor && v.approval_status === 'Pending' && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderLeft: `1px solid ${T.gray100}` }}>
                      <button onClick={() => { setReviewItem(v); setReviewNote(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6, border: `1px solid ${T.blue700}`, background: T.blue50, color: T.blue700, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        <CheckCircle2 size={13} /> Review
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ══════════ CHECK-IN / CHECK-OUT MODAL ══════════ */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 20 }}
              style={{ background: T.white, borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.gray100}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: modal === 'check_in' ? '#ecfdf5' : T.blue50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {modal === 'check_in' ? <Navigation size={16} style={{ color: T.green }} /> : <Footprints size={16} style={{ color: T.blue700 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.gray900 }}>{modal === 'check_in' ? 'Check In Kunjungan' : 'Check Out Kunjungan'}</div>
                  <div style={{ fontSize: 11, color: T.gray400 }}>Rekam bukti kehadiran di lokasi PT</div>
                </div>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.gray400 }}><X size={18} /></button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* PT selector */}
                {assignments.length > 1 && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.gray600, display: 'block', marginBottom: 5 }}>PT / Penugasan *</label>
                    <select value={selAssign} onChange={e => setSelAssign(e.target.value)} style={inp}>
                      <option value="">— Pilih PT —</option>
                      {assignments.map((a: any) => (
                        <option key={a.id} value={String(a.id)}>
                          {isAuditor ? a.nama_pt : `${a.nama_pt}${a.auditor_name ? ` — ${a.auditor_name}` : ''}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Photo capture */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.gray600, display: 'block', marginBottom: 5 }}>Foto Bukti Kunjungan *</label>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                    style={{ display: 'none' }} />
                  {!photo ? (
                    <button onClick={() => fileRef.current?.click()}
                      style={{ width: '100%', height: 110, border: `2px dashed ${T.gray300}`, borderRadius: 8, background: T.gray50, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Camera size={24} style={{ color: T.gray400 }} />
                      <span style={{ fontSize: 12, color: T.gray500 }}>Klik untuk ambil foto / upload gambar</span>
                    </button>
                  ) : (
                    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.gray200}` }}>
                      <img src={photo} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                      <button onClick={() => setPhoto(null)}
                        style={{ position: 'absolute', top: 7, right: 7, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={13} style={{ color: T.white }} />
                      </button>
                    </div>
                  )}
                </div>

                {/* GPS */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.gray600, display: 'block', marginBottom: 5 }}>Lokasi GPS (opsional)</label>
                  {gps ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: '#ecfdf5', borderRadius: 7, border: `1px solid #6ee7b7` }}>
                      <Crosshair size={13} style={{ color: T.green, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontFamily: MONO, color: '#065f46', flex: 1 }}>{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</span>
                      <button onClick={() => setGps(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.gray400, padding: 0 }}><X size={12} /></button>
                    </div>
                  ) : (
                    <button onClick={getGPS} disabled={gpsLoad}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 7, border: `1.5px solid ${T.gray300}`, background: T.white, cursor: 'pointer', fontSize: 12, color: T.gray700, fontWeight: 500 }}>
                      <Crosshair size={13} style={{ color: gpsLoad ? T.gray400 : T.blue700 }} />
                      {gpsLoad ? 'Mengambil lokasi...' : 'Ambil Koordinat GPS'}
                    </button>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.gray600, display: 'block', marginBottom: 5 }}>Catatan (opsional)</label>
                  <textarea value={visitNote} onChange={e => setVisitNote(e.target.value)}
                    placeholder="Misal: Tiba di lobi gedung, bertemu dengan PIC..."
                    rows={2}
                    style={{ ...inp, resize: 'vertical', fontFamily: SANS }} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.gray100}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${T.gray300}`, background: T.white, fontSize: 13, color: T.gray700, cursor: 'pointer' }}>Batal</button>
                <button onClick={submitVisit} disabled={submitting || !photo || !selAssign}
                  style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: modal === 'check_in' ? T.green : T.blue700, color: T.white, fontSize: 13, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', opacity: (!photo || !selAssign) ? 0.5 : 1 }}>
                  {submitting ? 'Menyimpan...' : (modal === 'check_in' ? '✅ Simpan Check In' : '✅ Simpan Check Out')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════ REVIEW MODAL (SPV/Admin) ══════════ */}
      <AnimatePresence>
        {reviewItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) setReviewItem(null); }}>
            <motion.div initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 20 }}
              style={{ background: T.white, borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '14px 18px', background: T.blue900, display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={16} style={{ color: T.white, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.white }}>Verifikasi Kunjungan</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{reviewItem.auditor_name} · {reviewItem.nama_pt}</div>
                </div>
                <button onClick={() => setReviewItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}><X size={16} /></button>
              </div>

              {/* Photo */}
              {reviewItem.photo && (
                <div style={{ position: 'relative' }}>
                  <img src={reviewItem.photo} alt="bukti" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                    onClick={() => setLightbox(reviewItem.photo)} />
                  <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: T.white }}>
                    Klik untuk perbesar
                  </div>
                </div>
              )}

              {/* Info */}
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Auditor',   value: reviewItem.auditor_name },
                    { label: 'PT',        value: reviewItem.nama_pt },
                    { label: 'Tipe',      value: typeLabel(reviewItem.type) },
                    { label: 'Waktu',     value: fmtTs(reviewItem.timestamp) },
                  ].map(f => (
                    <div key={f.label} style={{ padding: '8px 10px', background: T.gray50, borderRadius: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{f.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.gray800 }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                {reviewItem.latitude && reviewItem.longitude && (
                  <a href={mapsUrl(reviewItem.latitude, reviewItem.longitude)} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#eff6ff', borderRadius: 7, border: `1px solid #bfdbfe`, textDecoration: 'none', color: T.blue700, fontSize: 12, fontWeight: 600 }}>
                    <Crosshair size={13} /> 📍 {reviewItem.latitude.toFixed(6)}, {reviewItem.longitude.toFixed(6)} — Buka di Maps
                  </a>
                )}

                {reviewItem.notes && (
                  <div style={{ padding: '8px 12px', background: T.gray50, borderRadius: 6, fontSize: 12, color: T.gray600, fontStyle: 'italic' }}>
                    💬 "{reviewItem.notes}"
                  </div>
                )}

                {/* SPV notes */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.gray600, display: 'block', marginBottom: 5 }}>Catatan Verifikasi (opsional)</label>
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                    placeholder="Catatan untuk auditor..."
                    rows={2}
                    style={{ ...inp, resize: 'none', fontFamily: SANS }} />
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.gray100}`, display: 'flex', gap: 8 }}>
                <button onClick={() => submitReview('Rejected')} disabled={reviewing}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 7, border: `2px solid ${T.red}`, background: T.redBg, color: T.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <ThumbsDown size={14} /> Tolak
                </button>
                <button onClick={() => submitReview('Approved')} disabled={reviewing}
                  style={{ flex: 1.8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 7, border: 'none', background: T.green, color: T.white, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <ThumbsUp size={14} /> {reviewing ? 'Memproses...' : 'Setujui Kunjungan'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════ PHOTO LIGHTBOX ══════════ */}
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
            <motion.img src={lightbox} alt="full"
              initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── PROGRESS MONITORING PAGE ─────────────────────────────────────────────────
const CHART_PALETTE = ['#1c64f2','#059669','#7c3aed','#d97706','#dc2626','#0891b2','#be185d','#15803d'];

const ProgressMonitoring = () => {
  const { user } = useAuth();
  const toast    = useToast();
  const [data,    setData]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState<'pt' | 'auditor'>('pt');

  useEffect(() => {
    apiFetch('/api/progress', user?.id)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { toast('Gagal memuat data progress', 'error'); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:320, flexDirection:'column', gap:12 }}>
      <BarChart2 size={30} style={{ color: T.blue700 }} />
      <span style={{ fontSize:13, color: T.gray400 }}>Memuat data progress...</span>
    </div>
  );

  if (data.length === 0) return (
    <div style={{ ...card({ padding:60 }), textAlign:'center' }}>
      <BarChart2 size={36} style={{ color: T.gray300, marginBottom:12 }} />
      <div style={{ fontSize:14, color: T.gray500, fontWeight:500 }}>Belum ada penugasan aktif</div>
      <div style={{ fontSize:12, color: T.gray400, marginTop:6 }}>Tambahkan Assignment terlebih dahulu</div>
    </div>
  );

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pColor = (p: number) => p >= 80 ? T.green : p >= 50 ? T.blue700 : p >= 30 ? '#d97706' : T.red;
  const pBg    = (p: number) => p >= 80 ? T.greenBg : p >= 50 ? T.blue50  : p >= 30 ? '#fef3c7' : T.redBg;
  const pLabel = (p: number, hasReports: boolean) => {
    if (!hasReports) return { label: 'Belum Mulai', color: T.gray500, bg: T.gray100 };
    if (p >= 80)  return { label: 'On Track 🟢',       color: T.green,   bg: T.greenBg };
    if (p >= 50)  return { label: 'Progress 🔵',        color: T.blue700, bg: T.blue50  };
    if (p >= 30)  return { label: 'Perlu Perhatian 🟡', color: '#d97706', bg: '#fef3c7' };
    return          { label: 'Kritis 🔴',               color: T.red,     bg: T.redBg   };
  };

  // ── Group data ────────────────────────────────────────────────────────────
  const byPT: Record<string, any[]> = {};
  const byAuditor: Record<string, any[]> = {};
  data.forEach((d: any) => {
    if (!byPT[d.nama_pt])         byPT[d.nama_pt]         = [];
    if (!byAuditor[d.auditor_name]) byAuditor[d.auditor_name] = [];
    byPT[d.nama_pt].push(d);
    byAuditor[d.auditor_name].push(d);
  });

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalAssign  = data.length;
  const avgProg      = Math.round(data.reduce((s: number, d: any) => s + d.latest_progress, 0) / totalAssign);
  const onTrack      = data.filter((d: any) => d.latest_progress >= 80).length;
  const needAttention = data.filter((d: any) => d.latest_progress < 30 && d.total_reports > 0).length;

  // ── Bar chart data (grouped by PT, bars = auditors) ───────────────────────
  const auditorNames = [...new Set(data.map((d: any) => d.auditor_name as string))];
  const chartData = Object.entries(byPT).map(([ptName, rows]) => {
    const obj: Record<string, any> = { pt: ptName.replace(/^PT\s+/i, '') };
    (rows as any[]).forEach(r => { obj[r.auditor_name] = r.latest_progress; });
    return obj;
  });

  const tooltipSt = {
    background: T.white, border: `1px solid ${T.gray200}`,
    borderRadius: 8, fontFamily: SANS, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <PageHeader title="Progress Audit" breadcrumb="Progress Audit">
        <div style={{ fontSize:12, color: T.gray400, fontStyle:'italic' }}>
          Data realtime berdasarkan laporan terbaru
        </div>
      </PageHeader>

      {/* ── Stat Cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:14 }}>
        {[
          { label:'Total Penugasan',   value:totalAssign,   icon:Target,        color:T.blue700,  bg:T.blue50,   note:'assignment aktif' },
          { label:'Rata-rata Progress', value:`${avgProg}%`, icon:TrendingUp,   color:T.green,    bg:T.greenBg,  note:'keseluruhan sistem' },
          { label:'On Track (≥80%)',   value:onTrack,       icon:Award,         color:'#059669',  bg:'#d1fae5',  note:'penugasan selesai/hampir' },
          { label:'Perlu Perhatian',   value:needAttention, icon:AlertTriangle, color:T.red,      bg:T.redBg,    note:'progress <30% ada laporan' },
        ].map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} bg={s.bg} note={s.note} />
        ))}
      </div>

      {/* ── Bar Chart: Progress per PT ── */}
      <div style={card({ padding:22 })}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:T.gray900 }}>Perbandingan Progress per PT</div>
            <div style={{ fontSize:12, color:T.gray400, marginTop:2 }}>Setiap batang mewakili progress terbaru auditor yang ditugaskan</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            {auditorNames.map((name, i) => (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:CHART_PALETTE[i % CHART_PALETTE.length] }} />
                <span style={{ fontSize:11, color:T.gray500 }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height:240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4} barCategoryGap="30%" margin={{ left:-8, right:8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.gray100} vertical={false} />
              <XAxis dataKey="pt" axisLine={false} tickLine={false} tick={{ fill:T.gray400, fontSize:11 }} />
              <YAxis domain={[0,100]} unit="%" axisLine={false} tickLine={false} tick={{ fill:T.gray400, fontSize:11 }} width={38} />
              <Tooltip
                contentStyle={tooltipSt}
                formatter={(val: any, name: any) => [`${val}%`, name]}
                cursor={{ fill:'rgba(99,102,241,0.05)' }}
              />
              {auditorNames.map((name, i) => (
                <Bar key={name} dataKey={name} name={name} fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                  radius={[4,4,0,0]} maxBarSize={40} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── View Toggle + Detail Cards ── */}
      <div style={card({ padding:22 })}>
        {/* Toggle header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:T.gray900 }}>
              Detail Progress {view === 'pt' ? 'per PT' : 'per Auditor'}
            </div>
            <div style={{ fontSize:12, color:T.gray400, marginTop:2 }}>
              {view === 'pt' ? 'Lihat progress masing-masing auditor di setiap PT' : 'Lihat semua PT yang ditangani per auditor'}
            </div>
          </div>
          <div style={{ display:'flex', borderRadius:8, border:`1px solid ${T.gray200}`, overflow:'hidden' }}>
            {(['pt','auditor'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding:'7px 16px', border:'none', cursor:'pointer', fontFamily:SANS, fontSize:12, fontWeight:500,
                background: view === v ? T.blue700 : T.white,
                color:      view === v ? T.white   : T.gray500,
                transition:'all 0.15s',
              }}>
                {v === 'pt' ? '🏢 Per PT' : '👤 Per Auditor'}
              </button>
            ))}
          </div>
        </div>

        {/* ════════ VIEW: Per PT ════════ */}
        {view === 'pt' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:16 }}>
            {Object.entries(byPT)
              .sort(([, a], [, b]) => {
                const avgA = (a as any[]).reduce((s,r) => s+r.latest_progress,0) / a.length;
                const avgB = (b as any[]).reduce((s,r) => s+r.latest_progress,0) / b.length;
                return avgA - avgB; // lowest first (needs attention)
              })
              .map(([ptName, auditors]) => {
                const avgPT = Math.round((auditors as any[]).reduce((s,r) => s+r.latest_progress,0) / auditors.length);
                const totalReps = (auditors as any[]).reduce((s,r) => s+r.total_reports,0);
                const statusInfo = pLabel(avgPT, totalReps > 0);
                return (
                  <motion.div key={ptName} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                    style={{
                      border:`1px solid ${T.gray200}`, borderRadius:14, overflow:'hidden',
                      boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
                    }}
                  >
                    {/* Card Header */}
                    <div style={{
                      padding:'14px 18px', background:`linear-gradient(135deg, ${T.blue900}, ${T.blue800})`,
                      display:'flex', alignItems:'center', gap:12,
                    }}>
                      <div style={{ width:38,height:38,borderRadius:10,background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                        <Building2 size={18} style={{ color:T.white }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:T.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ptName}</div>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:statusInfo.bg, color:statusInfo.color, fontWeight:600 }}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <ProgressRing value={avgPT} size={62} stroke={6} />
                    </div>

                    {/* Auditor rows */}
                    <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:12 }}>
                      {(auditors as any[]).map((a, i) => {
                        const hasRep = a.total_reports > 0;
                        return (
                          <div key={a.auditor_id}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                                <div style={{
                                  width:26,height:26,borderRadius:'50%',background:CHART_PALETTE[i%CHART_PALETTE.length],
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  fontSize:11,fontWeight:700,color:T.white,flexShrink:0,
                                }}>
                                  {a.auditor_name.charAt(0)}
                                </div>
                                <span style={{ fontSize:12, fontWeight:600, color:T.gray800 }}>{a.auditor_name}</span>
                              </div>
                              <span style={{ fontFamily:MONO, fontSize:12, fontWeight:700, color:pColor(a.latest_progress) }}>
                                {a.latest_progress}%
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height:6, background:T.gray100, borderRadius:99, overflow:'hidden' }}>
                              <motion.div
                                initial={{ width:0 }}
                                animate={{ width:`${a.latest_progress}%` }}
                                transition={{ duration:1, ease:'easeOut', delay: i * 0.1 }}
                                style={{ height:'100%', background:pColor(a.latest_progress), borderRadius:99 }}
                              />
                            </div>
                            {/* Mini stats */}
                            <div style={{ display:'flex', gap:10, marginTop:6 }}>
                              {[
                                { label: `${a.total_reports} laporan`,  color: T.gray500 },
                                { label: `✓ ${a.approved_reports}`,    color: T.green   },
                                { label: `⏳ ${a.pending_reports}`,    color: '#d97706' },
                                ...(a.rejected_reports > 0 ? [{ label:`✗ ${a.rejected_reports}`, color:T.red }] : []),
                              ].map(s => (
                                <span key={s.label} style={{ fontSize:10, color:s.color, fontWeight:500 }}>{s.label}</span>
                              ))}
                              {!hasRep && (
                                <span style={{ fontSize:10, color:T.gray400, fontStyle:'italic' }}>Belum ada laporan</span>
                              )}
                            </div>
                            {a.latest_report_date && (
                              <div style={{ fontSize:10, color:T.gray300, marginTop:2 }}>
                                Update: {new Date(a.latest_report_date).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}

        {/* ════════ VIEW: Per Auditor ════════ */}
        {view === 'auditor' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {Object.entries(byAuditor).map(([auditorName, pts], ai) => {
              const avgAud    = Math.round((pts as any[]).reduce((s,r) => s+r.latest_progress,0) / pts.length);
              const totalReps = (pts as any[]).reduce((s,r) => s+r.total_reports,0);
              const totalApp  = (pts as any[]).reduce((s,r) => s+r.approved_reports,0);
              const accentColor = CHART_PALETTE[ai % CHART_PALETTE.length];
              return (
                <motion.div key={auditorName} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:ai*0.06 }}
                  style={{ border:`1px solid ${T.gray200}`, borderRadius:14, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}
                >
                  {/* Auditor header */}
                  <div style={{
                    padding:'14px 20px', display:'flex', alignItems:'center', gap:14,
                    background:`linear-gradient(135deg, ${accentColor}18, ${accentColor}06)`,
                    borderBottom:`1px solid ${T.gray100}`,
                  }}>
                    <div style={{
                      width:46,height:46,borderRadius:12,background:accentColor,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:18,fontWeight:700,color:T.white,boxShadow:`0 4px 12px ${accentColor}44`,flexShrink:0,
                    }}>
                      {auditorName.charAt(0)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:T.gray900 }}>{auditorName}</div>
                      <div style={{ display:'flex', gap:14, marginTop:3, flexWrap:'wrap' }}>
                        {[
                          { v:`${pts.length} PT`,        c:T.gray500 },
                          { v:`${totalReps} laporan`,    c:T.gray500 },
                          { v:`✓ ${totalApp} approved`,  c:T.green   },
                        ].map(s => <span key={s.v} style={{ fontSize:11, color:s.c, fontWeight:500 }}>{s.v}</span>)}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <div style={{ fontFamily:MONO, fontSize:22, fontWeight:800, color:accentColor }}>{avgAud}%</div>
                      <div style={{ fontSize:10, color:T.gray400 }}>rata-rata progress</div>
                    </div>
                  </div>

                  {/* PT rows */}
                  <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:14 }}>
                    {(pts as any[]).sort((a,b) => b.latest_progress - a.latest_progress).map((p, pi) => (
                      <div key={p.pt_id}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Building2 size={13} style={{ color:T.gray400 }} />
                            <span style={{ fontSize:13, fontWeight:600, color:T.gray800 }}>{p.nama_pt}</span>
                            {p.periode_start && (
                              <span style={{ fontSize:10, color:T.gray400 }}>
                                {new Date(p.periode_start).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})} – {new Date(p.periode_end).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                              </span>
                            )}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ display:'flex', gap:8 }}>
                              {[
                                { v:`${p.total_reports} lap`,    c:T.gray500 },
                                { v:`✓${p.approved_reports}`,   c:T.green   },
                                { v:`⏳${p.pending_reports}`,    c:'#d97706' },
                              ].map(s => <span key={s.v} style={{ fontSize:10, color:s.c, fontWeight:500 }}>{s.v}</span>)}
                            </div>
                            <span style={{ fontFamily:MONO, fontSize:13, fontWeight:700, color:pColor(p.latest_progress), minWidth:38, textAlign:'right' }}>
                              {p.latest_progress}%
                            </span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height:8, background:T.gray100, borderRadius:99, overflow:'hidden' }}>
                          <motion.div
                            initial={{ width:0 }}
                            animate={{ width:`${p.latest_progress}%` }}
                            transition={{ duration:1.1, ease:'easeOut', delay: pi * 0.08 }}
                            style={{
                              height:'100%', borderRadius:99,
                              background:`linear-gradient(90deg, ${pColor(p.latest_progress)}, ${pColor(p.latest_progress)}99)`,
                            }}
                          />
                        </div>
                        {p.latest_report_date && (
                          <div style={{ fontSize:10, color:T.gray300, marginTop:4 }}>
                            Laporan terakhir: {new Date(p.latest_report_date).toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/stats', user?.id)
      .then(r => { if (!r.ok) throw new Error('Gagal memuat stats'); return r.json(); })
      .then(setStats)
      .catch(e => toast(e.message, 'error'));
  }, []);

  if (!stats) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <Activity size={28} style={{ color: T.blue700, marginBottom: 10 }} />
        <div style={{ fontSize: 13, color: T.gray400 }}>Memuat data dashboard...</div>
      </div>
    </div>
  );

  const PIE_COLORS = [T.blue700, T.green, '#f59e0b', T.red];
  const tooltipSt = { background: T.white, border: `1px solid ${T.gray200}`, borderRadius: 6, fontFamily: SANS, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' };
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Stat cards berbeda antara Auditor vs Admin/Supervisor
  const statCards = stats.isAuditor
    ? [
        { label: 'PT Saya',           value: stats.totalPT,          icon: Building2,   color: T.blue700, bg: T.blue50,   note: 'PT yang saya tangani' },
        { label: 'Total Laporan',     value: stats.totalReports,     icon: FileText,    color: T.green,   bg: T.greenBg,  note: 'laporan yang dikirim' },
        { label: 'Menunggu Review',   value: stats.pendingApprovals, icon: Clock,       color: '#92400e', bg: T.yellowBg, note: 'belum disetujui' },
        { label: 'Temuan Saya',       value: stats.totalFindings,    icon: AlertCircle, color: T.red,     bg: T.redBg,    note: 'temuan tercatat' },
      ]
    : [
        { label: 'Total PT Aktif',    value: stats.totalPT,          icon: Building2,   color: T.blue700, bg: T.blue50,   note: 'perusahaan terdaftar' },
        { label: 'Total Auditor',     value: stats.totalAuditors,    icon: Users,       color: T.green,   bg: T.greenBg,  note: 'sedang bertugas' },
        { label: 'Pending Approval',  value: stats.pendingApprovals, icon: Clock,       color: '#92400e', bg: T.yellowBg, note: 'menunggu review' },
        { label: 'Total Temuan',      value: stats.totalFindings,    icon: AlertCircle, color: T.red,     bg: T.redBg,    note: 'temuan tercatat' },
      ];

  // Pie chart data juga disesuaikan
  const pieData = stats.isAuditor
    ? [
        { name: 'PT Saya',         value: stats.totalPT          || 1 },
        { name: 'Total Laporan',   value: stats.totalReports      || 1 },
        { name: 'Pending',         value: stats.pendingApprovals  || 1 },
        { name: 'Temuan',          value: stats.totalFindings     || 1 },
      ]
    : [
        { name: 'PT Aktif',  value: stats.totalPT          || 1 },
        { name: 'Auditor',   value: stats.totalAuditors     || 1 },
        { name: 'Pending',   value: stats.pendingApprovals  || 1 },
        { name: 'Temuan',    value: stats.totalFindings     || 1 },
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...card({ padding: '16px 22px' }), display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${T.blue700}` }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.gray900 }}>Selamat datang, {user?.full_name}</div>
          <div style={{ fontSize: 12, color: T.gray400, marginTop: 3 }}>{dateStr}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.blue50, padding: '6px 14px', borderRadius: 20, border: `1px solid ${T.blue100}` }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.blue700 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: T.blue700 }}>Sistem Aktif</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {statCards.map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} bg={s.bg} note={s.note} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>
        <div style={card({ padding: 20 })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>
                {stats.isAuditor ? 'Progress PT Saya' : 'Progress Audit per PT'}
              </div>
              <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>
                {stats.isAuditor ? 'PT yang Anda tangani' : 'Progress terbaru per perusahaan'}
              </div>
            </div>
            <TrendingUp size={16} style={{ color: T.blue700 }} />
          </div>
          {stats.ptProgress.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <Building2 size={28} style={{ color: T.gray300 }} />
              <div style={{ fontSize: 13, color: T.gray400 }}>Belum ada PT yang ditangani</div>
            </div>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ptProgress} barSize={28} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.gray100} vertical={false} />
                  <XAxis dataKey="nama_pt" axisLine={false} tickLine={false} tick={{ fill: T.gray400, fontSize: 11 }} />
                  <YAxis unit="%" axisLine={false} tickLine={false} tick={{ fill: T.gray400, fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tooltipSt} cursor={{ fill: T.blue50 }} />
                  <Bar dataKey="avg_progress" fill={T.blue700} radius={[4, 4, 0, 0]} name="Progress %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div style={card({ padding: 20 })}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>Distribusi Status</div>
            <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>
              {stats.isAuditor ? 'Ringkasan aktivitas saya' : 'Ringkasan sistem'}
            </div>
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                  {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip contentStyle={tooltipSt} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {statCards.map((s, idx) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: PIE_COLORS[idx] }} />
                  <span style={{ fontSize: 12, color: T.gray600 }}>{s.label}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: T.gray900 }}>
                  {s.value ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PT MANAGEMENT ───────────────────────────────────────────────────────────
const PTManagement = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [pts, setPts] = useState<PT[]>([]);
  const [open, setOpen] = useState(false);
  const [editPT, setEditPT] = useState<PT | null>(null); // FIX #4

  const initForm = { nama_pt: '', alamat: '', PIC: '', periode_start: '', periode_end: '', status: 'Active' as const };
  const [form, setForm] = useState(initForm);
  const [saving,    setSaving]    = useState(false);
  const [importing, setImporting] = useState(false);

  // ── State untuk penugasan auditor (gabung di form tambah PT) ──────────────
  const [auditorList, setAuditorList] = useState<any[]>([]);
  const initEntry = { auditor_id: '', start_date: '', end_date: '' };
  const [newEntry,          setNewEntry]          = useState(initEntry);
  const [assignmentEntries, setAssignmentEntries] = useState<Array<{ auditor_id: string; auditor_name: string; start_date: string; end_date: string }>>([]);

  const addAuditorEntry = () => {
    if (!newEntry.auditor_id) return toast('Pilih auditor terlebih dahulu', 'error');
    if (assignmentEntries.find(e => e.auditor_id === newEntry.auditor_id))
      return toast('Auditor ini sudah ditambahkan', 'error');
    const aud = auditorList.find((a: any) => String(a.id) === newEntry.auditor_id);
    setAssignmentEntries(p => [...p, { ...newEntry, auditor_name: aud?.full_name || '' }]);
    setNewEntry(initEntry);
  };

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        apiFetch('/api/pts', user?.id).then(r => { if (!r.ok) throw new Error('Gagal memuat data PT'); return r.json(); }),
        apiFetch('/api/auditors', user?.id).then(r => r.json()),
      ]);
      setPts(p); setAuditorList(a);
    } catch (e: any) { toast(e.message, 'error'); }
  }, [user?.id]);

  const importFromImdacs = async () => {
    setImporting(true);
    try {
      const r = await apiFetch('/api/pts/import-imdacs', user?.id, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Gagal import');
      toast(`Import selesai: ${data.created} PT baru, ${data.skipped} sudah ada`, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const resetModal = () => { setForm(initForm); setEditPT(null); setAssignmentEntries([]); setNewEntry(initEntry); };

  // Buka modal tambah
  const openAdd = () => { resetModal(); setOpen(true); };

  // Normalise date dari MySQL: bisa "2025-01-01T00:00:00.000Z" atau "2025-01-01"
  // <input type="date"> butuh format YYYY-MM-DD
  const toDateStr = (v: any): string => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return '';
  };

  // Buka modal edit
  const openEdit = (pt: PT) => {
    setForm({
      nama_pt: pt.nama_pt,
      alamat: pt.alamat,
      PIC: pt.PIC,
      periode_start: toDateStr(pt.periode_start),
      periode_end:   toDateStr(pt.periode_end),
      status: pt.status,
    });
    setEditPT(pt); setAssignmentEntries([]); setNewEntry(initEntry); setOpen(true);
  };

  const closeModal = () => { setOpen(false); resetModal(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editPT ? `/api/pts/${editPT.id}` : '/api/pts';
      const method = editPT ? 'PATCH' : 'POST';
      const r = await apiFetch(url, user?.id, { method, body: JSON.stringify(form) });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal menyimpan data'); }
      const ptData = await r.json();
      const ptId = editPT ? editPT.id : ptData.id;

      // Buat penugasan untuk setiap auditor yang dipilih
      let ok = 0; const errors: string[] = [];
      for (const entry of assignmentEntries) {
        const ar = await apiFetch('/api/assignments', user?.id, {
          method: 'POST',
          body: JSON.stringify({ pt_id: ptId, auditor_id: entry.auditor_id, start_date: entry.start_date, end_date: entry.end_date }),
        });
        if (ar.ok) ok++;
        else { const err = await ar.json(); errors.push(err.error || 'Gagal'); }
      }

      const base = editPT ? 'PT berhasil diperbarui' : 'PT berhasil ditambahkan';
      const extra = ok > 0 ? ` + ${ok} auditor ditugaskan` : '';
      const warn  = errors.length > 0 ? ` (${errors.length} duplikat dilewati)` : '';
      toast(base + extra + warn, errors.length > 0 ? 'error' : 'success');
      closeModal(); load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <PageHeader title="PT Management" breadcrumb="PT Management">
        <BtnSecondary onClick={importFromImdacs} disabled={importing} style={{ marginRight: 8 }}>
          {importing ? 'Mengimpor...' : '↙ Import dari IMDACS'}
        </BtnSecondary>
        <BtnPrimary onClick={openAdd}><Plus size={14} /> Tambah PT Baru</BtnPrimary>
      </PageHeader>

      <DataTable title={`Daftar Perusahaan (${pts.length})`} cols={['Nama Perusahaan', 'PIC', 'Periode Audit', 'Status', 'Aksi']}>
        {pts.length === 0 ? (
          <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, fontSize: 13, color: T.gray400 }}>Belum ada data perusahaan.</td></tr>
        ) : pts.map(pt => (
          <tr key={pt.id} style={{ transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = T.gray50}
            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
            <Td sub={(() => {
              const srcBadge = pt.source === 'imdacs_sync'   ? '🔄 Sync IMDACS'
                             : pt.source === 'imdacs_import' ? `📥 Import IMDACS${pt.created_by_name ? ` · ${pt.created_by_name}` : ''}`
                             : pt.created_by_name            ? `👤 ${pt.created_by_name}`
                             : '';
              return [pt.alamat, srcBadge].filter(Boolean).join('  ·  ');
            })()}>
              <span style={{ fontWeight: 600, color: T.gray900 }}>{pt.nama_pt}</span>
            </Td>
            <Td>{pt.PIC}</Td>
            <Td mono>{formatDate(pt.periode_start)} – {formatDate(pt.periode_end)}</Td>
            <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}` }}>
              <Badge type={pt.status === 'Active' ? 'success' : 'default'}>{pt.status}</Badge>
            </td>
            <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}` }}>
              <BtnSecondary sm onClick={() => openEdit(pt)}><Edit2 size={12} /> Edit</BtnSecondary>
            </td>
          </tr>
        ))}
      </DataTable>

      <Modal open={open} onClose={closeModal} title={editPT ? 'Edit Data PT' : 'Tambah PT Baru'} subtitle={editPT ? `Mengedit: ${editPT.nama_pt}` : 'Isi formulir data perusahaan yang akan diaudit'}>
        <form onSubmit={submit}>
          <Field label="Nama Perusahaan"><Input required value={form.nama_pt} onChange={f('nama_pt')} placeholder="PT Contoh Indonesia" /></Field>
          <Field label="Alamat"><Textarea value={form.alamat} onChange={f('alamat')} placeholder="Jl. Sudirman No. 1, Jakarta Pusat" rows={2} /></Field>
          <Field label="Nama PIC"><Input required value={form.PIC} onChange={f('PIC')} placeholder="Budi Santoso" /></Field>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Tanggal Mulai" half><Input required type="date" value={form.periode_start} onChange={f('periode_start')} /></Field>
            <Field label="Tanggal Selesai" half><Input required type="date" value={form.periode_end} onChange={f('periode_end')} /></Field>
          </div>
          {editPT && (
            <Field label="Status">
              <Select value={form.status} onChange={f('status')}>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </Select>
            </Field>
          )}

          {/* ── Tugaskan Auditor (hanya saat Tambah PT baru) ── */}
          {!editPT && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.gray700, marginBottom: 10 }}>
                Tugaskan Auditor <span style={{ fontWeight: 400, color: T.gray400, fontSize: 12 }}>(opsional, bisa diisi setelah)</span>
              </div>

              {/* Daftar auditor yang sudah dipilih */}
              {assignmentEntries.length > 0 && (
                <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {assignmentEntries.map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#eff6ff', borderRadius: 6, fontSize: 12, border: '1px solid #bfdbfe' }}>
                      <span style={{ fontWeight: 600, flex: 1, color: T.gray800 }}>{e.auditor_name}</span>
                      {e.start_date && <span style={{ color: T.gray500 }}>{e.start_date} s/d {e.end_date || '—'}</span>}
                      <button type="button" onClick={() => setAssignmentEntries(p => p.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 700, fontSize: 14, padding: '0 2px', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input tambah auditor */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: 140 }}>
                  <Select value={newEntry.auditor_id} onChange={e => setNewEntry(p => ({ ...p, auditor_id: e.target.value }))}>
                    <option value="">-- Pilih Auditor --</option>
                    {auditorList.map((a: any) => <option key={a.id} value={String(a.id)}>{a.full_name}</option>)}
                  </Select>
                </div>
                <div style={{ flex: 1, minWidth: 110 }}>
                  <Input type="date" value={newEntry.start_date} onChange={e => setNewEntry(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div style={{ flex: 1, minWidth: 110 }}>
                  <Input type="date" value={newEntry.end_date} onChange={e => setNewEntry(p => ({ ...p, end_date: e.target.value }))} />
                </div>
                <BtnSecondary type="button" onClick={addAuditorEntry} sm>+ Tambah</BtnSecondary>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
            <BtnSecondary onClick={closeModal}>Batal</BtnSecondary>
            <BtnPrimary type="submit" disabled={saving}><Save size={14} /> {saving ? 'Menyimpan...' : editPT ? 'Simpan Perubahan' : (assignmentEntries.length > 0 ? `Simpan PT + ${assignmentEntries.length} Penugasan` : 'Simpan PT')}</BtnPrimary>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ─── AUDIT ASSIGNMENTS ────────────────────────────────────────────────────────
const AuditAssignments = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pts, setPts] = useState<PT[]>([]);
  const [auditors, setAuditors] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const initForm = { pt_id: '', auditor_id: '', start_date: '', end_date: '' };
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, p, u] = await Promise.all([
        apiFetch('/api/assignments', user?.id).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        apiFetch('/api/pts', user?.id).then(r => r.json()),
        apiFetch('/api/auditors', user?.id).then(r => r.json()),
      ]);
      setAssignments(a); setPts(p); setAuditors(u);
    } catch { toast('Gagal memuat data assignment', 'error'); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => { setOpen(false); setForm(initForm); }; // FIX #6

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await apiFetch('/api/assignments', user?.id, { method: 'POST', body: JSON.stringify(form) });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal menyimpan'); }
      toast('Penugasan berhasil dibuat', 'success');
      closeModal(); load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <PageHeader title="Audit Assignments" breadcrumb="Audit Assignments">
        <BtnPrimary onClick={() => setOpen(true)}><Plus size={14} /> Buat Penugasan</BtnPrimary>
      </PageHeader>
      <DataTable title={`Daftar Penugasan (${assignments.length})`} cols={['Perusahaan', 'Auditor Bertugas', 'Periode', 'Status']}>
        {assignments.length === 0 ? (
          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, fontSize: 13, color: T.gray400 }}>Belum ada penugasan.</td></tr>
        ) : assignments.map(a => (
          <tr key={a.id} style={{ transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = T.gray50}
            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
            <Td><span style={{ fontWeight: 600, color: T.gray900 }}>{a.nama_pt}</span></Td>
            <Td sub="Auditor">{a.auditor_name}</Td>
            <Td mono>{formatDate(a.start_date)} – {formatDate(a.end_date)}</Td>
            <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}` }}>
              <Badge type={a.status === 'Active' ? 'success' : 'default'}>{a.status}</Badge>
            </td>
          </tr>
        ))}
      </DataTable>
      <Modal open={open} onClose={closeModal} title="Buat Penugasan Auditor" subtitle="Tugaskan auditor ke perusahaan yang akan diaudit">
        <form onSubmit={submit}>
          <Field label="Pilih Perusahaan (PT)">
            <Select required value={form.pt_id} onChange={f('pt_id')}>
              <option value="">-- Pilih PT --</option>
              {pts.map(p => <option key={p.id} value={p.id}>{p.nama_pt}</option>)}
            </Select>
          </Field>
          <Field label="Pilih Auditor">
            <Select required value={form.auditor_id} onChange={f('auditor_id')}>
              <option value="">-- Pilih Auditor --</option>
              {auditors.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </Select>
          </Field>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Tanggal Mulai" half><Input required type="date" value={form.start_date} onChange={f('start_date')} /></Field>
            <Field label="Tanggal Selesai" half><Input required type="date" value={form.end_date} onChange={f('end_date')} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
            <BtnSecondary onClick={closeModal}>Batal</BtnSecondary>
            <BtnPrimary type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Buat Penugasan'}</BtnPrimary>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ─── APPROVAL MODAL ──────────────────────────────────────────────────────────
interface ApprovalTarget { reportId: number; action: 'Approved' | 'Rejected'; }

const ApprovalModal = ({ target, onConfirm, onClose }: {
  target: ApprovalTarget | null;
  onConfirm: (reportId: number, action: 'Approved' | 'Rejected', notes: string) => void;
  onClose: () => void;
}) => {
  const [notes, setNotes] = useState('');
  const isApprove = target?.action === 'Approved';

  // Reset notes when modal opens
  useEffect(() => { if (target) setNotes(''); }, [target]);

  const accentColor = isApprove ? T.green : T.red;
  const accentBg    = isApprove ? T.greenBg : T.redBg;
  const accentBorder= isApprove ? '#a7f3d0' : '#fca5a5';

  const handleConfirm = () => {
    if (!target) return;
    if (!isApprove && !notes.trim()) return; // Rejection requires reason
    onConfirm(target.reportId, target.action, notes.trim());
    onClose();
  };

  return (
    <AnimatePresence>
      {target && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(17,25,40,0.55)', backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.18 }}
            style={{ background: T.white, borderRadius: 10, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.gray200}`, background: accentBg, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isApprove ? <CheckCircle2 size={18} style={{ color: T.white }} /> : <XCircle size={18} style={{ color: T.white }} />}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.gray900 }}>{isApprove ? 'Setujui Laporan' : 'Tolak Laporan'}</div>
                <div style={{ fontSize: 12, color: T.gray500, marginTop: 2 }}>{isApprove ? 'Konfirmasi persetujuan laporan harian ini' : 'Berikan alasan penolakan laporan ini'}</div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              {/* Info box */}
              <div style={{ padding: '10px 14px', background: accentBg, borderRadius: 6, border: `1px solid ${accentBorder}`, marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: accentColor, fontWeight: 500 }}>
                  {isApprove
                    ? '✓ Laporan akan ditandai sebagai Disetujui dan auditor akan diberitahu.'
                    : '✗ Laporan akan dikembalikan ke auditor dengan catatan penolakan.'}
                </div>
              </div>

              {/* Notes textarea */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ ...labelSt, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isApprove ? 'Catatan (opsional)' : 'Alasan Penolakan'}
                  {!isApprove && <span style={{ color: T.red, fontSize: 11 }}>*wajib diisi</span>}
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={isApprove ? 'Tambahkan catatan untuk auditor (opsional)...' : 'Jelaskan alasan penolakan laporan ini...'}
                  rows={3}
                  autoFocus
                  style={{ ...inp, resize: 'vertical', borderColor: (!isApprove && !notes.trim()) ? T.red : T.gray300 }}
                  onFocus={e => Object.assign(e.target.style, focus)}
                  onBlur={e => Object.assign(e.target.style, blur)}
                />
                {!isApprove && !notes.trim() && (
                  <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>Alasan penolakan wajib diisi</div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.gray200}`, background: T.gray50, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <BtnSecondary onClick={onClose}>Batal</BtnSecondary>
              <button
                onClick={handleConfirm}
                disabled={!isApprove && !notes.trim()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 6, border: 'none',
                  background: (!isApprove && !notes.trim()) ? T.gray300 : accentColor,
                  color: T.white, fontFamily: SANS, fontWeight: 500, fontSize: 13,
                  cursor: (!isApprove && !notes.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {isApprove ? <><CheckCircle2 size={14} /> Setujui Laporan</> : <><XCircle size={14} /> Tolak Laporan</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ─── REPORT ROW (reusable) ────────────────────────────────────────────────────
const ReportRow = ({ r, expandedId, setExpandedId, userRole, setApprovalTarget }: {
  r: DailyReport; expandedId: number | null; setExpandedId: (id: number | null) => void;
  userRole: string; setApprovalTarget: (t: ApprovalTarget) => void; [k: string]: any;
}) => {
  const isExpanded = expandedId === r.id;
  const accentLine = r.approval_status === 'Approved' ? T.green : r.approval_status === 'Rejected' ? T.red : '#d97706';
  const d = new Date(r.tanggal);

  return (
    <div style={{ background: T.white, border: `1px solid ${T.gray200}`, borderRadius: 8, overflow: 'hidden', borderLeft: `3px solid ${accentLine}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      {/* Compact row */}
      <div onClick={() => setExpandedId(isExpanded ? null : r.id)}
        style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = T.gray50}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
        {/* Tanggal */}
        <div style={{ textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: T.gray800, lineHeight: 1 }}>{d.getDate().toString().padStart(2,'0')}</div>
          <div style={{ fontSize: 10, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.toLocaleDateString('id-ID', { month: 'short' })}</div>
        </div>
        <div style={{ width: 1, height: 32, background: T.gray200, flexShrink: 0 }} />
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.gray900 }}>{r.area_diaudit}</span>
            {approvalBadge(r.approval_status)}
            {r.temuan && <Badge type="danger"><AlertCircle size={9} /> Temuan</Badge>}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: T.gray400, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {r.jam_mulai} – {r.jam_selesai}</span>
            <span style={{ fontSize: 11, color: T.gray400, fontFamily: MONO }}>{r.status}</span>
          </div>
        </div>
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ width: 50, height: 5, background: T.gray100, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${r.progress}%`, background: `linear-gradient(90deg,${T.blue700},${T.blue500})`, borderRadius: 99 }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, color: T.blue700, fontWeight: 700, minWidth: 28 }}>{r.progress}%</span>
        </div>
        {/* Approve btns */}
        {(userRole === 'Supervisor' || userRole === 'Manager') && r.approval_status === 'Pending' && (
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setApprovalTarget({ reportId: r.id, action: 'Approved' })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: T.greenBg, border: '1px solid #a7f3d0', color: T.green, fontWeight: 500, fontSize: 11, cursor: 'pointer' }}>
              <CheckCircle2 size={11} /> Setujui
            </button>
            <button onClick={() => setApprovalTarget({ reportId: r.id, action: 'Rejected' })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: T.redBg, border: '1px solid #fca5a5', color: T.red, fontWeight: 500, fontSize: 11, cursor: 'pointer' }}>
              <XCircle size={11} /> Tolak
            </button>
          </div>
        )}
        <div style={{ color: T.gray300, flexShrink: 0 }}>{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${T.gray100}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
            <div style={{ background: T.gray50, borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Deskripsi Pekerjaan</div>
              <div style={{ fontSize: 12, color: T.gray700, lineHeight: 1.6 }}>{r.deskripsi_pekerjaan}</div>
            </div>
            <div style={{ background: r.temuan ? T.redBg : T.gray50, borderRadius: 6, padding: '10px 12px', border: r.temuan ? '1px solid #fca5a5' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: r.temuan ? T.red : T.gray400, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Temuan</div>
              {r.temuan ? <div style={{ fontSize: 12, color: T.red, lineHeight: 1.6, display: 'flex', gap: 5 }}><AlertCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />{r.temuan}</div>
                : <div style={{ fontSize: 11, color: T.gray300, fontStyle: 'italic' }}>Tidak ada temuan</div>}
            </div>
            {r.kendala && (
              <div style={{ background: T.yellowBg, borderRadius: 6, padding: '10px 12px', border: '1px solid #fcd34d' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.yellow, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Kendala</div>
                <div style={{ fontSize: 12, color: T.yellow, lineHeight: 1.6 }}>{r.kendala}</div>
              </div>
            )}
            {r.supervisor_notes && (
              <div style={{ background: T.blue50, borderRadius: 6, padding: '10px 12px', border: `1px solid ${T.blue100}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.blue700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Catatan Supervisor</div>
                <div style={{ fontSize: 12, color: T.blue700, lineHeight: 1.6, fontStyle: 'italic' }}>"{r.supervisor_notes}"</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: T.gray50, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.gray500, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Progress Audit</span>
            <div style={{ flex: 1, height: 7, background: T.gray200, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${r.progress}%`, background: `linear-gradient(90deg,${T.blue700},${T.blue500})`, borderRadius: 99, transition: 'width 0.6s' }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: T.blue700, flexShrink: 0 }}>{r.progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PT SECTION (reusable) ────────────────────────────────────────────────────
const PTSection = ({ ptName, ptReports, expandedId, setExpandedId, userRole, setApprovalTarget, collapsedPTs, togglePT }: any) => {
  const isCollapsed = collapsedPTs.has(ptName);
  // Progress PT = progress dari laporan TERBARU (sorted by tanggal desc, lalu created_at desc)
  const sortedReports = [...ptReports].sort((a: DailyReport, b: DailyReport) => {
    const dateA = new Date(a.tanggal + ' ' + (a.created_at || '')).getTime();
    const dateB = new Date(b.tanggal + ' ' + (b.created_at || '')).getTime();
    return dateB - dateA;
  });
  const latestProgress = sortedReports.length > 0 ? (sortedReports[0].progress || 0) : 0;
  const stats = {
    total: ptReports.length,
    approved: ptReports.filter((r: DailyReport) => r.approval_status === 'Approved').length,
    pending:  ptReports.filter((r: DailyReport) => r.approval_status === 'Pending').length,
    rejected: ptReports.filter((r: DailyReport) => r.approval_status === 'Rejected').length,
    latestProgress,
  };

  return (
    <div style={{ border: `1px solid ${T.gray200}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {/* PT Header — klik untuk collapse */}
      <div onClick={() => togglePT(ptName)} style={{ padding: '12px 16px', background: T.gray50, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: isCollapsed ? 'none' : `1px solid ${T.gray200}` }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#eef2f7'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = T.gray50}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: T.blue50, border: `1px solid ${T.blue100}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 size={14} style={{ color: T.blue700 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ptName}</div>
          <div style={{ fontSize: 11, color: T.gray400, marginTop: 1 }}>{stats.total} laporan</div>
        </div>
        {/* Mini badges */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {stats.pending > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: T.yellowBg, color: T.yellow, border: '1px solid #fcd34d', fontWeight: 600 }}>⏳ {stats.pending}</span>}
          {stats.approved > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: T.greenBg, color: T.green, border: '1px solid #a7f3d0', fontWeight: 600 }}>✓ {stats.approved}</span>}
          {stats.rejected > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: T.redBg, color: T.red, border: '1px solid #fca5a5', fontWeight: 600 }}>✗ {stats.rejected}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
            <div style={{ width: 60, height: 5, background: T.gray200, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stats.latestProgress}%`, background: `linear-gradient(90deg,${T.blue700},${T.blue500})`, borderRadius: 99 }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: 10, color: T.blue700, fontWeight: 700 }}>{stats.latestProgress}%</span>
          </div>
        </div>
        <div style={{ color: T.gray400, flexShrink: 0, marginLeft: 4 }}>{isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</div>
      </div>

      {/* Report list */}
      {!isCollapsed && (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {ptReports.length === 0 ? (
            <div style={{ padding: '14px 12px', textAlign: 'center', color: T.gray400, fontSize: 12, fontStyle: 'italic', borderRadius: 6, background: T.gray50, border: `1px dashed ${T.gray200}` }}>
              <FileText size={14} style={{ color: T.gray300, marginBottom: 4, display: 'block', margin: '0 auto 6px' }} />
              Belum ada laporan untuk PT ini
            </div>
          ) : ptReports.map((r: DailyReport) => (
            <ReportRow key={r.id} r={r} expandedId={expandedId} setExpandedId={setExpandedId} userRole={userRole} setApprovalTarget={setApprovalTarget} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── DAILY REPORTS ────────────────────────────────────────────────────────────
const DailyReports = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [reports, setReports]           = useState<DailyReport[]>([]);
  const [assignments, setAssignments]   = useState<Assignment[]>([]);
  const [open, setOpen]                 = useState(false);
  const [saving, setSaving]             = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<ApprovalTarget | null>(null);
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch]             = useState('');
  const [collapsedPTs, setCollapsedPTs] = useState<Set<string>>(new Set());
  const [collapsedAuditors, setCollapsedAuditors] = useState<Set<string>>(new Set());

  const isSPV = user?.role === 'Supervisor' || user?.role === 'Manager';

  const initForm = {
    assignment_id: '', pt_id: '', tanggal: new Date().toISOString().split('T')[0],
    jam_mulai: '', jam_selesai: '', area_diaudit: '',
    deskripsi_pekerjaan: '', temuan: '', progress: 0, kendala: '', status: 'Ongoing'
  };
  const [form, setForm] = useState(initForm);
  const [spvPts, setSpvPts] = useState<any[]>([]);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  // ── Draft Auto-Save ──────────────────────────────────────────────────────────
  // Key per-user supaya draft tidak campur antar akun
  const DRAFT_KEY = `monitra_draft_${user?.id}`;

  const [hasDraft, setHasDraft] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem(`monitra_draft_${user?.id}`) || 'null');
      return !!(d?.area_diaudit || d?.deskripsi_pekerjaan || d?.jam_mulai);
    } catch { return false; }
  });
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simpan draft secara otomatis (debounced 800ms) setiap form berubah saat modal terbuka
  useEffect(() => {
    if (!open) return;
    const hasContent = !!(form.area_diaudit || form.deskripsi_pekerjaan || form.jam_mulai || form.temuan || form.kendala);
    if (!hasContent) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setHasDraft(true);
      setDraftSavedAt(new Date());
    }, 800);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [form, open]);

  // Buka modal dan restore data dari draft yang tersimpan
  const openWithDraft = () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d) setForm({ ...initForm, ...d });
    } catch {}
    setOpen(true);
  };

  // Buang draft dan mulai form baru bersih
  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    setDraftSavedAt(null);
    setForm(initForm);
  };

  const load = useCallback(async () => {
    try {
      const fetches: Promise<any>[] = [
        apiFetch('/api/reports', user?.id).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        user?.role === 'Auditor'
          ? apiFetch(`/api/my-assignments/${user.id}`, user?.id).then(r => r.json())
          : apiFetch('/api/assignments', user?.id).then(r => r.json()),
      ];
      if (isSPV) fetches.push(apiFetch('/api/pts', user?.id).then(r => r.json()));
      const [r, a, p] = await Promise.all(fetches);
      setReports(r); setAssignments(a);
      if (isSPV && p) setSpvPts(p);
    } catch { toast('Gagal memuat laporan', 'error'); }
  }, [user?.id, user?.role, isSPV]);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => { setOpen(false); setForm(initForm); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      // SPV kirim pt_id, Auditor kirim assignment_id
      const payload = isSPV
        ? { ...form, assignment_id: undefined }
        : { ...form, pt_id: undefined };
      const r = await apiFetch('/api/reports', user?.id, { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal mengirim laporan'); }
      toast('Laporan berhasil dikirim', 'success');
      // Hapus draft setelah laporan berhasil terkirim
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      setDraftSavedAt(null);
      closeModal(); load();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const approve = async (id: number, status: string, notes: string) => {
    try {
      const r = await apiFetch(`/api/reports/${id}/approve`, user?.id, { method: 'PATCH', body: JSON.stringify({ status, supervisor_notes: notes }) });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal memproses'); }
      toast(status === 'Approved' ? 'Laporan disetujui' : 'Laporan ditolak', status === 'Approved' ? 'success' : 'info');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const togglePT = (key: string) => setCollapsedPTs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleAuditor = (key: string) => setCollapsedAuditors(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = reports.filter(r => {
    const matchStatus = statusFilter === 'all' || r.approval_status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || r.nama_pt.toLowerCase().includes(q)
      || r.area_diaudit?.toLowerCase().includes(q)
      || r.auditor_name?.toLowerCase().includes(q)
      || r.deskripsi_pekerjaan?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ── Group by Auditor → PT (untuk Supervisor/Admin) ────────────────────────
  // Group by PT saja (untuk Auditor sendiri)
  const isAuditor  = user?.role === 'Auditor';
  // SPV & Manager juga bisa submit laporan (bukan hanya Auditor)
  const canSubmit  = user?.role === 'Auditor' || user?.role === 'Supervisor' || user?.role === 'Manager';

  // ── AUDITOR VIEW: grouped per PT dari assignments (bukan dari reports) ────
  // Semua PT yang di-assign ke auditor ini (termasuk yang belum ada laporannya)
  const byPT: Record<string, DailyReport[]> = {};
  if (isAuditor) {
    // Pertama, inisialisasi semua PT dari assignments dengan array kosong
    assignments.forEach((a: Assignment) => {
      if (!byPT[a.nama_pt]) byPT[a.nama_pt] = [];
    });
    // Kemudian, masukkan reports yang sesuai filter ke PT masing-masing
    filtered.forEach(r => {
      if (!byPT[r.nama_pt]) byPT[r.nama_pt] = [];
      byPT[r.nama_pt].push(r);
    });
  }

  // ── SUPERVISOR/ADMIN VIEW: grouped per auditor → per PT dari assignments ──
  // Build dari assignments dulu, lalu overlay dengan reports
  const byAuditor: Record<string, Record<string, DailyReport[]>> = {};
  if (!isAuditor) {
    // Inisialisasi struktur dari assignments (auditor → PT kosong)
    assignments.forEach((a: any) => {
      const audName = a.auditor_name || 'Unknown';
      const ptName  = a.nama_pt || 'Unknown';
      if (!byAuditor[audName]) byAuditor[audName] = {};
      if (!byAuditor[audName][ptName]) byAuditor[audName][ptName] = [];
    });
    // Overlay reports ke struktur yang sudah ada
    filtered.forEach(r => {
      const aName = r.auditor_name || 'Unknown';
      if (!byAuditor[aName]) byAuditor[aName] = {};
      if (!byAuditor[aName][r.nama_pt]) byAuditor[aName][r.nama_pt] = [];
      // Hindari duplikasi jika sudah diinisialisasi dari assignments
      if (!byAuditor[aName][r.nama_pt].find((x: DailyReport) => x.id === r.id)) {
        byAuditor[aName][r.nama_pt].push(r);
      }
    });
  }

  // Summary counts
  const countAll      = reports.length;
  const countPending  = reports.filter(r => r.approval_status === 'Pending').length;
  const countApproved = reports.filter(r => r.approval_status === 'Approved').length;
  const countRejected = reports.filter(r => r.approval_status === 'Rejected').length;

  // Auditor summary (hanya untuk spv/admin)
  // avgProgress = rata-rata progress terbaru masing-masing PT (bukan rata-rata semua laporan)
  const auditorStats = (auditPTMap: Record<string, DailyReport[]>) => {
    const all = Object.values(auditPTMap).flat();
    const ptNames = Object.keys(auditPTMap);
    // Ambil latest progress per PT, lalu rata-ratakan antar PT
    const latestProgressPerPT = ptNames.map(pt => {
      const ptReps = auditPTMap[pt];
      if (ptReps.length === 0) return 0;
      const sorted = [...ptReps].sort((a, b) => {
        const da = new Date(a.tanggal + ' ' + (a.created_at || '')).getTime();
        const db = new Date(b.tanggal + ' ' + (b.created_at || '')).getTime();
        return db - da;
      });
      return sorted[0].progress || 0;
    });
    const avgProgress = ptNames.length > 0
      ? Math.round(latestProgressPerPT.reduce((s, p) => s + p, 0) / ptNames.length)
      : 0;
    return {
      totalPT: ptNames.length,
      totalLaporan: all.length,
      pending:  all.filter(r => r.approval_status === 'Pending').length,
      approved: all.filter(r => r.approval_status === 'Approved').length,
      rejected: all.filter(r => r.approval_status === 'Rejected').length,
      avgProgress,
    };
  };

  // ── Export to Excel (3 sheets: Ringkasan, Detail, Per Auditor) ───────────────
  const exportToExcel = () => {
    if (filtered.length === 0) { toast('Tidak ada laporan untuk diekspor', 'info'); return; }
    const wb   = XLSX.utils.book_new();
    const now  = new Date();
    const nowStr = now.toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const approved = filtered.filter(r => r.approval_status === 'Approved').length;
    const pending  = filtered.filter(r => r.approval_status === 'Pending').length;
    const rejected = filtered.filter(r => r.approval_status === 'Rejected').length;

    // ── Hitung ringkasan per PT ──────────────────────────────────────────────
    const ptMap: Record<string, { total:number; approved:number; pending:number; rejected:number; maxProgress:number; auditors:Set<string> }> = {};
    filtered.forEach(r => {
      const k = r.nama_pt || 'Unknown';
      if (!ptMap[k]) ptMap[k] = { total:0, approved:0, pending:0, rejected:0, maxProgress:0, auditors: new Set() };
      ptMap[k].total++;
      if (r.approval_status === 'Approved') ptMap[k].approved++;
      if (r.approval_status === 'Pending')  ptMap[k].pending++;
      if (r.approval_status === 'Rejected') ptMap[k].rejected++;
      if ((r.progress||0) > ptMap[k].maxProgress) ptMap[k].maxProgress = r.progress||0;
      if (r.auditor_name) ptMap[k].auditors.add(r.auditor_name);
    });

    // ── Sheet 1: Ringkasan ───────────────────────────────────────────────────
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['MONITRA \u2014 Laporan Audit'],
      [`Diekspor pada: ${nowStr}`],
      [`Total laporan ditampilkan: ${filtered.length} laporan`],
      [],
      ['RINGKASAN KESELURUHAN'],
      ['Keterangan',           'Jumlah'],
      ['Total Laporan',        filtered.length],
      ['Disetujui (Approved)', approved],
      ['Menunggu (Pending)',   pending],
      ['Ditolak (Rejected)',   rejected],
      [],
      ['RINGKASAN PER PT'],
      ['Nama PT', 'Auditor Bertugas', 'Total Laporan', 'Approved', 'Pending', 'Rejected', 'Progress Tertinggi (%)'],
      ...Object.entries(ptMap).map(([pt, s]) => [
        pt, [...s.auditors].join(', '), s.total, s.approved, s.pending, s.rejected, s.maxProgress,
      ]),
    ]);
    ws1['!cols'] = [{ wch:32 },{ wch:28 },{ wch:16 },{ wch:12 },{ wch:12 },{ wch:12 },{ wch:22 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');

    // ── Sheet 2: Detail Laporan ──────────────────────────────────────────────
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['No','Tanggal','PT','Auditor','Area Diaudit','Jam Mulai','Jam Selesai',
       'Deskripsi Pekerjaan','Temuan','Progress (%)','Kendala',
       'Status Pengerjaan','Status Approval','Catatan Supervisor','Dibuat Pada'],
      ...filtered.map((r, i) => [
        i+1, r.tanggal||'', r.nama_pt||'', r.auditor_name||'', r.area_diaudit||'',
        r.jam_mulai||'', r.jam_selesai||'', r.deskripsi_pekerjaan||'', r.temuan||'',
        r.progress??0, r.kendala||'', r.status||'', r.approval_status||'',
        r.supervisor_notes||'',
        r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : '',
      ]),
    ]);
    ws2['!cols'] = [
      { wch:5 },{ wch:13 },{ wch:22 },{ wch:18 },{ wch:22 },
      { wch:10 },{ wch:10 },{ wch:50 },{ wch:40 },{ wch:13 },
      { wch:35 },{ wch:18 },{ wch:16 },{ wch:40 },{ wch:22 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Detail Laporan');

    // ── Sheet 3: Per Auditor ─────────────────────────────────────────────────
    const audMap: Record<string, DailyReport[]> = {};
    filtered.forEach(r => { const k = r.auditor_name||'Unknown'; if (!audMap[k]) audMap[k]=[]; audMap[k].push(r); });
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['REKAP PER AUDITOR'],
      [],
      ['Auditor','PT yang Ditangani','Total Laporan','Approved','Pending','Rejected'],
      ...Object.entries(audMap).map(([aud, reps]) => [
        aud,
        [...new Set(reps.map(r => r.nama_pt||''))].join(', '),
        reps.length,
        reps.filter(r => r.approval_status==='Approved').length,
        reps.filter(r => r.approval_status==='Pending').length,
        reps.filter(r => r.approval_status==='Rejected').length,
      ]),
    ]);
    ws3['!cols'] = [{ wch:22 },{ wch:42 },{ wch:14 },{ wch:12 },{ wch:12 },{ wch:12 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Per Auditor');

    XLSX.writeFile(wb, `Laporan_Audit_MONITRA_${now.toISOString().split('T')[0]}.xlsx`);
    toast(`✓ Excel diunduh — ${filtered.length} laporan`, 'success');
  };

  // ── Export to PDF (landscape A4, header + stat boxes + tabel lengkap) ────────
  const exportToPDF = () => {
    if (filtered.length === 0) { toast('Tidak ada laporan untuk diekspor', 'info'); return; }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W   = doc.internal.pageSize.getWidth();
    const H   = doc.internal.pageSize.getHeight();
    const now = new Date();
    const nowStr = now.toLocaleString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const approved = filtered.filter(r => r.approval_status === 'Approved').length;
    const pending  = filtered.filter(r => r.approval_status === 'Pending').length;
    const rejected = filtered.filter(r => r.approval_status === 'Rejected').length;

    // ── Header bar (dark blue) ────────────────────────────────────────────────
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, W, 24, 'F');
    doc.setFillColor(28, 100, 242);
    doc.rect(0, 24, W, 2, 'F');                               // accent line

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text('MONITRA', 14, 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Monitoring & Tracking for Audit', 14, 17);
    doc.text(`Diekspor: ${nowStr}`, W - 14, 11, { align: 'right' });
    doc.text(`${filtered.length} laporan`, W - 14, 17, { align: 'right' });

    // ── Section title ─────────────────────────────────────────────────────────
    doc.setTextColor(30, 58, 95);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Laporan Harian Audit', 14, 34);

    // ── Stat boxes ────────────────────────────────────────────────────────────
    const statDefs = [
      { label: 'Total Laporan', value: filtered.length, r:28,  g:100, b:242 },
      { label: 'Approved',      value: approved,         r:5,   g:122, b:85  },
      { label: 'Pending',       value: pending,          r:146, g:64,  b:14  },
      { label: 'Rejected',      value: rejected,          r:200, g:30,  b:30  },
    ];
    const bW = (W - 28 - 9) / 4;
    const bY = 38;
    statDefs.forEach((s, i) => {
      const bX = 14 + i * (bW + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(s.r, s.g, s.b);
      doc.setLineWidth(0.5);
      doc.roundedRect(bX, bY, bW, 14, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.setTextColor(s.r, s.g, s.b);
      doc.text(String(s.value), bX + bW / 2, bY + 8.5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text(s.label, bX + bW / 2, bY + 12.5, { align: 'center' });
    });

    // ── Reports table ─────────────────────────────────────────────────────────
    autoTable(doc, {
      startY: bY + 18,
      margin: { left: 14, right: 14 },
      head: [['No','Tanggal','PT','Auditor','Area Diaudit','Deskripsi Pekerjaan','Temuan','Progress','Status','Approval','Catatan SPV']],
      body: filtered.map((r, i) => [
        i + 1,
        r.tanggal || '',
        r.nama_pt || '',
        r.auditor_name || '',
        r.area_diaudit || '',
        (r.deskripsi_pekerjaan || '-').length > 65
          ? (r.deskripsi_pekerjaan || '').substring(0, 65) + '…'
          : (r.deskripsi_pekerjaan || '-'),
        r.temuan || '-',
        `${r.progress ?? 0}%`,
        r.status || '',
        r.approval_status || '',
        r.supervisor_notes || '-',
      ]),
      styles: {
        fontSize: 7, overflow: 'linebreak',
        cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
        lineColor: [228, 232, 240], lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 58, 95], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: 7, halign: 'center',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        7: { halign: 'center', cellWidth: 16 },
        8: { cellWidth: 20 },
        9: { halign: 'center', cellWidth: 22 },
      },
      didDrawPage: (data) => {
        // Footer tiap halaman
        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text(`Halaman ${data.pageNumber}`, W - 14, H - 5, { align: 'right' });
        doc.text('\u00A9 MONITRA \u2014 Monitoring & Tracking for Audit', 14, H - 5);
      },
    });

    doc.save(`Laporan_Audit_MONITRA_${now.toISOString().split('T')[0]}.pdf`);
    toast(`✓ PDF diunduh — ${filtered.length} laporan`, 'success');
  };

  return (
    <div>
      <PageHeader title="Laporan Harian" breadcrumb="Laporan Harian">
        {/* ── Auditor / SPV: tombol buat laporan + draft indicator ── */}
        {canSubmit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <BtnPrimary onClick={() => setOpen(true)}><Plus size={14} /> Buat Laporan</BtnPrimary>
              {hasDraft && (
                <span title="Ada draft tersimpan" style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#f59e0b', border: `2px solid ${T.white}`,
                  animation: 'pulse 2s infinite',
                }} />
              )}
            </div>
          </div>
        )}

        {/* ── Admin/Supervisor: tombol export ── */}
        {!isAuditor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Export Excel */}
            <button
              onClick={exportToExcel}
              title={`Export ${filtered.length} laporan ke Excel (3 sheet)`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 15px', borderRadius: 7,
                border: '1px solid #a7f3d0', background: T.greenBg, color: T.green,
                cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { background: T.green, color: T.white, borderColor: T.green })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: T.greenBg, color: T.green, borderColor: '#a7f3d0' })}
            >
              <FileSpreadsheet size={13} />
              Excel
            </button>

            {/* Export PDF */}
            <button
              onClick={exportToPDF}
              title={`Export ${filtered.length} laporan ke PDF`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 15px', borderRadius: 7,
                border: `1px solid #fca5a5`, background: T.redBg, color: T.red,
                cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { background: T.red, color: T.white, borderColor: T.red })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: T.redBg, color: T.red, borderColor: '#fca5a5' })}
            >
              <FileDown size={13} />
              PDF
            </button>
          </div>
        )}
      </PageHeader>

      {/* ── Draft Restore Banner ── */}
      {canSubmit && hasDraft && !open && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '13px 18px', borderRadius: 10, marginBottom: 4,
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            boxShadow: '0 4px 16px rgba(251,191,36,0.18)',
          }}
        >
          {/* Icon */}
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: '#fef3c7',
            border: '1px solid #fcd34d', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, flexShrink: 0,
          }}>📝</div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
              Draft laporan tersimpan
            </div>
            <div style={{ fontSize: 12, color: '#a16207', marginTop: 1 }}>
              Form yang belum dikirim terdeteksi. Lanjutkan mengisi atau buang draft.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={openWithDraft} style={{
              padding: '8px 16px', borderRadius: 7,
              background: '#f59e0b', color: T.white,
              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <FileText size={12} /> Lanjutkan Draft
            </button>
            <button onClick={discardDraft} style={{
              padding: '8px 14px', borderRadius: 7,
              background: T.white, color: T.gray500,
              border: `1px solid ${T.gray200}`, cursor: 'pointer', fontSize: 12,
            }}>
              Buang
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
          <Activity size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isAuditor ? 'Cari PT, area...' : 'Cari auditor, PT, area...'}
            style={{ ...inp, paddingLeft: 32, fontSize: 13 }}
            onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
        </div>
        {([
          { key: 'all', label: 'Semua', count: countAll, activeBg: T.gray800, activeBorder: T.gray800, inactiveColor: T.gray600, inactiveBorder: T.gray300, activeColor: T.white },
          { key: 'Pending', label: 'Pending', count: countPending, activeBg: '#d97706', activeBorder: '#d97706', inactiveColor: '#92400e', inactiveBorder: '#fcd34d', activeColor: T.white },
          { key: 'Approved', label: 'Approved', count: countApproved, activeBg: T.green, activeBorder: T.green, inactiveColor: T.green, inactiveBorder: '#a7f3d0', activeColor: T.white },
          { key: 'Rejected', label: 'Rejected', count: countRejected, activeBg: T.red, activeBorder: T.red, inactiveColor: T.red, inactiveBorder: '#fca5a5', activeColor: T.white },
        ] as const).map(btn => {
          const isActive = statusFilter === btn.key;
          return (
            <button key={btn.key} onClick={() => setStatusFilter(btn.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: `1px solid ${isActive ? btn.activeBorder : btn.inactiveBorder}`, background: isActive ? btn.activeBg : T.white, color: isActive ? btn.activeColor : btn.inactiveColor, fontFamily: SANS, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {btn.label}
              <span style={{ background: isActive ? 'rgba(255,255,255,0.22)' : T.gray100, color: isActive ? T.white : T.gray500, borderRadius: 99, padding: '0 6px', fontSize: 11, fontFamily: MONO }}>{btn.count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Empty state — hanya tampil kalau tidak ada laporan DAN tidak ada assignment ── */}
      {filtered.length === 0 && Object.keys(byPT).length === 0 && Object.keys(byAuditor).length === 0 && (
        <div style={{ ...card({ padding: 60 }), textAlign: 'center' }}>
          <FileText size={32} style={{ color: T.gray300, marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: T.gray500, fontWeight: 500, marginBottom: 4 }}>
            {reports.length === 0 ? 'Belum ada laporan harian.' : 'Tidak ada laporan yang sesuai filter.'}
          </div>
          {reports.length > 0 && (
            <button onClick={() => { setStatusFilter('all'); setSearch(''); }}
              style={{ marginTop: 10, fontSize: 12, color: T.blue700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Reset filter</button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          VIEW A: Auditor — grouped by PT (dari assignments)
      ══════════════════════════════════════════════ */}
      {isAuditor && Object.keys(byPT).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(byPT).map(([ptName, ptReports], i) => (
            <motion.div key={ptName} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <PTSection ptName={ptName} ptReports={ptReports} expandedId={expandedId} setExpandedId={setExpandedId}
                userRole={user?.role || ''} setApprovalTarget={setApprovalTarget}
                collapsedPTs={collapsedPTs} togglePT={togglePT} />
            </motion.div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          VIEW B: Supervisor/Admin — grouped by Auditor → PT
      ══════════════════════════════════════════════ */}
      {!isAuditor && Object.keys(byAuditor).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(byAuditor).map(([auditorName, auditPTs], i) => {
            const aStats = auditorStats(auditPTs);
            const isAuditorCollapsed = collapsedAuditors.has(auditorName);
            return (
              <motion.div key={auditorName} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                style={{ border: `1px solid ${T.gray200}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

                {/* ── Auditor Header ── */}
                <div onClick={() => toggleAuditor(auditorName)}
                  style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${T.blue900} 0%, ${T.blue800} 100%)`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }}>
                  {/* Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: T.white, flexShrink: 0 }}>
                    {auditorName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.white }}>{auditorName}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span><Building2 size={10} style={{ display: 'inline', marginRight: 3 }} />{aStats.totalPT} PT</span>
                      <span><FileText size={10} style={{ display: 'inline', marginRight: 3 }} />{aStats.totalLaporan} laporan</span>
                    </div>
                  </div>
                  {/* Stats badges */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {aStats.pending > 0 && (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: T.yellowBg, color: T.yellow, border: '1px solid #fcd34d', fontWeight: 600 }}>⏳ {aStats.pending} Pending</span>
                    )}
                    {aStats.approved > 0 && (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: T.greenBg, color: T.green, border: '1px solid #a7f3d0', fontWeight: 600 }}>✓ {aStats.approved}</span>
                    )}
                    {aStats.rejected > 0 && (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: T.redBg, color: T.red, border: '1px solid #fca5a5', fontWeight: 600 }}>✗ {aStats.rejected}</span>
                    )}
                    {/* Avg progress */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: 20 }}>
                      <div style={{ width: 50, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${aStats.avgProgress}%`, background: T.white, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: T.white, fontWeight: 700 }}>{aStats.avgProgress}%</span>
                    </div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                    {isAuditorCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </div>
                </div>

                {/* ── PT sections inside auditor ── */}
                {!isAuditorCollapsed && (
                  <div style={{ padding: '10px 12px', background: T.bg, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(auditPTs).map(([ptName, ptReports]) => (
                      <PTSection key={ptName} ptName={ptName} ptReports={ptReports}
                        expandedId={expandedId} setExpandedId={setExpandedId}
                        userRole={user?.role || ''} setApprovalTarget={setApprovalTarget}
                        collapsedPTs={collapsedPTs} togglePT={togglePT} />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Modal Buat Laporan ── */}
      <Modal open={open} onClose={closeModal} title="Buat Laporan Harian" subtitle="Isi aktivitas audit hari ini" wide>
        <form onSubmit={submit}>
          <Field label="PT / Penugasan">
            {isSPV ? (
              // SPV & Manager: tampilkan semua PT aktif
              <Select required value={form.pt_id} onChange={f('pt_id')}>
                <option value="">-- Pilih PT --</option>
                {spvPts.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nama_pt}</option>
                ))}
              </Select>
            ) : (
              // Auditor: tampilkan assignment miliknya
              <Select required value={form.assignment_id} onChange={f('assignment_id')}>
                <option value="">-- Pilih PT yang sedang diaudit --</option>
                {assignments.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.nama_pt}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tanggal Laporan"><Input required type="date" value={form.tanggal} onChange={f('tanggal')} /></Field>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Jam Mulai" half><Input required type="time" value={form.jam_mulai} onChange={f('jam_mulai')} /></Field>
            <Field label="Jam Selesai" half><Input required type="time" value={form.jam_selesai} onChange={f('jam_selesai')} /></Field>
          </div>
          <Field label="Area yang Diaudit"><Input required value={form.area_diaudit} onChange={f('area_diaudit')} placeholder="mis: Keuangan, Gudang, SDM" /></Field>
          <Field label="Deskripsi Pekerjaan"><Textarea required rows={3} value={form.deskripsi_pekerjaan} onChange={f('deskripsi_pekerjaan')} placeholder="Uraikan pekerjaan yang dilakukan..." /></Field>
          <Field label="Temuan (Opsional)"><Textarea rows={2} value={form.temuan} onChange={f('temuan')} placeholder="Tuliskan temuan jika ada..." /></Field>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Progress (%)" half>
              <input type="number" min="0" max="100" required value={form.progress}
                onChange={e => setForm(p => ({ ...p, progress: parseInt(e.target.value) || 0 }))}
                style={inp} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
            </Field>
            <Field label="Status" half>
              <Select value={form.status} onChange={f('status')}>
                <option value="Ongoing">Sedang Berjalan</option>
                <option value="Completed">Selesai</option>
              </Select>
            </Field>
          </div>
          <Field label="Kendala / Hambatan (Opsional)"><Input value={form.kendala} onChange={f('kendala')} placeholder="Tuliskan kendala jika ada..." /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
            {/* Auto-save status indicator */}
            <div style={{ fontSize: 11, color: T.gray400, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              {draftSavedAt ? (
                <>
                  <CheckCircle2 size={11} style={{ color: T.green, flexShrink: 0 }} />
                  <span>Draft tersimpan otomatis · {draftSavedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              ) : (
                <>
                  <Clock size={11} style={{ flexShrink: 0 }} />
                  <span>Akan disimpan otomatis...</span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <BtnSecondary onClick={closeModal}>Batal</BtnSecondary>
              <BtnPrimary type="submit" disabled={saving}>{saving ? 'Mengirim...' : 'Kirim Laporan'}</BtnPrimary>
            </div>
          </div>
        </form>
      </Modal>

      <ApprovalModal target={approvalTarget} onConfirm={(id, action, notes) => approve(id, action, notes)} onClose={() => setApprovalTarget(null)} />
    </div>
  );
};

// ─── PASSWORD INPUT WITH SHOW/HIDE ───────────────────────────────────────────
const PasswordInput = ({ value, onChange, placeholder = '••••••••', name = '' }: any) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value} onChange={onChange} name={name}
        placeholder={placeholder}
        style={{ ...inp, paddingRight: 38 }}
        onFocus={e => Object.assign(e.target.style, focus)}
        onBlur={e => Object.assign(e.target.style, blur)}
      />
      <button type="button" onClick={() => setShow(s => !s)} style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', color: T.gray400, padding: 2,
        display: 'flex', alignItems: 'center',
      }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
};

// ─── ROLE BADGE ──────────────────────────────────────────────────────────────
const RoleBadge = ({ role }: { role: string }) => {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    Admin:      { color: '#5521b5', bg: '#edebfe', border: '#ddd6fe' },
    Supervisor: { color: T.blue700, bg: T.blue50,  border: T.blue100 },
    Manager:    { color: '#0f766e', bg: '#f0fdfa',  border: '#99f6e4' },
    Auditor:    { color: T.green,   bg: T.greenBg, border: '#a7f3d0' },
  };
  const s = map[role] || map.Auditor;
  return (
    <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      <Shield size={10} /> {role}
    </span>
  );
};

// ─── REPORT MONITOR (Admin) ──────────────────────────────────────────────────
const ReportMonitor = () => {
  const { user: me } = useAuth();

  type ITab = 'manager' | 'spv' | 'auditor';
  const [tab, setTab]               = useState<ITab>('manager');
  const [spvLogs, setSpvLogs]       = useState<any[]>([]);
  const [auditReps, setAuditReps]   = useState<any[]>([]);
  const [allUsers, setAllUsers]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [dateFrom, setDateFrom]     = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; });
  const [dateTo, setDateTo]         = useState<string>(new Date().toISOString().split('T')[0]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedSpv, setExpandedSpv] = useState<string | null>(null);
  const [expandedAud, setExpandedAud] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, u] = await Promise.all([
        apiFetch('/api/spv-reports', me?.id).then(r => r.json()),
        apiFetch('/api/reports',     me?.id).then(r => r.json()),
        apiFetch('/api/users',       me?.id).then(r => r.json()),
      ]);
      setSpvLogs(Array.isArray(s) ? s : []);
      setAuditReps(Array.isArray(a) ? a : []);
      setAllUsers(Array.isArray(u) ? u : []);
    } catch { /* silent */ }
    setLoading(false);
  }, [me?.id]);

  useEffect(() => { load(); }, [load]);

  // ── derived ──
  const managerLogs    = spvLogs.filter(r => r.author_role === 'Manager');
  const supervisorLogs = spvLogs.filter(r => r.author_role === 'Supervisor');
  const auditors       = allUsers.filter(u => u.role === 'Auditor');

  // spv id → name
  const spvMap: Record<string, string> = {};
  for (const u of allUsers) if (u.role === 'Supervisor') spvMap[String(u.id)] = u.full_name;

  // auditor_id → reports[]
  const repsByAud: Record<number, any[]> = {};
  for (const r of auditReps) {
    const aid = r.auditor_id;
    if (!repsByAud[aid]) repsByAud[aid] = [];
    repsByAud[aid].push(r);
  }

  // auditors grouped by supervisor_id
  const audsBySpv: Record<string, any[]> = {};
  for (const a of auditors) {
    const key = a.supervisor_id ? String(a.supervisor_id) : 'unassigned';
    if (!audsBySpv[key]) audsBySpv[key] = [];
    audsBySpv[key].push(a);
  }

  const MONS  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  const DAYS  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const fmtM  = (k: string) => { const [y,m] = k.split('-'); return `${MONS[+m-1]} ${y}`; };
  const badge = (tgl: string) => { const d = new Date(tgl+'T00:00:00'); return { day: d.getDate(), mon: MONS[d.getMonth()], dow: DAYS[d.getDay()] }; };

  // filter for manager/spv timeline
  const applyFilter = (list: any[]) => list.filter(l => {
    const q   = search.toLowerCase();
    const tgl = l.tanggal || '';
    const s = !q || [l.author_name, l.judul, l.isi].some(v => v?.toLowerCase().includes(q));
    const f = !dateFrom || tgl >= dateFrom;
    const t = !dateTo   || tgl <= dateTo;
    return s && f && t;
  });

  // ── shared styles ──
  const tabBtn = (active: boolean): CSSProperties => ({
    padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS,
    fontSize: 13, fontWeight: active ? 700 : 500,
    background: active ? T.blue700 : T.gray100, color: active ? T.white : T.gray600,
    transition: 'all 0.15s',
  });

  // ── helpers ──
  const groupByDate = (list: any[]) => list.reduce((acc: Record<string, any[]>, l) => {
    const k = l.tanggal || '—'; if (!acc[k]) acc[k] = []; acc[k].push(l); return acc;
  }, {} as Record<string, any[]>);

  const fmtFullDate = (tgl: string) => {
    const d = new Date(tgl + 'T00:00:00');
    return `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} ${MONS[d.getMonth()]} ${d.getFullYear()}`;
  };

  // ── Daily feed for Manager / SPV ──
  const TimelineTab = ({ list, prefix }: { list: any[]; prefix: string }) => {
    const [expandedMon, setExpandedMon] = useState<Set<string>>(() => new Set([new Date().toISOString().slice(0, 7)]));
    const toggleMon = (k: string) => setExpandedMon(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

    if (list.length === 0) return (
      <div style={{ textAlign: 'center', padding: '56px 20px', color: T.gray400 }}>
        <BookOpen size={36} style={{ marginBottom: 12, opacity: .25 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: T.gray600, marginBottom: 4 }}>Belum ada catatan</div>
        <div style={{ fontSize: 12 }}>Tidak ada data yang sesuai filter</div>
      </div>
    );

    const accentCol = prefix === 'mgr' ? '#7c3aed' : T.blue700;
    const accentBg  = prefix === 'mgr' ? '#f5f3ff' : T.blue50;
    const accentBdr = prefix === 'mgr' ? '#ddd6fe' : T.blue100;

    // group by month, then by date within each month
    const byMonth: Record<string, any[]> = list.reduce((acc: Record<string, any[]>, l) => {
      const k = (l.tanggal || '—').slice(0, 7); if (!acc[k]) acc[k] = []; acc[k].push(l); return acc;
    }, {} as Record<string, any[]>);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([monKey, monEntries]) => {
          const isExpMon = expandedMon.has(monKey);
          const grouped: Record<string, any[]> = groupByDate(monEntries as any[]);
          return (
            <div key={monKey} style={{ marginBottom: 20 }}>
              {/* ── Month header — collapsible ── */}
              <button onClick={() => toggleMon(monKey)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: isExpMon ? 12 : 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: accentCol, letterSpacing: '0.1em', textTransform: 'uppercase', background: accentBg, border: `1px solid ${accentBdr}`, borderRadius: 20, padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {isExpMon ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {fmtM(monKey)}
                </div>
                <div style={{ flex: 1, height: 1, background: T.gray200 }} />
                <span style={{ fontSize: 11, color: T.gray400 }}>{monEntries.length} catatan</span>
              </button>

              {/* ── Date groups (only if month expanded) ── */}
              {isExpMon && Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([tgl, entries]) => (
                <div key={tgl} style={{ marginBottom: 18 }}>
                  {/* ── Date header ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.blue900, borderRadius: 10, padding: '5px 14px' }}>
                      <CalendarDays size={12} color="rgba(255,255,255,0.7)" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.white, letterSpacing: '.02em' }}>{fmtFullDate(tgl)}</span>
                    </div>
                    <div style={{ flex: 1, height: 1, background: T.gray200 }} />
                    {entries.length > 1 && (
                      <span style={{ fontSize: 11, color: T.gray400 }}>{entries.length} entri</span>
                    )}
                  </div>

                  {/* ── Entries for this date ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {entries.map((log: any) => {
                const key   = `${prefix}-${log.id}`;
                const isExp = expandedKey === key;
                const keg   = (log.kegiatan || '').split('\n').map((s: string) => s.trim()).filter(Boolean);
                const init  = (log.author_name || '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

                return (
                  <div key={log.id} style={{
                    background: T.white, borderRadius: 12,
                    border: `1px solid ${isExp ? accentBdr : T.gray200}`,
                    boxShadow: isExp ? `0 0 0 2px ${accentBg}` : '0 1px 3px rgba(0,0,0,.04)',
                    overflow: 'hidden', transition: 'all 0.15s',
                  }}>
                    {/* ── Always-visible body ── */}
                    <div style={{ padding: '14px 16px' }}>
                      {/* Author row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                            background: `linear-gradient(135deg, ${accentCol}, ${prefix === 'mgr' ? '#a855f7' : T.blue500})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, color: T.white,
                          }}>{init}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T.gray900 }}>{log.author_name}</div>
                            <div style={{ fontSize: 10, color: T.gray400, marginTop: 1 }}>
                              {log.created_at?.slice(11, 16) ? `Input pukul ${log.created_at.slice(11, 16)}` : '—'}
                            </div>
                          </div>
                        </div>
                        {(log.kendala || log.rencana) && (
                          <div style={{ display: 'flex', gap: 5 }}>
                            {log.kendala && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: T.red, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <AlertTriangle size={9} /> Kendala
                              </span>
                            )}
                            {log.rencana && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: T.green, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <CalendarDays size={9} /> Rencana
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Judul */}
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.gray900, marginBottom: 8, lineHeight: 1.3 }}>{log.judul}</div>

                      {/* Isi — always shown, 3 lines max unless expanded */}
                      <div style={{
                        fontSize: 13, color: T.gray600, lineHeight: 1.7, marginBottom: keg.length ? 10 : 0,
                        ...(isExp ? { whiteSpace: 'pre-wrap' } : {
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                        }),
                      }}>{log.isi}</div>

                      {/* Kegiatan chips — always visible */}
                      {keg.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: isExp ? 12 : 0 }}>
                          {keg.map((k: string, i: number) => (
                            <span key={i} style={{ fontSize: 11, background: accentBg, color: accentCol, padding: '3px 10px', borderRadius: 20, border: `1px solid ${accentBdr}`, fontWeight: 500 }}>{k}</span>
                          ))}
                        </div>
                      )}

                      {/* Expanded: kendala + rencana */}
                      {isExp && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: keg.length ? 0 : 4 }}>
                          {log.kendala && (
                            <div style={{ padding: '10px 13px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fca5a5' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.red, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <AlertTriangle size={11} /> Kendala
                              </div>
                              <div style={{ fontSize: 12, color: T.gray700, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{log.kendala}</div>
                            </div>
                          )}
                          {log.rencana && (
                            <div style={{ padding: '10px 13px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <CalendarDays size={11} /> Rencana Besok
                              </div>
                              <div style={{ fontSize: 12, color: T.gray700, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{log.rencana}</div>
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: T.gray400, paddingTop: 2 }}>
                            Dibuat {log.created_at?.slice(0, 16) || '—'}
                            {log.updated_at && log.updated_at !== log.created_at ? ` · Diedit ${log.updated_at.slice(0, 16)}` : ''}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Expand toggle — only if there's kendala/rencana or isi is long ── */}
                    {(log.kendala || log.rencana || (log.isi || '').length > 200) && (
                      <button onClick={() => setExpandedKey(isExp ? null : key)}
                        style={{
                          width: '100%', padding: '7px 0', border: 'none', borderTop: `1px solid ${T.gray100}`,
                          background: T.gray50, cursor: 'pointer', fontFamily: SANS, fontSize: 11,
                          color: T.gray500, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                        {isExp ? <><ChevronUp size={12} /> Sembunyikan</> : <><ChevronDown size={12} /> Lihat selengkapnya</>}
                      </button>
                    )}
                    </div>
                  );
                })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Auditor per SPV — clean card layout ──
  const AuditorTab = () => {
    const entries = Object.entries(audsBySpv);
    if (entries.length === 0) return (
      <div style={{ textAlign: 'center', padding: '56px 20px', color: T.gray400 }}>
        <Users size={40} style={{ marginBottom: 12, opacity: .2 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: T.gray600 }}>Belum ada data auditor</div>
      </div>
    );

    const sorted = entries.sort(([a], [b]) =>
      a === 'unassigned' ? 1 : b === 'unassigned' ? -1 : 0
    );

    const stCol: Record<string, string> = { Approved: T.green, Rejected: T.red, Pending: '#b45309' };
    const stBg:  Record<string, string> = { Approved: '#dcfce7', Rejected: '#fee2e2', Pending: '#fef3c7' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sorted.map(([spvKey, spvAuds]) => {
          const isUnassigned = spvKey === 'unassigned';
          const spvName      = isUnassigned ? 'Belum Assign' : (spvMap[spvKey] || `SPV #${spvKey}`);
          const q            = search.toLowerCase();
          const filtAuds     = !q ? spvAuds : spvAuds.filter((a: any) =>
            a.full_name?.toLowerCase().includes(q) || a.username?.toLowerCase().includes(q) ||
            (repsByAud[a.id] || []).some((r: any) => r.nama_pt?.toLowerCase().includes(q))
          );
          if (filtAuds.length === 0 && q) return null;

          // aggregate stats for this SPV
          const allReps    = spvAuds.flatMap((a: any) => repsByAud[a.id] || []);
          const totalReps  = allReps.length;
          const cntApp     = allReps.filter((r: any) => r.approval_status === 'Approved').length;
          const cntPend    = allReps.filter((r: any) => r.approval_status === 'Pending').length;
          const cntRej     = allReps.filter((r: any) => r.approval_status === 'Rejected').length;
          const initials   = spvName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

          return (
            <div key={spvKey}>
              {/* ── SPV Header card ── */}
              <div style={{
                background: isUnassigned
                  ? `linear-gradient(135deg, ${T.gray100} 0%, ${T.gray50} 100%)`
                  : `linear-gradient(135deg, ${T.blue900} 0%, #1a4478 100%)`,
                borderRadius: '14px 14px 0 0',
                padding: '18px 22px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                borderLeft: `4px solid ${isUnassigned ? T.gray400 : T.blue500}`,
              }}>
                {/* Left: avatar + info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: isUnassigned ? T.gray300 : 'rgba(255,255,255,0.15)',
                    border: `2px solid ${isUnassigned ? T.gray400 : 'rgba(255,255,255,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800,
                    color: isUnassigned ? T.gray600 : T.white,
                  }}>
                    {isUnassigned ? <AlertTriangle size={20} color={T.gray500} /> : initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: isUnassigned ? T.gray600 : T.white, lineHeight: 1.2 }}>
                      {spvName}
                    </div>
                    <div style={{ fontSize: 12, color: isUnassigned ? T.gray400 : 'rgba(255,255,255,0.6)', marginTop: 3 }}>
                      Supervisor · {filtAuds.length} auditor
                    </div>
                  </div>
                </div>

                {/* Right: stat pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '6px 14px' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isUnassigned ? T.gray700 : T.white }}>{totalReps}</div>
                    <div style={{ fontSize: 10, color: isUnassigned ? T.gray500 : 'rgba(255,255,255,0.55)', marginTop: 1 }}>Total</div>
                  </div>
                  {cntApp > 0 && (
                    <div style={{ textAlign: 'center', background: '#dcfce7', borderRadius: 10, padding: '6px 14px' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>{cntApp}</div>
                      <div style={{ fontSize: 10, color: T.green, marginTop: 1 }}>Approved</div>
                    </div>
                  )}
                  {cntPend > 0 && (
                    <div style={{ textAlign: 'center', background: '#fef3c7', borderRadius: 10, padding: '6px 14px' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#b45309' }}>{cntPend}</div>
                      <div style={{ fontSize: 10, color: '#b45309', marginTop: 1 }}>Pending</div>
                    </div>
                  )}
                  {cntRej > 0 && (
                    <div style={{ textAlign: 'center', background: '#fee2e2', borderRadius: 10, padding: '6px 14px' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: T.red }}>{cntRej}</div>
                      <div style={{ fontSize: 10, color: T.red, marginTop: 1 }}>Rejected</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Auditor cards grid ── */}
              <div style={{
                background: T.white,
                border: `1px solid ${T.gray200}`, borderTop: 'none',
                borderRadius: '0 0 14px 14px',
                padding: '18px 18px 8px',
              }}>
                {filtAuds.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: T.gray400 }}>
                    Tidak ada auditor yang sesuai pencarian
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 10 }}>
                    {filtAuds.map((aud: any) => {
                      const reps     = (repsByAud[aud.id] || []).filter((r: any) => (!dateFrom || (r.tanggal || '') >= dateFrom) && (!dateTo || (r.tanggal || '') <= dateTo));
                      const isExp    = expandedAud === aud.id;
                      const app      = reps.filter((r: any) => r.approval_status === 'Approved').length;
                      const pend     = reps.filter((r: any) => r.approval_status === 'Pending').length;
                      const rej      = reps.filter((r: any) => r.approval_status === 'Rejected').length;
                      const avgProg  = reps.length ? Math.round(reps.reduce((s: number, r: any) => s + (r.progress || 0), 0) / reps.length) : 0;
                      const progCol  = avgProg >= 80 ? T.green : avgProg >= 50 ? T.blue600 : '#b45309';
                      const audInit  = aud.full_name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

                      return (
                        <div key={aud.id} style={{
                          border: `1.5px solid ${isExp ? T.blue100 : T.gray200}`,
                          borderRadius: 12,
                          background: isExp ? '#f7f9ff' : T.white,
                          overflow: 'hidden',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}>
                          {/* Card body */}
                          <div style={{ padding: '14px 16px' }}>
                            {/* Avatar row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                background: `linear-gradient(135deg, ${T.blue700}, ${T.blue500})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 800, color: T.white,
                              }}>{audInit}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: T.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{aud.full_name}</div>
                                <div style={{ fontSize: 11, color: T.gray400, marginTop: 1 }}>@{aud.username}</div>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <span style={{ fontSize: 11, color: T.gray500 }}>Avg. Progress</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: progCol }}>{avgProg}%</span>
                              </div>
                              <div style={{ height: 5, background: T.gray100, borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${avgProg}%`, background: progCol, borderRadius: 4, transition: 'width 0.4s ease' }} />
                              </div>
                            </div>

                            {/* Stats row */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                              {[
                                { label: 'Approved', val: app,  col: T.green,   bg: '#dcfce7' },
                                { label: 'Pending',  val: pend, col: '#b45309', bg: '#fef3c7' },
                                { label: 'Rejected', val: rej,  col: T.red,     bg: '#fee2e2' },
                              ].map(s => (
                                <div key={s.label} style={{
                                  flex: 1, textAlign: 'center', background: s.val > 0 ? s.bg : T.gray50,
                                  borderRadius: 8, padding: '5px 4px',
                                }}>
                                  <div style={{ fontSize: 15, fontWeight: 800, color: s.val > 0 ? s.col : T.gray300 }}>{s.val}</div>
                                  <div style={{ fontSize: 9, color: s.val > 0 ? s.col : T.gray300, marginTop: 1, fontWeight: 600 }}>{s.label}</div>
                                </div>
                              ))}
                            </div>

                            {/* Expand button */}
                            <button
                              onClick={() => setExpandedAud(isExp ? null : aud.id)}
                              style={{
                                width: '100%', padding: '7px 0', borderRadius: 8,
                                border: `1px solid ${isExp ? T.blue100 : T.gray200}`,
                                background: isExp ? T.blue50 : T.white,
                                color: isExp ? T.blue700 : T.gray600,
                                fontFamily: SANS, fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                transition: 'all 0.15s',
                              }}
                            >
                              {isExp ? <><ChevronUp size={13} /> Sembunyikan</> : <><ChevronDown size={13} /> {reps.length} Laporan</>}
                            </button>
                          </div>

                          {/* Expanded report list — day-by-day feed */}
                          {isExp && (
                            <div style={{ borderTop: `1px solid ${T.blue100}`, background: '#fafbff' }}>
                              {reps.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: T.gray400 }}>
                                  Belum ada laporan dalam rentang yang dipilih
                                </div>
                              ) : (
                                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {Object.entries(groupByDate(reps)).sort(([a], [b]) => b.localeCompare(a)).map(([tgl, dayReps]) => (
                                    <div key={tgl}>
                                      {/* Day label */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: T.blue700, background: T.blue50, border: `1px solid ${T.blue100}`, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                          {fmtFullDate(tgl)}
                                        </div>
                                        <div style={{ flex: 1, height: 1, background: T.gray200 }} />
                                      </div>
                                      {/* Reports for this day */}
                                      {(dayReps as any[]).map((rep: any) => {
                                        const pct = rep.progress || 0;
                                        const pc  = pct >= 80 ? T.green : pct >= 50 ? T.blue600 : '#b45309';
                                        return (
                                          <div key={rep.id} style={{
                                            background: T.white, borderRadius: 10,
                                            border: `1px solid ${T.gray200}`,
                                            padding: '11px 13px', marginBottom: 6,
                                            boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                                          }}>
                                            {/* Top row: PT + time + status */}
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                                              <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: T.gray900 }}>{rep.nama_pt}</div>
                                                <div style={{ fontSize: 11, color: T.gray400, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                  <Clock size={10} /> {rep.jam_mulai} – {rep.jam_selesai}
                                                  <span style={{ color: T.gray300 }}>·</span>
                                                  <MapPin size={10} /> {rep.area_diaudit}
                                                </div>
                                              </div>
                                              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0, marginLeft: 8, background: stBg[rep.approval_status] || T.gray100, color: stCol[rep.approval_status] || T.gray500 }}>
                                                {rep.approval_status || 'Draft'}
                                              </span>
                                            </div>
                                            {/* Description */}
                                            <div style={{ fontSize: 12, color: T.gray600, lineHeight: 1.6, marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                              {rep.deskripsi_pekerjaan}
                                            </div>
                                            {/* Temuan */}
                                            {rep.temuan && (
                                              <div style={{ fontSize: 11, color: T.red, marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 5, background: '#fff5f5', padding: '5px 9px', borderRadius: 6 }}>
                                                <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                                                <span>{rep.temuan}</span>
                                              </div>
                                            )}
                                            {/* Progress */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                              <div style={{ flex: 1, height: 5, background: T.gray100, borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', background: pc, borderRadius: 3, transition: 'width 0.4s' }} />
                                              </div>
                                              <span style={{ fontSize: 12, fontWeight: 700, color: pc, flexShrink: 0, minWidth: 34, textAlign: 'right' }}>{pct}%</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                  {reps.length > 15 && (
                                    <div style={{ fontSize: 11, color: T.gray400, textAlign: 'center', paddingTop: 2 }}>
                                      Menampilkan semua {reps.length} laporan — gunakan filter bulan untuk mempersempit
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── summary stats ──
  const pendingCnt = auditReps.filter(r => r.approval_status === 'Pending').length;

  return (
    <div>
      <PageHeader title="Monitor Laporan" breadcrumb="Monitor Laporan">
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.gray200}`, background: T.white, cursor: 'pointer', fontFamily: SANS, fontSize: 12, color: T.gray600 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </PageHeader>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Catatan Manager',   value: managerLogs.length,    color: '#7c3aed', bg: '#ede9fe', icon: Shield },
          { label: 'Catatan Supervisor', value: supervisorLogs.length, color: T.blue700, bg: T.blue50,  icon: UserCheck },
          { label: 'Laporan Auditor',   value: auditReps.length,      color: T.green,   bg: T.greenBg, icon: FileText },
          { label: 'Pending Approval',  value: pendingCnt,            color: '#92400e', bg: '#fef3c7', icon: Clock },
        ].map(s => (
          <div key={s.label} style={{ background: T.white, borderRadius: 12, padding: '14px 16px', border: `1px solid ${T.gray200}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: T.gray500, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Inner tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { id: 'manager', label: `Manager  (${managerLogs.length})` },
          { id: 'spv',     label: `Supervisor  (${supervisorLogs.length})` },
          { id: 'auditor', label: `Auditor per SPV` },
        ] as { id: ITab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── Search + date filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 200, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
          <input type="text" placeholder={tab === 'auditor' ? 'Cari nama auditor / PT...' : 'Cari nama, judul...'} value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp, paddingLeft: 34 }} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
        </div>
        {/* Presets */}
        {(() => {
          const todayStr    = new Date().toISOString().split('T')[0];
          const d7AgoStr    = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })();
          const monthStart  = `${todayStr.slice(0, 7)}-01`;
          const presets = [
            { label: 'Hari Ini',  from: todayStr,    to: todayStr },
            { label: '7 Hari',    from: d7AgoStr,    to: todayStr },
            { label: 'Bulan Ini', from: monthStart,  to: todayStr },
            { label: 'Semua',     from: '',          to: '' },
          ];
          return presets.map(p => {
            const active = dateFrom === p.from && dateTo === p.to;
            return (
              <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? T.blue600 : T.gray200}`, background: active ? T.blue50 : T.white, color: active ? T.blue700 : T.gray600, fontFamily: SANS, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {p.label}
              </button>
            );
          });
        })()}
        {/* Custom range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ ...inp, width: 140 }} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
          <span style={{ fontSize: 12, color: T.gray400 }}>–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ ...inp, width: 140 }} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: T.gray400 }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
          <div>Memuat semua laporan...</div>
        </div>
      ) : (
        <>
          {tab === 'manager' && <TimelineTab list={applyFilter(managerLogs)} prefix="mgr" />}
          {tab === 'spv'     && <TimelineTab list={applyFilter(supervisorLogs)} prefix="spv" />}
          {tab === 'auditor' && <AuditorTab />}
        </>
      )}
    </div>
  );
};

// ─── SPV / MANAGER DAILY LOG ─────────────────────────────────────────────────
const SpvDailyLog = () => {
  const { user: me } = useAuth();
  const toast = useToast();

  const [logs, setLogs]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [editLog, setEditLog]     = useState<any | null>(null);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  const [dateFrom, setDateFrom]     = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; });
  const [dateTo, setDateTo]         = useState<string>(new Date().toISOString().split('T')[0]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set([new Date().toISOString().slice(0, 7)]));

  const today = new Date().toISOString().split('T')[0];
  const initForm = { tanggal: today, judul: '', isi: '', kegiatan: '', kendala: '', rencana: '' };
  const [form, setForm] = useState(initForm);
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/spv-reports', me?.id)
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [me?.id]);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setForm({ ...initForm, tanggal: new Date().toISOString().split('T')[0] }); setEditLog(null); setOpen(true); };
  const openEdit = (log: any) => {
    setForm({ tanggal: log.tanggal, judul: log.judul, isi: log.isi, kegiatan: log.kegiatan || '', kendala: log.kendala || '', rencana: log.rencana || '' });
    setEditLog(log); setOpen(true);
  };
  const closeModal = () => { setOpen(false); setEditLog(null); setForm(initForm); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.judul.trim() || !form.isi.trim()) { toast('Judul dan isi wajib diisi', 'error'); return; }
    setSaving(true);
    try {
      const url = editLog ? `/api/spv-reports/${editLog.id}` : '/api/spv-reports';
      const r = await apiFetch(url, me?.id, {
        method: editLog ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal menyimpan'); }
      toast(editLog ? 'Catatan diperbarui' : 'Catatan berhasil disimpan', 'success');
      closeModal(); load();
    } catch (ex: any) { toast(ex.message, 'error'); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    setDeleting(id);
    try {
      const r = await apiFetch(`/api/spv-reports/${id}`, me?.id, { method: 'DELETE' });
      if (!r.ok) throw new Error('Gagal menghapus');
      toast('Catatan dihapus', 'success');
      if (expanded === id) setExpanded(null);
      load();
    } catch (ex: any) { toast(ex.message, 'error'); }
    finally { setDeleting(null); setConfirmDel(null); }
  };

  // ── Stats ──
  const thisMonth   = new Date().toISOString().slice(0, 7);
  const weekStart   = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })();
  const cntMonth    = logs.filter(l => l.tanggal?.startsWith(thisMonth)).length;
  const cntWeek     = logs.filter(l => l.tanggal >= weekStart).length;

  // ── Date filter ──
  const filteredLogs = logs.filter(l => {
    const tgl = l.tanggal || '';
    return (!dateFrom || tgl >= dateFrom) && (!dateTo || tgl <= dateTo);
  });

  const toggleMonth = (key: string) => setExpandedMonths(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  // ── Group by month (YYYY-MM) ──
  const grouped: Record<string, any[]> = filteredLogs.reduce((acc: Record<string, any[]>, log) => {
    const key = (log.tanggal || '—').slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, any[]>);

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  const DAYS   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

  const fmtMonth = (key: string) => {
    const [y, m] = key.split('-');
    return `${MONTHS[parseInt(m) - 1]} ${y}`;
  };
  const fmtBadge = (tgl: string) => {
    const d = new Date(tgl + 'T00:00:00');
    return { day: d.getDate(), mon: MONTHS[d.getMonth()], dow: DAYS[d.getDay()] };
  };

  return (
    <div>
      <PageHeader title="Catatan Harian" breadcrumb="Catatan Harian">
        <BtnPrimary onClick={openAdd}><Plus size={14} /> Buat Catatan</BtnPrimary>
      </PageHeader>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Catatan', value: logs.length, color: T.blue700, bg: T.blue50, icon: BookOpen },
          { label: 'Bulan Ini',     value: cntMonth,    color: T.green,   bg: T.greenBg, icon: CalendarDays },
          { label: 'Minggu Ini',    value: cntWeek,     color: '#7c3aed', bg: '#ede9fe', icon: Activity },
        ].map(s => (
          <div key={s.label} style={{ background: T.white, borderRadius: 12, padding: '16px 18px', border: `1px solid ${T.gray200}`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: T.gray500, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      {!loading && logs.length > 0 && (() => {
        const d7Ago = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })();
        const monthStart = `${today.slice(0, 7)}-01`;
        const presets = [
          { label: 'Hari Ini',  from: today,       to: today },
          { label: '7 Hari',    from: d7Ago,        to: today },
          { label: 'Bulan Ini', from: monthStart,   to: today },
          { label: 'Semua',     from: '',           to: '' },
        ];
        return (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {presets.map(p => {
              const active = dateFrom === p.from && dateTo === p.to;
              return (
                <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? T.blue600 : T.gray200}`, background: active ? T.blue50 : T.white, color: active ? T.blue700 : T.gray600, fontFamily: SANS, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {p.label}
                </button>
              );
            })}
            <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ ...inp, width: 140 }} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
              <span style={{ fontSize: 12, color: T.gray400 }}>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ ...inp, width: 140 }} onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
            </div>
          </div>
        );
      })()}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: T.gray400 }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
          <div>Memuat catatan...</div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: T.gray400 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: T.blue50, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={32} color={T.blue700} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.gray600, marginBottom: 6 }}>Belum ada catatan harian</div>
          <div style={{ fontSize: 13, color: T.gray400, marginBottom: 20 }}>Mulai catat aktivitas dan kegiatan harian Anda di sini</div>
          <BtnPrimary onClick={openAdd}><Plus size={14} /> Buat Catatan Pertama</BtnPrimary>
        </div>
      )}

      {/* ── No results for filter ── */}
      {!loading && logs.length > 0 && filteredLogs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: T.gray400 }}>
          <CalendarDays size={32} style={{ marginBottom: 10, opacity: .3 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: T.gray600, marginBottom: 4 }}>Tidak ada catatan dalam rentang ini</div>
          <div style={{ fontSize: 12 }}>Coba ubah rentang tanggal atau pilih "Semua"</div>
        </div>
      )}

      {/* ── Timeline grouped by month ── */}
      {!loading && Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, monthLogs]) => {
          const isExpMonth = expandedMonths.has(monthKey);
          return (
          <div key={monthKey} style={{ marginBottom: 28 }}>
            {/* Month separator — clickable */}
            <button onClick={() => toggleMonth(monthKey)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: isExpMonth ? 14 : 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.blue700, letterSpacing: '0.1em', textTransform: 'uppercase', background: T.blue50, border: `1px solid ${T.blue100}`, borderRadius: 20, padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {isExpMonth ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {fmtMonth(monthKey)}
              </div>
              <div style={{ flex: 1, height: 1, background: T.gray200 }} />
              <div style={{ fontSize: 11, color: T.gray400 }}>{monthLogs.length} catatan</div>
            </button>

            {/* Entries — only if month is expanded */}
            {isExpMonth && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {monthLogs.map(log => {
                const badge      = fmtBadge(log.tanggal);
                const isExpanded = expanded === log.id;
                const isBusy     = deleting === log.id;
                const kegiatan   = log.kegiatan ? (log.kegiatan as string).split('\n').map((s: string) => s.trim()).filter(Boolean) : [];

                return (
                  <div key={log.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    {/* Date badge */}
                    <div style={{
                      flexShrink: 0, width: 56, textAlign: 'center',
                      background: T.blue900, borderRadius: 12, padding: '8px 4px',
                      color: T.white, boxShadow: '0 2px 6px rgba(30,58,95,0.25)',
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{badge.day}</div>
                      <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{badge.mon}</div>
                      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 1 }}>{badge.dow}</div>
                    </div>

                    {/* Card */}
                    <div style={{
                      flex: 1, background: T.white, borderRadius: 12,
                      border: `1px solid ${isExpanded ? T.blue100 : T.gray200}`,
                      boxShadow: isExpanded ? `0 0 0 2px ${T.blue50}` : 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s', overflow: 'hidden',
                    }}>
                      {/* Card header (always visible) */}
                      <div
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer', gap: 10 }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900, marginBottom: 3 }}>{log.judul}</div>
                          {!isExpanded && (
                            <div style={{
                              fontSize: 12, color: T.gray500, lineHeight: 1.5,
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>{log.isi}</div>
                          )}
                          {!isExpanded && kegiatan.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                              {kegiatan.slice(0, 4).map((k: string, i: number) => (
                                <span key={i} style={{ fontSize: 10, background: T.blue50, color: T.blue700, padding: '2px 7px', borderRadius: 20, border: `1px solid ${T.blue100}` }}>{k}</span>
                              ))}
                              {kegiatan.length > 4 && <span style={{ fontSize: 10, color: T.gray400 }}>+{kegiatan.length - 4}</span>}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(log); }}
                            title="Edit"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: T.blue600, display: 'flex', transition: 'background 0.12s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = T.blue50)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          ><Edit2 size={13} /></button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDel(log); }}
                            title="Hapus"
                            disabled={isBusy}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: T.red, display: 'flex', transition: 'background 0.12s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = T.redBg)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            {isBusy ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                          </button>
                          <div style={{ color: T.gray300, marginLeft: 2 }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${T.gray100}` }}>
                          {/* Isi */}
                          <div style={{ fontSize: 13, color: T.gray700, lineHeight: 1.75, marginTop: 12, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                            {log.isi}
                          </div>

                          {/* Kegiatan chips */}
                          {kegiatan.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.gray500, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Kegiatan</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {kegiatan.map((k: string, i: number) => (
                                  <span key={i} style={{ fontSize: 12, background: T.blue50, color: T.blue700, padding: '4px 10px', borderRadius: 20, border: `1px solid ${T.blue100}` }}>
                                    {k}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Kendala */}
                          {log.kendala && (
                            <div style={{ marginBottom: 8, padding: '10px 12px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fca5a5' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.red, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <AlertTriangle size={11} /> Kendala
                              </div>
                              <div style={{ fontSize: 12, color: T.gray700, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{log.kendala}</div>
                            </div>
                          )}

                          {/* Rencana besok */}
                          {log.rencana && (
                            <div style={{ marginBottom: 8, padding: '10px 12px', background: T.greenBg, borderRadius: 8, border: '1px solid #a7f3d0' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <CalendarDays size={11} /> Rencana Besok
                              </div>
                              <div style={{ fontSize: 12, color: T.gray700, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{log.rencana}</div>
                            </div>
                          )}

                          {/* Meta */}
                          <div style={{ marginTop: 10, fontSize: 11, color: T.gray400, display: 'flex', gap: 12 }}>
                            <span>📅 {log.created_at?.slice(0, 16) || '—'}</span>
                            {log.updated_at && log.updated_at !== log.created_at && (
                              <span>✏️ Diperbarui {log.updated_at?.slice(0, 16)}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
          );
        })}

      {/* ── Create / Edit Modal ── */}
      <Modal open={open} onClose={closeModal} title={editLog ? 'Edit Catatan Harian' : 'Buat Catatan Harian'} subtitle="Catat aktivitas dan kegiatan harian Anda" wide>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, marginBottom: 4 }}>
            <Field label="Tanggal">
              <input type="date" value={form.tanggal} onChange={f('tanggal')} required style={inp}
                onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
            </Field>
            <Field label="Judul">
              <input type="text" value={form.judul} onChange={f('judul')} required placeholder="Ringkasan singkat hari ini" style={inp}
                onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
            </Field>
          </div>

          <Field label="Catatan / Aktivitas *">
            <Textarea value={form.isi} onChange={f('isi')} required rows={5}
              placeholder="Deskripsikan aktivitas, kegiatan, dan hasil kerja hari ini secara bebas..." />
          </Field>

          <Field label="Kegiatan (satu per baris, opsional)">
            <Textarea value={form.kegiatan} onChange={f('kegiatan')} rows={3}
              placeholder={'Rapat Tim\nReview Laporan Auditor\nKunjungan PT ABC'} />
            <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>Setiap baris akan tampil sebagai tag kegiatan</div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Kendala (opsional)">
              <Textarea value={form.kendala} onChange={f('kendala')} rows={3}
                placeholder="Hambatan atau kendala yang dihadapi hari ini..." />
            </Field>
            <Field label="Rencana Besok (opsional)">
              <Textarea value={form.rencana} onChange={f('rencana')} rows={3}
                placeholder="Rencana kegiatan untuk hari berikutnya..." />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <BtnSecondary type="button" onClick={closeModal}>Batal</BtnSecondary>
            <BtnPrimary type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : (editLog ? 'Simpan Perubahan' : 'Simpan Catatan')}
            </BtnPrimary>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Hapus Catatan?" subtitle="Tindakan ini tidak dapat dibatalkan">
        <div style={{ fontSize: 13, color: T.gray700, marginBottom: 6 }}>
          Catatan <strong>"{confirmDel?.judul}"</strong> ({confirmDel?.tanggal}) akan dihapus permanen.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <BtnSecondary onClick={() => setConfirmDel(null)}>Batal</BtnSecondary>
          <button
            onClick={() => remove(confirmDel?.id)}
            disabled={!!deleting}
            style={{ padding: '9px 18px', borderRadius: 8, background: T.red, color: T.white, border: 'none', fontFamily: SANS, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Trash2 size={13} /> {deleting ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────
const UserManagement = () => {
  const { user: me } = useAuth();
  const toast = useToast();

  // State
  const [users, setUsers]           = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [open, setOpen]             = useState(false);
  const [editUser, setEditUser]     = useState<any | null>(null);
  const [pwModal, setPwModal]       = useState<any | null>(null); // user target reset pw
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null); // user target delete
  const [deleting, setDeleting]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showPw, setShowPw]         = useState(false);

  const initForm = { username: '', password: '', full_name: '', role: 'Auditor', email: '', supervisor_id: '' };
  const [form, setForm]             = useState(initForm);
  const [pwForm, setPwForm]         = useState({ new_password: '', confirm: '' });

  const load = useCallback(() => {
    apiFetch('/api/users', me?.id)
      .then(r => { if (!r.ok) throw new Error('Gagal memuat data user'); return r.json(); })
      .then(setUsers)
      .catch(e => toast(e.message, 'error'));
    apiFetch('/api/supervisors', me?.id)
      .then(r => r.json())
      .then(setSupervisors)
      .catch(() => {});
  }, [me?.id]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(initForm); setEditUser(null); setOpen(true); };
  const openEdit = (u: any) => {
    setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role, email: u.email || '', supervisor_id: u.supervisor_id ? String(u.supervisor_id) : '' });
    setEditUser(u);
    setOpen(true);
  };
  const closeModal = () => { setOpen(false); setEditUser(null); setForm(initForm); };
  const closePwModal = () => { setPwModal(null); setPwForm({ new_password: '', confirm: '' }); };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  // Simpan (create / edit)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validasi email untuk Auditor
    if (form.role === 'Auditor' && !editUser && !form.email.trim()) {
      toast('Email wajib diisi untuk akun Auditor', 'error'); return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast('Format email tidak valid', 'error'); return;
    }
    setSaving(true);
    try {
      if (editUser) {
        // Edit — kirim field yang relevan, termasuk email & supervisor_id
        const payload: any = { full_name: form.full_name, role: form.role };
        if (editUser.role === 'Auditor' || form.role === 'Auditor' || form.email.trim()) {
          payload.email = form.email.trim();
        }
        if (form.role === 'Auditor' || editUser.role === 'Auditor') {
          payload.supervisor_id = form.supervisor_id ? Number(form.supervisor_id) : null;
        }
        const r = await apiFetch(`/api/users/${editUser.id}`, me?.id, { method: 'PATCH', body: JSON.stringify(payload) });
        if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal menyimpan'); }
        toast('Data user berhasil diperbarui', 'success');
      } else {
        // Create — sertakan email & supervisor_id jika ada
        const payload: any = { ...form };
        if (!payload.email) delete payload.email;
        if (!payload.supervisor_id) delete payload.supervisor_id;
        else payload.supervisor_id = Number(payload.supervisor_id);
        const r = await apiFetch('/api/users', me?.id, { method: 'POST', body: JSON.stringify(payload) });
        if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal membuat akun'); }
        toast(`Akun "${form.username}" berhasil dibuat`, 'success');
      }
      closeModal(); load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle aktif/nonaktif — normalisasi is_active ke boolean dulu
  const toggleActive = async (u: any) => {
    const currentlyActive = u.is_active === true || u.is_active === 1;
    try {
      const r = await apiFetch(`/api/users/${u.id}`, me?.id, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentlyActive })
      });
      if (!r.ok) throw new Error('Gagal mengubah status');
      toast(`User "${u.full_name}" ${currentlyActive ? 'dinonaktifkan' : 'diaktifkan'}`, 'info');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // Regenerate Kode Unik oleh Admin
  const regenerateKode = async (u: any) => {
    if (!confirm(`Regenerate Kode Unik untuk "${u.full_name}"?\nKode lama tidak bisa digunakan lagi.`)) return;
    try {
      const r = await apiFetch(`/api/users/${u.id}/regenerate-kode`, me?.id, { method: 'PATCH' });
      if (!r.ok) throw new Error('Gagal regenerate kode');
      const data = await r.json();
      toast(`Kode Unik baru: ${data.kode_unik}`, 'success');
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  };

  // Hapus user permanen
  const deleteUser = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const r = await apiFetch(`/api/users/${deleteConfirm.id}`, me?.id, { method: 'DELETE' });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal menghapus user'); }
      toast(`User "${deleteConfirm.full_name}" berhasil dihapus`, 'success');
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Reset password oleh Admin
  const submitResetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast('Konfirmasi password tidak cocok', 'error'); return;
    }
    if (pwForm.new_password.length < 6) {
      toast('Password minimal 6 karakter', 'error'); return;
    }
    setSaving(true);
    try {
      const r = await apiFetch(`/api/users/${pwModal.id}/password`, me?.id, {
        method: 'PATCH', body: JSON.stringify({ new_password: pwForm.new_password })
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal reset password'); }
      toast(`Password "${pwModal.full_name}" berhasil direset`, 'success');
      closePwModal();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Group users by role untuk summary
  const byRole = users.reduce((acc: any, u: any) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  return (
    <div>
      <PageHeader title="User Management" breadcrumb="User Management">
        <BtnPrimary onClick={openAdd}><Plus size={14} /> Tambah User</BtnPrimary>
      </PageHeader>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total User', value: users.length, icon: Users, color: T.blue700, bg: T.blue50 },
          { label: 'Admin', value: byRole['Admin'] || 0, icon: Shield, color: '#5521b5', bg: '#edebfe' },
          { label: 'Supervisor', value: byRole['Supervisor'] || 0, icon: UserCheck, color: T.blue700, bg: T.blue50 },
          { label: 'Manager', value: byRole['Manager'] || 0, icon: UserCheck, color: '#0f766e', bg: '#f0fdfa' },
          { label: 'Auditor', value: byRole['Auditor'] || 0, icon: UserCog, color: T.green, bg: T.greenBg },
          { label: 'Nonaktif', value: users.filter((u: any) => !u.is_active).length, icon: UserX, color: T.gray500, bg: T.gray100 },
        ].map(s => (
          <div key={s.label} style={{ ...card({ padding: '14px 18px' }), display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={17} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: T.gray900, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: T.gray400, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <DataTable title={`Daftar User (${users.length})`} cols={['User', 'Username', 'Email (Auditor Login)', 'Supervisor', 'Role', 'Status', 'Aksi']}>
        {users.length === 0 ? (
          <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, fontSize: 13, color: T.gray400 }}>Belum ada user.</td></tr>
        ) : users.map((u: any) => (
          <tr key={u.id} style={{ transition: 'background 0.12s', opacity: u.is_active ? 1 : 0.55 }}
            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = T.gray50}
            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
            <Td sub={u.is_active ? undefined : '(Nonaktif)'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: u.is_active ? T.blue700 : T.gray300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.white, flexShrink: 0 }}>
                  {u.full_name.charAt(0)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, color: u.is_active ? T.gray900 : T.gray400 }}>{u.full_name}</span>
                    {u.id === me?.id && <span style={{ fontSize: 10, padding: '1px 7px', background: T.blue50, color: T.blue700, border: `1px solid ${T.blue100}`, borderRadius: 20, fontWeight: 600 }}>Anda</span>}
                  </div>
                  {/* Kode Unik — digunakan untuk Login Auditor (tanpa password) */}
                  {u.role === 'Auditor' && u.kode_unik ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span title="Kode Unik untuk Login Auditor" style={{ fontSize: 12, fontFamily: MONO, fontWeight: 700, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 5, padding: '1px 7px', letterSpacing: '0.12em' }}>{u.kode_unik}</span>
                      <button title="Copy Kode Unik" onClick={() => { navigator.clipboard.writeText(u.kode_unik); toast(`Kode ${u.kode_unik} disalin`, 'success'); }}
                        style={{ padding: '2px 5px', border: `1px solid ${T.gray200}`, borderRadius: 4, background: T.white, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                        <Copy size={10} style={{ color: T.gray400 }} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, fontFamily: MONO, color: T.gray400, background: T.gray100, borderRadius: 4, padding: '1px 5px' }}>ID #{u.id}</span>
                  )}
                </div>
              </div>
            </Td>
            <Td mono>{u.username}</Td>
            {/* Email — kritis untuk Login Auditor */}
            <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}` }}>
              {u.email ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Mail size={11} style={{ color: T.green, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.gray700, fontFamily: MONO }}>{u.email}</span>
                </div>
              ) : u.role === 'Auditor' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Email wajib diset agar Auditor bisa Login tanpa password">
                  <AlertTriangle size={11} style={{ color: T.yellow, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: T.yellow, fontWeight: 600 }}>Belum diset</span>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: T.gray300 }}>—</span>
              )}
            </td>
            {/* Supervisor — hanya tampil untuk Auditor */}
            <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}` }}>
              {u.role === 'Auditor' ? (
                u.supervisor_name
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <UserCheck size={11} style={{ color: T.blue700, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: T.blue700, fontWeight: 500 }}>{u.supervisor_name}</span>
                    </div>
                  : <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Auditor belum di-assign ke SPV">
                      <AlertTriangle size={11} style={{ color: T.yellow, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: T.yellow, fontWeight: 600 }}>Belum assign</span>
                    </div>
              ) : (
                <span style={{ fontSize: 11, color: T.gray300 }}>—</span>
              )}
            </td>
            <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}` }}>
              <RoleBadge role={u.role} />
            </td>
            <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}` }}>
              <Badge type={u.is_active ? 'success' : 'default'}>{u.is_active ? '● Aktif' : '○ Nonaktif'}</Badge>
            </td>
            <td style={{ padding: '13px 16px', borderBottom: `1px solid ${T.gray100}` }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {/* Edit */}
                <BtnSecondary sm onClick={() => openEdit(u)}><Edit2 size={12} /> Edit</BtnSecondary>
                {/* Reset Password */}
                <button onClick={() => { setPwModal(u); setPwForm({ new_password: '', confirm: '' }); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: T.yellowBg, border: '1px solid #fcd34d', color: T.yellow, fontWeight: 500, fontSize: 12, cursor: 'pointer', transition: 'background 0.15s' }}
                  title="Reset Password">
                  <KeyRound size={12} /> Reset PW
                </button>
                {/* Regenerate Kode Unik — hanya untuk Auditor */}
                {u.role === 'Auditor' && (
                  <button onClick={() => regenerateKode(u)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', fontWeight: 500, fontSize: 12, cursor: 'pointer', transition: 'background 0.15s' }}
                    title="Generate ulang Kode Unik login auditor">
                    <RefreshCw size={12} /> Kode Baru
                  </button>
                )}
                {/* Toggle aktif — tidak bisa nonaktifkan diri sendiri */}
                {u.id !== me?.id && (
                  <button onClick={() => toggleActive(u)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: u.is_active ? T.redBg : T.greenBg, border: `1px solid ${u.is_active ? '#fca5a5' : '#a7f3d0'}`, color: u.is_active ? T.red : T.green, fontWeight: 500, fontSize: 12, cursor: 'pointer', transition: 'background 0.15s' }}
                    title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                    {u.is_active ? <><UserX size={12} /> Nonaktifkan</> : <><UserCheck size={12} /> Aktifkan</>}
                  </button>
                )}
                {/* Hapus permanen — tidak bisa hapus diri sendiri */}
                {u.id !== me?.id && (
                  <button onClick={() => setDeleteConfirm(u)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontWeight: 500, fontSize: 12, cursor: 'pointer', transition: 'background 0.15s' }}
                    title="Hapus user permanen">
                    <Trash2 size={12} /> Hapus
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      {/* ── Modal Tambah/Edit User ── */}
      <Modal open={open} onClose={closeModal}
        title={editUser ? 'Edit Data User' : 'Tambah User Baru'}
        subtitle={editUser ? `Mengedit akun: ${editUser.username}` : 'Buat akun baru untuk auditor atau supervisor'}>
        <form onSubmit={submit}>
          <Field label="Nama Lengkap">
            <Input required value={form.full_name} onChange={f('full_name')} placeholder="Nama lengkap user" />
          </Field>
          <Field label="Username">
            {editUser
              ? <div style={{ ...inp, background: T.gray50, color: T.gray400, cursor: 'not-allowed' }}>{form.username}</div>
              : <Input required value={form.username} onChange={f('username')} placeholder="username (tanpa spasi)" />
            }
            {editUser && <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>Username tidak dapat diubah setelah akun dibuat.</div>}
          </Field>
          {/* Password: hanya untuk non-Auditor saat buat akun baru */}
          {!editUser && form.role !== 'Auditor' && (
            <Field label="Password Awal">
              <PasswordInput value={form.password} onChange={f('password')} placeholder="Min. 6 karakter" />
              <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>User dapat mengubah password sendiri setelah login.</div>
            </Field>
          )}
          {/* Email — wajib untuk Auditor (digunakan login), opsional untuk role lain */}
          {(form.role === 'Auditor' || (editUser && editUser.role === 'Auditor')) ? (
            <>
              {/* Info khusus Auditor — login pakai Kode Unik + Email */}
              {!editUser && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#f0fdfa', border: '1px solid #99f6e4', marginBottom: 4 }}>
                  <KeyRound size={14} style={{ color: '#0f766e', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: '#0f766e', lineHeight: 1.5 }}>
                    <strong>Tidak perlu password.</strong> Akun Auditor login menggunakan <strong>Kode Unik</strong> + <strong>Email</strong>.<br />
                    Kode Unik akan otomatis di-generate dan ditampilkan di tabel User Management.
                  </div>
                </div>
              )}
              <Field label={<span>Email Login Auditor <span style={{ color: T.red }}>*</span></span> as any}>
                <div style={{ position: 'relative' }}>
                  <Mail size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={f('email')}
                    placeholder="auditor@perusahaan.com"
                    style={{ paddingLeft: 32 }}
                  />
                </div>
                <div style={{ fontSize: 11, color: T.gray500, marginTop: 4 }}>
                  Email ini digunakan Auditor untuk login bersama Kode Unik.
                </div>
              </Field>
            </>
          ) : null}
          <Field label="Role">
            <Select required value={form.role} onChange={f('role')}>
              <option value="Auditor">Auditor</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </Select>
          </Field>
          {/* Supervisor — hanya tampil saat role Auditor */}
          {(form.role === 'Auditor' || (editUser && editUser.role === 'Auditor')) && (
            <Field label="Supervisor (Opsional)">
              <Select value={form.supervisor_id} onChange={f('supervisor_id')}>
                <option value="">— Belum assign —</option>
                {supervisors.map((spv: any) => (
                  <option key={spv.id} value={spv.id}>{spv.full_name}</option>
                ))}
              </Select>
              <div style={{ fontSize: 11, color: T.gray500, marginTop: 4 }}>
                Pilih SPV yang bertanggung jawab atas Auditor ini.
              </div>
            </Field>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
            <BtnSecondary onClick={closeModal}>Batal</BtnSecondary>
            <BtnPrimary type="submit" disabled={saving}>
              <Save size={14} /> {saving ? 'Menyimpan...' : editUser ? 'Simpan Perubahan' : 'Buat Akun'}
            </BtnPrimary>
          </div>
        </form>
      </Modal>

      {/* ── Modal Reset Password ── */}
      <AnimatePresence>
        {pwModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(17,25,40,0.55)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.18 }}
              style={{ background: T.white, borderRadius: 10, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.gray200}`, background: T.yellowBg, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <KeyRound size={18} style={{ color: T.white }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.gray900 }}>Reset Password</div>
                  <div style={{ fontSize: 12, color: T.gray500, marginTop: 2 }}>
                    Akun: <strong>{pwModal.full_name}</strong> <span style={{ fontFamily: MONO, fontSize: 11 }}>({pwModal.username})</span>
                  </div>
                </div>
              </div>
              <form onSubmit={submitResetPw}>
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ padding: '10px 14px', background: T.yellowBg, borderRadius: 6, border: '1px solid #fcd34d', marginBottom: 18 }}>
                    <div style={{ fontSize: 12, color: T.yellow, fontWeight: 500 }}>
                      ⚠ Password lama akan langsung diganti. Pastikan user diberitahu password barunya.
                    </div>
                  </div>
                  <Field label="Password Baru">
                    <PasswordInput value={pwForm.new_password} onChange={(e: any) => setPwForm(p => ({ ...p, new_password: e.target.value }))} placeholder="Min. 6 karakter" />
                  </Field>
                  <Field label="Konfirmasi Password Baru">
                    <PasswordInput value={pwForm.confirm} onChange={(e: any) => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Ulangi password baru" />
                    {pwForm.confirm && pwForm.new_password !== pwForm.confirm && (
                      <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>Password tidak cocok</div>
                    )}
                  </Field>
                </div>
                <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.gray200}`, background: T.gray50, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <BtnSecondary onClick={closePwModal}>Batal</BtnSecondary>
                  <button type="submit" disabled={saving || !pwForm.new_password || pwForm.new_password !== pwForm.confirm}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 6, border: 'none', background: (saving || !pwForm.new_password || pwForm.new_password !== pwForm.confirm) ? T.gray300 : '#d97706', color: T.white, fontFamily: SANS, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                    <KeyRound size={14} /> {saving ? 'Mereset...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Konfirmasi Hapus User ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={() => !deleting && setDeleteConfirm(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: T.white, borderRadius: 14, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
              onClick={e => e.stopPropagation()}>
              {/* Icon peringatan */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={20} style={{ color: '#be123c' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.gray900 }}>Hapus User Permanen?</div>
                  <div style={{ fontSize: 12, color: T.gray500, marginTop: 2 }}>Tindakan ini tidak dapat dibatalkan</div>
                </div>
              </div>

              {/* Info user */}
              <div style={{ background: T.gray50, border: `1px solid ${T.gray200}`, borderRadius: 8, padding: '12px 14px', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#be123c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: T.white, flexShrink: 0 }}>
                    {deleteConfirm.full_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: T.gray900, fontSize: 13 }}>{deleteConfirm.full_name}</div>
                    <div style={{ fontSize: 12, color: T.gray500, fontFamily: MONO }}>@{deleteConfirm.username} · {deleteConfirm.role}</div>
                  </div>
                </div>
              </div>

              {/* Peringatan */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: 20 }}>
                <AlertTriangle size={14} style={{ color: '#c2410c', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#c2410c', lineHeight: 1.5 }}>
                  User dengan <strong>assignments, laporan, atau visit log</strong> tidak dapat dihapus.<br />
                  Gunakan <strong>Nonaktifkan</strong> jika user masih memiliki data terkait.
                </div>
              </div>

              {/* Tombol */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <BtnSecondary onClick={() => setDeleteConfirm(null)} disabled={deleting}>Batal</BtnSecondary>
                <button onClick={deleteUser} disabled={deleting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: deleting ? '#fda4af' : '#be123c', border: 'none', color: T.white, fontWeight: 600, fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                  <Trash2 size={13} /> {deleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── CHANGE OWN PASSWORD (self-service) ──────────────────────────────────────
const ChangePasswordModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { user: me } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const closeAndReset = () => { onClose(); setForm({ old_password: '', new_password: '', confirm: '' }); };
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast('Konfirmasi password tidak cocok', 'error'); return; }
    if (form.new_password.length < 6) { toast('Password baru minimal 6 karakter', 'error'); return; }
    setSaving(true);
    try {
      const r = await apiFetch(`/api/users/${me?.id}/password`, me?.id, {
        method: 'PATCH',
        body: JSON.stringify({ old_password: form.old_password, new_password: form.new_password })
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal mengubah password'); }
      toast('Password berhasil diubah', 'success');
      closeAndReset();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={closeAndReset} title="Ganti Password" subtitle="Ubah password akun Anda sendiri">
      <form onSubmit={submit}>
        <div style={{ padding: '10px 14px', background: T.blue50, borderRadius: 6, border: `1px solid ${T.blue100}`, marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: T.blue700, fontWeight: 500 }}>🔒 Gunakan password yang kuat dan unik. Jangan bagikan ke siapapun.</div>
        </div>
        <Field label="Password Lama">
          <PasswordInput value={form.old_password} onChange={f('old_password')} placeholder="Masukkan password lama" />
        </Field>
        <Field label="Password Baru">
          <PasswordInput value={form.new_password} onChange={f('new_password')} placeholder="Min. 6 karakter" />
        </Field>
        <Field label="Konfirmasi Password Baru">
          <PasswordInput value={form.confirm} onChange={f('confirm')} placeholder="Ulangi password baru" />
          {form.confirm && form.new_password !== form.confirm && (
            <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>Password tidak cocok</div>
          )}
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
          <BtnSecondary onClick={closeAndReset}>Batal</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving || !form.old_password || !form.new_password || form.new_password !== form.confirm}>
            <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Password'}
          </BtnPrimary>
        </div>
      </form>
    </Modal>
  );
};

// ─── ACCOUNT SETTINGS ────────────────────────────────────────────────────────
const AccountSettings = () => {
  const { user: me, login, themeKey, applyTheme } = useAuth();
  const toast = useToast();

  // Active settings section
  const [section, setSection] = useState<'profile' | 'password' | 'notif' | 'appearance' | 'about' | 'smtp'>('profile');

  // SMTP config state (Admin only)
  const [smtpForm, setSmtpForm] = useState({ smtp_host: '', smtp_port: '587', smtp_secure: 'false', smtp_user: '', smtp_pass: '', smtp_from: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const isAdmin = me?.role === 'Admin';

  // Fonnte config state (Admin only)
  const [fonnteToken, setFonnteToken] = useState('');
  const [fonnteSaving, setFonnteSaving] = useState(false);
  const [fonnteTestPhone, setFonnteTestPhone] = useState('');
  const [fonnteTesting, setFonnteTesting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch('/api/config', me?.id).then(r => r.json()).then((d: any) => {
      setSmtpForm(prev => ({ ...prev, ...d, smtp_pass: '' })); // jangan tampilkan pass yang ada
      if (d.fonnte_token && d.fonnte_token !== '••••••••') setFonnteToken(''); // sudah ada, jangan tampilkan
    }).catch(() => {});
  }, [isAdmin, me?.id]);

  const saveFonnte = async (e: React.FormEvent) => {
    e.preventDefault(); setFonnteSaving(true);
    try {
      const r = await apiFetch('/api/config', me?.id, { method: 'PATCH', body: JSON.stringify({ fonnte_token: fonnteToken }) });
      if (!r.ok) throw new Error('Gagal menyimpan');
      toast('Token Fonnte berhasil disimpan', 'success');
      setFonnteToken('');
    } catch { toast('Gagal menyimpan token', 'error'); } finally { setFonnteSaving(false); }
  };

  const testFonnte = async () => {
    if (!fonnteTestPhone) { toast('Masukkan nomor WA tujuan test', 'error'); return; }
    setFonnteTesting(true);
    try {
      const r = await apiFetch('/api/config/test-wa', me?.id, { method: 'POST', body: JSON.stringify({ to: fonnteTestPhone }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal');
      toast('✅ Test WhatsApp berhasil dikirim!', 'success');
    } catch (e: any) { toast(`❌ ${e.message}`, 'error'); } finally { setFonnteTesting(false); }
  };

  const saveSmtp = async (e: React.FormEvent) => {
    e.preventDefault(); setSmtpSaving(true);
    try {
      const payload: any = { ...smtpForm };
      if (!payload.smtp_pass) delete payload.smtp_pass; // jangan overwrite pass jika kosong
      const r = await apiFetch('/api/config', me?.id, { method: 'PATCH', body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Gagal menyimpan');
      toast('Konfigurasi SMTP berhasil disimpan', 'success');
    } catch { toast('Gagal menyimpan konfigurasi', 'error'); } finally { setSmtpSaving(false); }
  };

  const testSmtp = async () => {
    if (!smtpTestEmail) { toast('Masukkan email tujuan test', 'error'); return; }
    setSmtpTesting(true);
    try {
      const r = await apiFetch('/api/config/test-email', me?.id, { method: 'POST', body: JSON.stringify({ to: smtpTestEmail }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal');
      toast('✅ Test email berhasil dikirim!', 'success');
    } catch (e: any) { toast(`❌ ${e.message}`, 'error'); } finally { setSmtpTesting(false); }
  };

  // Profile form
  const [profileForm, setProfileForm] = useState({ full_name: me?.full_name || '', phone: '', location: '', bio: '', email: '', email_reminder: true, wa_reminder: true });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  // Fetch profil dari server saat mount
  useEffect(() => {
    if (!me?.id) return;
    apiFetch(`/api/users/${me.id}/profile`, me.id).then(r => r.json()).then((d: any) => {
      if (d) setProfileForm(prev => ({
        ...prev,
        email:         d.email         || '',
        email_reminder: d.email_reminder !== false && d.email_reminder !== 0,
        phone:         d.phone         || '',
        wa_reminder:   d.wa_reminder   !== false && d.wa_reminder !== 0,
      }));
    }).catch(() => {});
  }, [me?.id]);

  // Password form
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  // Notification prefs (stored in localStorage)
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('monitra_notif_prefs') || '{}'); } catch { return {}; }
  });
  const defaultNotif = { newReport: true, reportUpdated: true, soundEnabled: false };
  const prefs = { ...defaultNotif, ...notifPrefs };

  // Appearance prefs
  const [appPrefs, setAppPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('monitra_app_prefs') || '{}'); } catch { return {}; }
  });
  const defaultApp = { compactMode: false, showWelcome: true };
  const aPrefs = { ...defaultApp, ...appPrefs };

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('File harus berupa gambar (JPG, PNG, dll)', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Ukuran gambar maksimal 5MB', 'error'); return; }
    setPhotoUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // Crop & compress to 200×200 via canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200; canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, 200, 200);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        const updated = { ...me!, photo_url: compressed };
        login(updated);
        setPhotoUploading(false);
        toast('Foto profil berhasil diperbarui', 'success');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removePhoto = () => {
    const updated = { ...me! };
    delete updated.photo_url;
    login(updated);
    toast('Foto profil dihapus', 'info');
  };

  const pf = (k: string) => (e: any) => setProfileForm(p => ({ ...p, [k]: e.target.value }));

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.full_name.trim()) { toast('Nama lengkap tidak boleh kosong', 'error'); return; }
    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      toast('Format email tidak valid', 'error'); return;
    }
    setProfileSaving(true);
    try {
      const r = await apiFetch(`/api/users/${me?.id}/profile`, me?.id, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name:     profileForm.full_name.trim(),
          email:         profileForm.email.trim(),
          email_reminder: profileForm.email_reminder,
          phone:         profileForm.phone.trim(),
          wa_reminder:   profileForm.wa_reminder,
        }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal menyimpan profil'); }
      const updated = { ...me!, full_name: profileForm.full_name.trim(), email: profileForm.email.trim() };
      login(updated);
      localStorage.setItem('audit_user', JSON.stringify(updated));
      toast('Profil berhasil diperbarui', 'success');
      setProfileEditing(false);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) { toast('Konfirmasi password tidak cocok', 'error'); return; }
    if (pwForm.new_password.length < 6) { toast('Password baru minimal 6 karakter', 'error'); return; }
    setPwSaving(true);
    try {
      const r = await apiFetch(`/api/users/${me?.id}/password`, me?.id, {
        method: 'PATCH',
        body: JSON.stringify({ old_password: pwForm.old_password, new_password: pwForm.new_password }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Gagal mengubah password'); }
      toast('Password berhasil diubah', 'success');
      setPwForm({ old_password: '', new_password: '', confirm: '' });
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setPwSaving(false);
    }
  };

  const saveNotif = (key: string, val: boolean) => {
    const updated = { ...prefs, [key]: val };
    setNotifPrefs(updated);
    localStorage.setItem('monitra_notif_prefs', JSON.stringify(updated));
    toast('Preferensi notifikasi disimpan', 'success');
  };

  const saveAppPref = (key: string, val: boolean) => {
    const updated = { ...aPrefs, [key]: val };
    setAppPrefs(updated);
    localStorage.setItem('monitra_app_prefs', JSON.stringify(updated));
    toast('Preferensi tampilan disimpan', 'success');
  };

  // Settings sections menu
  const sections = [
    { id: 'profile',    label: 'Profil Akun',       icon: UserCog,  desc: 'Nama, email, kontak',   adminOnly: false },
    { id: 'password',   label: 'Keamanan',           icon: KeyRound, desc: 'Ganti password',        adminOnly: false },
    { id: 'notif',      label: 'Notifikasi',         icon: Bell,     desc: 'Preferensi notif',      adminOnly: false },
    { id: 'appearance', label: 'Tampilan',           icon: Palette,  desc: 'Mode & tema',           adminOnly: false },
    { id: 'smtp',       label: 'Konfigurasi Email',  icon: Server,   desc: 'SMTP untuk pengingat',  adminOnly: true  },
    { id: 'about',      label: 'Tentang Aplikasi',   icon: Info,     desc: 'Versi & info',          adminOnly: false },
  ].filter(s => !s.adminOnly || isAdmin);

  // Role label
  const roleColors: Record<string, string> = { Admin: '#5521b5', Supervisor: T.blue700, Manager: '#0f766e', Auditor: T.green };
  const roleBg: Record<string, string> = { Admin: '#edebfe', Supervisor: T.blue50, Manager: '#f0fdfa', Auditor: T.greenBg };

  // Initials avatar
  const initials = (me?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div>
      <PageHeader title="Pengaturan Akun" breadcrumb="Pengaturan" />

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18, alignItems: 'start' }}>

        {/* ── Left panel: nav + profile card ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Profile card */}
          <div style={{ ...card({ padding: 20 }), textAlign: 'center' }}>
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            {/* Avatar */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
              {me?.photo_url ? (
                <img src={me.photo_url} alt="Foto Profil"
                  style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', display: 'block', margin: '0 auto' }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 18, background: `linear-gradient(135deg, ${T.blue900}, ${T.blue700})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: T.white, margin: '0 auto', boxShadow: '0 4px 14px rgba(28,100,242,0.3)' }}>
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: '50%', background: photoUploading ? T.gray400 : T.blue700, border: `2px solid ${T.white}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: photoUploading ? 'wait' : 'pointer' }}
                title="Ganti foto profil">
                <Camera size={11} style={{ color: T.white }} />
              </button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.gray900 }}>{me?.full_name}</div>
            <div style={{ fontSize: 11, color: T.gray400, fontFamily: MONO, marginBottom: 8 }}>@{me?.username || '-'}</div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 20, background: roleBg[me?.role || 'Auditor'], color: roleColors[me?.role || 'Auditor'], border: `1px solid ${roleBg[me?.role || 'Auditor']}` }}>
              <Shield size={9} style={{ display: 'inline', marginRight: 4 }} />{me?.role}
            </span>
            {/* Tombol upload / hapus foto */}
            <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: T.blue50, border: `1px solid ${T.blue100}`, color: T.blue700, cursor: 'pointer', fontFamily: SANS, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Camera size={11} /> {me?.photo_url ? 'Ganti Foto' : 'Upload Foto'}
              </button>
              {me?.photo_url && (
                <button onClick={removePhoto}
                  style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: T.redBg, border: '1px solid #fca5a5', color: T.red, cursor: 'pointer', fontFamily: SANS, fontWeight: 500 }}>
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* Nav menu */}
          <div style={card()}>
            {sections.map((s, i) => {
              const isActive = section === s.id;
              return (
                <button key={s.id} onClick={() => setSection(s.id as any)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', background: isActive ? T.blue50 : 'transparent', border: 'none', borderBottom: i < sections.length - 1 ? `1px solid ${T.gray100}` : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s', borderLeft: isActive ? `3px solid ${T.blue700}` : '3px solid transparent' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget).style.background = T.gray50; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget).style.background = 'transparent'; }}>
                  <s.icon size={15} style={{ color: isActive ? T.blue700 : T.gray400, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? T.blue700 : T.gray700 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: T.gray400 }}>{s.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: content ── */}
        <div>
          <AnimatePresence mode="wait">

            {/* ═══ PROFIL ═══ */}
            {section === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                <div style={card()}>
                  <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.gray200}`, background: T.gray50, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>Informasi Profil</div>
                      <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>Kelola data profil dan informasi kontak Anda</div>
                    </div>
                    {!profileEditing && (
                      <BtnSecondary sm onClick={() => setProfileEditing(true)}>
                        <Edit2 size={12} /> Edit Profil
                      </BtnSecondary>
                    )}
                  </div>
                  <div style={{ padding: 22 }}>
                    {/* Read-only info row */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 18, padding: '12px 16px', background: T.blue50, borderRadius: 8, border: `1px solid ${T.blue100}`, alignItems: 'center' }}>
                      <AtSign size={14} style={{ color: T.blue700, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: T.blue700, fontWeight: 600 }}>Username (tidak dapat diubah)</div>
                        <div style={{ fontSize: 13, fontFamily: MONO, color: T.blue700, marginTop: 2 }}>{me?.username}</div>
                      </div>
                    </div>

                    {profileEditing ? (
                      <form onSubmit={saveProfile}>
                        <Field label="Nama Lengkap">
                          <Input required value={profileForm.full_name} onChange={pf('full_name')} placeholder="Nama lengkap Anda" />
                        </Field>
                        <Field label="Email Pengingat">
                          <div style={{ position: 'relative' }}>
                            <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
                            <input type="email" value={profileForm.email} onChange={pf('email')} placeholder="auditor@example.com" style={{ ...inp, paddingLeft: 34 }}
                              onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                          </div>
                          <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>Digunakan untuk mengirim pengingat laporan harian jam 16:00</div>
                        </Field>
                        <Field label="No. WhatsApp">
                          <div style={{ position: 'relative' }}>
                            <Phone size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#25D366', pointerEvents: 'none' }} />
                            <input value={profileForm.phone} onChange={pf('phone')} placeholder="0812-xxxx-xxxx atau 6281xxx" style={{ ...inp, paddingLeft: 34 }}
                              onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                          </div>
                          <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>Digunakan untuk mengirim pengingat laporan harian via WhatsApp jam 16:30</div>
                        </Field>
                        {profileForm.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginTop: -8 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Pengingat via WhatsApp</div>
                              <div style={{ fontSize: 11, color: '#16a34a', marginTop: 1 }}>Kirim pesan WA jam 16:30 jika belum isi laporan</div>
                            </div>
                            <div onClick={() => setProfileForm(p => ({ ...p, wa_reminder: !p.wa_reminder }))}
                              style={{ width: 44, height: 24, borderRadius: 12, background: profileForm.wa_reminder ? '#25D366' : T.gray200, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: 3, left: profileForm.wa_reminder ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                            </div>
                          </div>
                        )}
                        <Field label="Lokasi / Kantor (Opsional)">
                          <div style={{ position: 'relative' }}>
                            <MapPin size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
                            <input value={profileForm.location} onChange={pf('location')} placeholder="Jakarta, Indonesia" style={{ ...inp, paddingLeft: 34 }}
                              onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                          </div>
                        </Field>
                        <Field label="Bio / Catatan (Opsional)">
                          <Textarea value={profileForm.bio} onChange={pf('bio')} rows={3} placeholder="Tambahkan catatan singkat tentang Anda..." />
                        </Field>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
                          <BtnSecondary onClick={() => setProfileEditing(false)}>Batal</BtnSecondary>
                          <BtnPrimary type="submit" disabled={profileSaving}><Save size={13} /> {profileSaving ? 'Menyimpan...' : 'Simpan Profil'}</BtnPrimary>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {[
                          { icon: UserCheck, label: 'Nama Lengkap', value: me?.full_name },
                          { icon: Shield,    label: 'Role / Jabatan', value: me?.role },
                          { icon: Mail,      label: 'Email Pengingat', value: profileForm.email || '—' },
                          { icon: Phone,     label: 'No. WhatsApp', value: profileForm.phone || '—' },
                          { icon: MapPin,    label: 'Lokasi / Kantor', value: profileForm.location || '—' },
                        ].map((row, i) => (
                          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: i < 4 ? `1px solid ${T.gray100}` : 'none' }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <row.icon size={14} style={{ color: T.gray500 }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: T.gray400, marginBottom: 2 }}>{row.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: T.gray800 }}>{row.value}</div>
                            </div>
                          </div>
                        ))}
                        {profileForm.bio && (
                          <div style={{ marginTop: 14, padding: '12px 14px', background: T.gray50, borderRadius: 8, border: `1px solid ${T.gray200}` }}>
                            <div style={{ fontSize: 11, color: T.gray400, marginBottom: 4 }}>Bio</div>
                            <div style={{ fontSize: 13, color: T.gray700, lineHeight: 1.6 }}>{profileForm.bio}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ KEAMANAN / PASSWORD ═══ */}
            {section === 'password' && (
              <motion.div key="password" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                <div style={card()}>
                  <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.gray200}`, background: T.gray50 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>Keamanan Akun</div>
                    <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>Ganti password untuk menjaga keamanan akun Anda</div>
                  </div>
                  <div style={{ padding: 22 }}>
                    {/* Security tips */}
                    <div style={{ padding: '12px 16px', background: T.blue50, borderRadius: 8, border: `1px solid ${T.blue100}`, marginBottom: 22, display: 'flex', gap: 10 }}>
                      <Shield size={15} style={{ color: T.blue700, flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.blue700, marginBottom: 5 }}>Tips Keamanan Password</div>
                        <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: T.blue700, lineHeight: 1.8 }}>
                          <li>Gunakan minimal 8 karakter</li>
                          <li>Kombinasikan huruf besar, kecil, angka, dan simbol</li>
                          <li>Jangan gunakan password yang sama di platform lain</li>
                          <li>Ganti password secara berkala (setiap 3 bulan)</li>
                        </ul>
                      </div>
                    </div>

                    <form onSubmit={savePassword} style={{ maxWidth: 420 }}>
                      <Field label="Password Saat Ini">
                        <PasswordInput value={pwForm.old_password} onChange={(e: any) => setPwForm(p => ({ ...p, old_password: e.target.value }))} placeholder="Masukkan password lama" />
                      </Field>
                      <Field label="Password Baru">
                        <PasswordInput value={pwForm.new_password} onChange={(e: any) => setPwForm(p => ({ ...p, new_password: e.target.value }))} placeholder="Min. 6 karakter" />
                        {/* Password strength indicator */}
                        {pwForm.new_password.length > 0 && (() => {
                          const len = pwForm.new_password.length;
                          const hasUpper = /[A-Z]/.test(pwForm.new_password);
                          const hasNum = /[0-9]/.test(pwForm.new_password);
                          const hasSpecial = /[^a-zA-Z0-9]/.test(pwForm.new_password);
                          const score = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpecial ? 1 : 0);
                          const labels = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'];
                          const colors = ['', T.red, '#d97706', T.blue700, T.green];
                          return (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                                {[1,2,3,4].map(i => (
                                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= score ? colors[score] : T.gray200, transition: 'background 0.2s' }} />
                                ))}
                              </div>
                              <div style={{ fontSize: 11, color: colors[score], fontWeight: 500 }}>Kekuatan: {labels[score]}</div>
                            </div>
                          );
                        })()}
                      </Field>
                      <Field label="Konfirmasi Password Baru">
                        <PasswordInput value={pwForm.confirm} onChange={(e: any) => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Ulangi password baru" />
                        {pwForm.confirm && pwForm.new_password !== pwForm.confirm && (
                          <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>Password tidak cocok</div>
                        )}
                        {pwForm.confirm && pwForm.new_password === pwForm.confirm && pwForm.confirm.length > 0 && (
                          <div style={{ fontSize: 11, color: T.green, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Password cocok</div>
                        )}
                      </Field>
                      <div style={{ paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
                        <BtnPrimary type="submit"
                          disabled={pwSaving || !pwForm.old_password || !pwForm.new_password || pwForm.new_password !== pwForm.confirm || pwForm.new_password.length < 6}>
                          <KeyRound size={13} /> {pwSaving ? 'Menyimpan...' : 'Perbarui Password'}
                        </BtnPrimary>
                      </div>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ NOTIFIKASI ═══ */}
            {section === 'notif' && (
              <motion.div key="notif" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                <div style={card()}>
                  <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.gray200}`, background: T.gray50 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>Preferensi Notifikasi</div>
                    <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>Atur notifikasi realtime yang Anda terima</div>
                  </div>
                  <div style={{ padding: 22 }}>
                    {[
                      { key: 'newReport',     label: 'Laporan Baru Masuk',       desc: 'Notifikasi ketika auditor mengirim laporan baru', icon: FileText },
                      { key: 'reportUpdated', label: 'Update Status Laporan',    desc: 'Notifikasi ketika status laporan berubah (approve/reject)', icon: CheckCircle2 },
                      { key: 'soundEnabled',  label: 'Suara Notifikasi',         desc: 'Aktifkan bunyi saat notifikasi masuk', icon: Bell },
                    ].map((item, i, arr) => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: i < arr.length - 1 ? `1px solid ${T.gray100}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: T.blue50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <item.icon size={15} style={{ color: T.blue700 }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.gray800 }}>{item.label}</div>
                            <div style={{ fontSize: 11, color: T.gray400, marginTop: 2 }}>{item.desc}</div>
                          </div>
                        </div>
                        {/* Toggle switch */}
                        <div onClick={() => saveNotif(item.key, !prefs[item.key as keyof typeof prefs])}
                          style={{ width: 44, height: 24, borderRadius: 12, background: prefs[item.key as keyof typeof prefs] ? T.blue700 : T.gray200, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 3, left: prefs[item.key as keyof typeof prefs] ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>
                    ))}

                    {/* ── Email Reminder toggle (server-side) ── */}
                    <div style={{ borderTop: `1px solid ${T.gray100}`, paddingTop: 16, marginTop: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Pengingat Email</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BellRing size={15} style={{ color: '#d97706' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.gray800 }}>Pengingat Email Harian</div>
                            <div style={{ fontSize: 11, color: T.gray400, marginTop: 2 }}>
                              Terima email pengingat jam <strong>16:00</strong> jika belum isi laporan hari ini
                              {!profileForm.email && <span style={{ color: '#d97706', marginLeft: 4 }}>— isi email di Profil Akun</span>}
                            </div>
                          </div>
                        </div>
                        <div onClick={async () => {
                          const newVal = !profileForm.email_reminder;
                          setProfileForm(p => ({ ...p, email_reminder: newVal }));
                          await apiFetch(`/api/users/${me?.id}/profile`, me?.id, { method: 'PATCH', body: JSON.stringify({ email_reminder: newVal }) });
                          toast(newVal ? '🔔 Pengingat email diaktifkan' : '🔕 Pengingat email dimatikan', 'info');
                        }}
                          style={{ width: 44, height: 24, borderRadius: 12, background: profileForm.email_reminder ? '#d97706' : T.gray200, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 3, left: profileForm.email_reminder ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>

                      {/* WA reminder toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderTop: `1px solid ${T.gray100}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #bbf7d0' }}>
                            <Phone size={15} style={{ color: '#25D366' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.gray800 }}>Pengingat WhatsApp Harian</div>
                            <div style={{ fontSize: 11, color: T.gray400, marginTop: 2 }}>
                              Terima pesan WA jam <strong>16:30</strong> jika belum isi laporan hari ini
                              {!profileForm.phone && <span style={{ color: '#d97706', marginLeft: 4 }}>— isi No. WA di Profil Akun</span>}
                            </div>
                          </div>
                        </div>
                        <div onClick={async () => {
                          if (!profileForm.phone) { toast('Isi No. WhatsApp di Profil Akun terlebih dahulu', 'error'); return; }
                          const newVal = !profileForm.wa_reminder;
                          setProfileForm(p => ({ ...p, wa_reminder: newVal }));
                          await apiFetch(`/api/users/${me?.id}/profile`, me?.id, { method: 'PATCH', body: JSON.stringify({ wa_reminder: newVal }) });
                          toast(newVal ? '📱 Pengingat WhatsApp diaktifkan' : '🔕 Pengingat WhatsApp dimatikan', 'info');
                        }}
                          style={{ width: 44, height: 24, borderRadius: 12, background: profileForm.wa_reminder && profileForm.phone ? '#25D366' : T.gray200, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 3, left: profileForm.wa_reminder && profileForm.phone ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TAMPILAN ═══ */}
            {section === 'appearance' && (
              <motion.div key="appearance" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                <div style={card()}>
                  <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.gray200}`, background: T.gray50 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>Preferensi Tampilan</div>
                    <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>Sesuaikan tampilan aplikasi sesuai kebutuhan Anda</div>
                  </div>
                  <div style={{ padding: 22 }}>
                    {[
                      { key: 'compactMode',  label: 'Mode Compact',        desc: 'Tampilkan lebih banyak data dengan jarak yang lebih rapat', icon: Activity },
                      { key: 'showWelcome',  label: 'Tampilkan Salam',     desc: 'Tampilkan pesan selamat datang di dashboard', icon: UserCheck },
                    ].map((item, i, arr) => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: i < arr.length - 1 ? `1px solid ${T.gray100}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <item.icon size={15} style={{ color: T.gray500 }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.gray800 }}>{item.label}</div>
                            <div style={{ fontSize: 11, color: T.gray400, marginTop: 2 }}>{item.desc}</div>
                          </div>
                        </div>
                        <div onClick={() => saveAppPref(item.key, !aPrefs[item.key as keyof typeof aPrefs])}
                          style={{ width: 44, height: 24, borderRadius: 12, background: aPrefs[item.key as keyof typeof aPrefs] ? T.blue700 : T.gray200, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <div style={{ position: 'absolute', top: 3, left: aPrefs[item.key as keyof typeof aPrefs] ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: T.white, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>
                    ))}

                    {/* Theme switcher — fully interactive */}
                    <div style={{ marginTop: 20, padding: '16px', background: T.gray50, borderRadius: 8, border: `1px solid ${T.gray200}` }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.gray600, marginBottom: 12 }}>Tema Warna Antarmuka</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {([
                          { key: 'blue' as ThemeKey,   label: 'Biru Profesional', sidebar: '#1e3a5f', accent: '#1a56db', dot: '#1c64f2' },
                          { key: 'green' as ThemeKey,  label: 'Hijau Alami',      sidebar: '#064e3b', accent: '#059669', dot: '#10b981' },
                          { key: 'purple' as ThemeKey, label: 'Ungu Elegan',      sidebar: '#2d1b69', accent: '#5521b5', dot: '#7c3aed' },
                        ]).map(t => {
                          const isActive = themeKey === t.key;
                          return (
                            <div key={t.key} onClick={() => { applyTheme(t.key); toast(`Tema "${t.label}" diterapkan`, 'success'); }}
                              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px', borderRadius: 8, border: `2px solid ${isActive ? t.accent : T.gray200}`, background: isActive ? T.white : T.white, cursor: 'pointer', transition: 'all 0.15s', flex: '1 1 100px', boxShadow: isActive ? `0 0 0 3px ${t.dot}22` : 'none' }}>
                              {/* Mini sidebar preview */}
                              <div style={{ display: 'flex', gap: 5, height: 44, borderRadius: 5, overflow: 'hidden', border: `1px solid ${T.gray200}` }}>
                                <div style={{ width: 14, background: t.sidebar, borderRadius: '4px 0 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 5, gap: 3 }}>
                                  {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 3, borderRadius: 2, background: i === 0 ? t.dot : 'rgba(255,255,255,0.25)' }} />)}
                                </div>
                                <div style={{ flex: 1, background: '#f8fafc', padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <div style={{ height: 6, borderRadius: 3, background: t.accent, width: '70%' }} />
                                  <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', width: '50%' }} />
                                  <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', width: '60%' }} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: T.gray800 }}>{t.label}</div>
                                  {isActive && <div style={{ fontSize: 10, color: t.accent, fontWeight: 600, marginTop: 1 }}>● Aktif</div>}
                                </div>
                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isActive ? t.accent : T.gray300}`, background: isActive ? t.accent : T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {isActive && <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.white }} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: T.gray400, marginTop: 10 }}>
                        Tema diterapkan langsung dan disimpan otomatis.
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ KONFIGURASI EMAIL / SMTP (Admin only) ═══ */}
            {section === 'smtp' && (
              <motion.div key="smtp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                <div style={card()}>
                  <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.gray200}`, background: T.gray50 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>Konfigurasi Server Email (SMTP)</div>
                    <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>Atur SMTP untuk mengirim pengingat laporan harian ke auditor</div>
                  </div>
                  <div style={{ padding: 22 }}>
                    {/* Info banner */}
                    <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: T.blue50, borderRadius: 8, border: `1px solid ${T.blue100}`, marginBottom: 22 }}>
                      <BellRing size={15} style={{ color: T.blue700, flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 12, color: T.blue700, lineHeight: 1.7 }}>
                        <strong>Cara kerja pengingat:</strong> Setiap hari Senin–Jumat jam <strong>16:00 WIB</strong>, sistem otomatis mengecek auditor yang belum isi laporan harian dan mengirim notifikasi in-app + email pengingat.
                        <br />Auditor perlu mengisi email di halaman <strong>Pengaturan → Profil Akun</strong>.
                      </div>
                    </div>

                    <form onSubmit={saveSmtp} style={{ maxWidth: 480 }}>
                      <Field label="SMTP Host">
                        <div style={{ position: 'relative' }}>
                          <Server size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
                          <input value={smtpForm.smtp_host} onChange={e => setSmtpForm(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" style={{ ...inp, paddingLeft: 32 }}
                            onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                        </div>
                      </Field>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Field label="Port">
                          <input value={smtpForm.smtp_port} onChange={e => setSmtpForm(p => ({ ...p, smtp_port: e.target.value }))} placeholder="587" style={inp}
                            onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                        </Field>
                        <Field label="Enkripsi">
                          <select value={smtpForm.smtp_secure} onChange={e => setSmtpForm(p => ({ ...p, smtp_secure: e.target.value }))} style={{ ...inp }}>
                            <option value="false">STARTTLS (port 587)</option>
                            <option value="true">SSL/TLS (port 465)</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="Email / Username SMTP">
                        <div style={{ position: 'relative' }}>
                          <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
                          <input type="email" value={smtpForm.smtp_user} onChange={e => setSmtpForm(p => ({ ...p, smtp_user: e.target.value }))} placeholder="monitra@gmail.com" style={{ ...inp, paddingLeft: 32 }}
                            onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                        </div>
                      </Field>
                      <Field label="Password / App Password">
                        <PasswordInput value={smtpForm.smtp_pass} onChange={(e: any) => setSmtpForm(p => ({ ...p, smtp_pass: e.target.value }))} placeholder="Kosongkan jika tidak ingin mengubah" />
                        <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>
                          Untuk Gmail: gunakan <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" style={{ color: T.blue700 }}>App Password</a> (aktifkan 2FA dulu)
                        </div>
                      </Field>
                      <Field label="From (Nama Pengirim)">
                        <input value={smtpForm.smtp_from} onChange={e => setSmtpForm(p => ({ ...p, smtp_from: e.target.value }))} placeholder="MONITRA <monitra@gmail.com>" style={inp}
                          onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                      </Field>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${T.gray100}` }}>
                        <BtnPrimary type="submit" disabled={smtpSaving}><Save size={13} />{smtpSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</BtnPrimary>
                      </div>
                    </form>

                    {/* Test email */}
                    <div style={{ marginTop: 24, padding: 18, background: T.gray50, borderRadius: 10, border: `1px solid ${T.gray200}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.gray800, marginBottom: 12 }}><TestTube2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Kirim Email Test</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.gray400, pointerEvents: 'none' }} />
                          <input type="email" value={smtpTestEmail} onChange={e => setSmtpTestEmail(e.target.value)} placeholder="test@example.com" style={{ ...inp, paddingLeft: 32, marginBottom: 0 }}
                            onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                        </div>
                        <BtnPrimary onClick={testSmtp} disabled={smtpTesting} type="button">
                          <SendHorizontal size={13} />{smtpTesting ? 'Mengirim...' : 'Kirim Test'}
                        </BtnPrimary>
                      </div>
                      <div style={{ fontSize: 11, color: T.gray400, marginTop: 6 }}>Simpan konfigurasi terlebih dahulu sebelum mengirim test email</div>
                    </div>

                    {/* ── Fonnte (WhatsApp) Config ── */}
                    <div style={{ marginTop: 28, paddingTop: 24, borderTop: `2px solid ${T.gray100}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bbf7d0' }}>
                          <Phone size={16} style={{ color: '#25D366' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>Konfigurasi WhatsApp (Fonnte)</div>
                          <div style={{ fontSize: 12, color: T.gray400, marginTop: 1 }}>Token device Fonnte untuk kirim pengingat WA jam 16:30</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 18 }}>
                        <Phone size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 12, color: '#15803d', lineHeight: 1.7 }}>
                          <strong>Cara pakai Fonnte:</strong> Login ke <a href="https://app.fonnte.com" target="_blank" rel="noopener" style={{ color: '#15803d', fontWeight: 700 }}>app.fonnte.com</a>, buka Device → klik <strong>Token</strong> → salin token-nya ke sini.
                          <br />Auditor perlu isi No. WhatsApp di <strong>Pengaturan → Profil Akun</strong>.
                        </div>
                      </div>

                      <form onSubmit={saveFonnte} style={{ maxWidth: 480 }}>
                        <Field label="Token Device Fonnte">
                          <PasswordInput value={fonnteToken} onChange={(e: any) => setFonnteToken(e.target.value)} placeholder="Masukkan token (kosongkan jika tidak ingin mengubah)" />
                          <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>Token ditemukan di Fonnte → Device → Token</div>
                        </Field>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12 }}>
                          <BtnPrimary type="submit" disabled={fonnteSaving || !fonnteToken}>
                            <Save size={13} />{fonnteSaving ? 'Menyimpan...' : 'Simpan Token Fonnte'}
                          </BtnPrimary>
                        </div>
                      </form>

                      {/* Test WA */}
                      <div style={{ marginTop: 20, padding: 18, background: T.gray50, borderRadius: 10, border: `1px solid ${T.gray200}` }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.gray800, marginBottom: 12 }}>
                          <Phone size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: '#25D366' }} />Kirim WA Test
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#25D366', pointerEvents: 'none' }} />
                            <input value={fonnteTestPhone} onChange={e => setFonnteTestPhone(e.target.value)} placeholder="0812-xxxx-xxxx" style={{ ...inp, paddingLeft: 32, marginBottom: 0 }}
                              onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                          </div>
                          <BtnPrimary onClick={testFonnte} disabled={fonnteTesting} type="button">
                            <SendHorizontal size={13} />{fonnteTesting ? 'Mengirim...' : 'Kirim Test WA'}
                          </BtnPrimary>
                        </div>
                        <div style={{ fontSize: 11, color: T.gray400, marginTop: 6 }}>Simpan token Fonnte terlebih dahulu sebelum mengirim test WA</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ TENTANG ═══ */}
            {section === 'about' && (
              <motion.div key="about" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                <div style={card()}>
                  <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.gray200}`, background: T.gray50 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.gray900 }}>Tentang MONITRA</div>
                    <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>Informasi versi dan lisensi aplikasi</div>
                  </div>
                  <div style={{ padding: 22 }}>
                    {/* App info */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 24, padding: '16px 20px', background: `linear-gradient(135deg, ${T.blue50}, ${T.white})`, borderRadius: 10, border: `1px solid ${T.blue100}` }}>
                      <img src={logoMonitra} alt="MONITRA" style={{ width: 52, height: 52, objectFit: 'contain', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: T.gray900, letterSpacing: '0.04em' }}>MONITRA</div>
                        <div style={{ fontSize: 11, color: T.gray500, marginTop: 2 }}>Monitoring &amp; Tracking for Audit</div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                          <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: T.greenBg, color: T.green, border: '1px solid #a7f3d0', fontWeight: 600 }}>v1.0.0 Stable</span>
                          <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: T.gray100, color: T.gray500, border: `1px solid ${T.gray200}` }}>Build 2026.02</span>
                        </div>
                      </div>
                    </div>

                    {/* Info grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 20 }}>
                      {[
                        { label: 'Versi Aplikasi', value: '1.0.0' },
                        { label: 'Stack Backend', value: 'Express.js + SQLite' },
                        { label: 'Stack Frontend', value: 'React 19 + TypeScript + Vite' },
                        { label: 'Realtime', value: 'WebSocket (ws)' },
                        { label: 'Rilis', value: 'Februari 2026' },
                      ].map((row, i, arr) => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: i % 2 === 0 ? T.gray50 : T.white, borderRadius: i === 0 ? '6px 6px 0 0' : i === arr.length - 1 ? '0 0 6px 6px' : 0, border: `1px solid ${T.gray200}`, borderTop: i === 0 ? `1px solid ${T.gray200}` : 'none' }}>
                          <span style={{ fontSize: 12, color: T.gray500 }}>{row.label}</span>
                          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: T.gray800 }}>{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Logged in as */}
                    <div style={{ padding: '12px 16px', background: T.blue50, borderRadius: 8, border: `1px solid ${T.blue100}` }}>
                      <div style={{ fontSize: 11, color: T.blue700, fontWeight: 600, marginBottom: 4 }}>Sesi Aktif</div>
                      <div style={{ fontSize: 12, color: T.blue700 }}>
                        Login sebagai <strong>{me?.full_name}</strong> ({me?.role}) — ID #{me?.id}
                      </div>
                    </div>

                    <div style={{ marginTop: 16, fontSize: 11, color: T.gray300, textAlign: 'center' }}>
                      © 2026 MONITRA. Dibuat dengan ❤️ untuk efisiensi audit.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab,  setActiveTab]  = useState('dashboard');
  const [collapsed,  setCollapsed]  = useState(false);
  // Login mode: standard (username+password) atau auditor (ID+Email)
  const [loginMode, setLoginMode]   = useState<'standard' | 'auditor'>('standard');

  // ── Mobile detection ──────────────────────────────────────────────────────
  const [isMobile,   setIsMobile]   = useState(() => window.innerWidth < 768);
  const [drawerOpen, setDrawerOpen] = useState(false);   // "More" drawer on mobile

  // ── Notifications ──────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen]         = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Relative timestamp untuk notifikasi
  const relativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)     return 'Baru saja';
    if (diff < 3600)   return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 172800) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const r = await apiFetch('/api/notifications', user.id);
      if (r.ok) setNotifications(await r.json());
    } catch { /* abaikan */ }
  }, [user?.id]);

  useEffect(() => { if (user) fetchNotifs(); }, [user?.id]);

  // Tutup dropdown notif kalau klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    if (!user) return;
    await apiFetch('/api/notifications/read-all', user.id, { method: 'PATCH' });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const markOneRead = async (id: number) => {
    if (!user) return;
    await apiFetch(`/api/notifications/${id}/read`, user.id, { method: 'PATCH' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h, { passive: true });
    return () => window.removeEventListener('resize', h);
  }, []);

  // Close "More" drawer when switching tab
  useEffect(() => { setDrawerOpen(false); }, [activeTab]);
  const [themeKey, setThemeKey] = useState<ThemeKey>(_savedThemeKey);

  // Ref untuk menghindari stale closure di applyTheme
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // Mutate T + trigger re-render so entire UI picks up new colors immediately
  // Simpan tema per-user (monitra_theme_<userId>) bukan global
  const applyTheme = useCallback((key: ThemeKey) => {
    Object.assign(T, THEMES[key]);
    const uid = userRef.current?.id;
    if (uid) localStorage.setItem(`monitra_theme_${uid}`, key);
    setThemeKey(key);
  }, []);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);
  const addToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++toastCounter.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const removeToast = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);

  // Audit notification state (floating rich card for approval events)
  const [auditNotifs, setAuditNotifs] = useState<AuditNotif[]>([]);
  const auditNotifCounter = useRef(0);
  const addAuditNotif = useCallback((data: Omit<AuditNotif, 'id'>) => {
    const id = ++auditNotifCounter.current;
    setAuditNotifs(p => [...p, { id, ...data }]);
    setTimeout(() => setAuditNotifs(p => p.filter(n => n.id !== id)), 8000);
  }, []);
  const removeAuditNotif = useCallback((id: number) => setAuditNotifs(p => p.filter(n => n.id !== id)), []);

  // FIX #7 — WebSocket connection
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const wsRetryRef = useRef(0);
  const connectWS = useCallback((userId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    // Use same host as current page (no hardcoded :3000) — works on localhost AND Hostinger
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsConnected(true);
      wsRetryRef.current = 0;
      // Daftarkan userId ke server supaya notifikasi bisa dikirim secara targeted
      ws.send(JSON.stringify({ type: 'AUTH', userId }));
    };
    ws.onclose = () => {
      setWsConnected(false);
      // Max 5 retries — stops if host doesn't support WebSocket
      if (wsRetryRef.current < 5) {
        wsRetryRef.current++;
        setTimeout(() => connectWS(userId), Math.min(3000 * wsRetryRef.current, 15000));
      }
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        // Toast untuk Supervisor/Admin: ada laporan baru masuk
        if (msg.type === 'NEW_REPORT') addToast('📋 Laporan baru masuk!', 'info');
        // REPORT_UPDATED hanya sebagai sinyal refresh data (tidak perlu toast — auditor
        // sudah dapat card kaya dari REPORT_STATUS_CHANGED, supervisor tahu sendiri)
        // Notifikasi kaya khusus untuk auditor saat laporan di-approve/reject/dikomentari
        if (msg.type === 'REPORT_STATUS_CHANGED') {
          addAuditNotif({
            status:          msg.data.status,
            ptName:          msg.data.ptName,
            supervisorNotes: msg.data.supervisorNotes || '',
            supervisorName:  msg.data.supervisorName,
          });
        }
        // Notifikasi: PT otomatis diarsipkan setelah semua laporan 100% Approved
        if (msg.type === 'PT_AUTO_ARCHIVED' || msg.type === 'PT_ARCHIVED') {
          addToast(`📦 PT "${msg.data.ptName}" otomatis masuk Arsip — audit selesai 100%`, 'success');
        }
        // Toast untuk SPV/Admin: auditor baru check-in / check-out
        if (msg.type === 'VISIT_CHECKIN') {
          const emoji = msg.data.visitType === 'check_in' ? '📍' : '🏁';
          const label = msg.data.visitType === 'check_in' ? 'Check In' : 'Check Out';
          addToast(`${emoji} ${msg.data.auditorName} ${label} di ${msg.data.ptName}`, 'info');
        }
        // Toast untuk auditor: kunjungannya di-review SPV
        if (msg.type === 'VISIT_STATUS_CHANGED') {
          const ok = msg.data.status === 'Approved';
          addToast(`${ok ? '✅' : '❌'} Kunjungan ${ok ? 'disetujui' : 'ditolak'} oleh ${msg.data.supervisorName}`, ok ? 'success' : 'error');
        }
        // Notifikasi in-app baru (pengingat laporan dll)
        if (msg.type === 'NEW_NOTIFICATION') {
          setNotifications(prev => [msg.data, ...prev]);
          addToast(msg.data.title, 'info');
        }
      } catch {}
    };
  }, [addToast, addAuditNotif]);

  useEffect(() => {
    const saved = localStorage.getItem('audit_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        // Pastikan id selalu integer (antisipasi data lama / corrupt)
        u.id = parseInt(String(u.id), 10);
        if (!isNaN(u.id)) { setUser(u); connectWS(u.id); }
        else { localStorage.removeItem('audit_user'); } // data corrupt, hapus
      } catch { localStorage.removeItem('audit_user'); }
    }
  }, []);

  const login = (u: User) => {
    // Normalisasi id ke integer sebelum disimpan
    const clean = { ...u, id: parseInt(String(u.id), 10) };
    setUser(clean);
    localStorage.setItem('audit_user', JSON.stringify(clean));
    connectWS(clean.id);
    // Terapkan tema milik user ini (kalau belum punya, default 'blue')
    const savedKey = (localStorage.getItem(`monitra_theme_${clean.id}`) || 'blue') as ThemeKey;
    const themeToApply = THEMES[savedKey] ? savedKey : 'blue';
    Object.assign(T, THEMES[themeToApply]);
    setThemeKey(themeToApply);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('audit_user');
    wsRef.current?.close();
    wsRef.current = null;
    setWsConnected(false);
    // Reset tema ke default biru saat logout — user berikutnya mulai bersih
    Object.assign(T, THEMES['blue']);
    setThemeKey('blue');
  };

  // ── LOGIN PAGE ──
  if (!user) return (
    <ToastContext.Provider value={addToast}>
      <ToastContainer toasts={toasts} remove={removeToast} />
      <AuditNotifContainer notifs={auditNotifs} remove={removeAuditNotif} />
      <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${T.blue900} 0%, ${T.blue800} 50%, #1e3a8a 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <img src={logoMonitra} alt="MONITRA" style={{ height: 72, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }} />
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Monitoring &amp; Tracking for Audit</div>
          </div>
          <div style={{ background: T.white, borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>

            {/* ── TAB SWITCHER ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${T.gray100}` }}>
              {([
                { key: 'standard', label: 'Login Umum',   sub: 'Admin / SPV / Manager' },
                { key: 'auditor',  label: 'Login Auditor', sub: 'ID + Email' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setLoginMode(tab.key)}
                  style={{
                    padding: '14px 10px', border: 'none', cursor: 'pointer', fontFamily: SANS,
                    background: loginMode === tab.key ? T.white : T.gray50,
                    borderBottom: loginMode === tab.key ? `2px solid ${T.blue700}` : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: loginMode === tab.key ? T.blue700 : T.gray500 }}>{tab.label}</div>
                  <div style={{ fontSize: 10, color: loginMode === tab.key ? T.blue700 : T.gray400, marginTop: 2, opacity: 0.8 }}>{tab.sub}</div>
                </button>
              ))}
            </div>

            <div style={{ padding: 28 }}>
              {/* ── MODE 1: Standard login (Username + Password) ── */}
              {loginMode === 'standard' && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.gray700, marginBottom: 18 }}>Masuk dengan akun Anda</div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    try {
                      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
                      if (res.ok) { login(await res.json()); }
                      else { const err = await res.json(); addToast(err.error || 'Login gagal', 'error'); }
                    } catch { addToast('Tidak dapat terhubung ke server', 'error'); }
                  }}>
                    <Field label="Username">
                      <input name="username" type="text" required placeholder="Masukkan username" style={inp}
                        onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                    </Field>
                    <Field label="Password">
                      <input name="password" type="password" required placeholder="••••••••" style={inp}
                        onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                    </Field>
                    <BtnPrimary type="submit" fullWidth>Masuk</BtnPrimary>
                  </form>
                </>
              )}

              {/* ── MODE 2: Auditor login (User ID + Email) ── */}
              {loginMode === 'auditor' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: T.blue50, border: `1px solid ${T.blue100}`, marginBottom: 18 }}>
                    <Mail size={15} style={{ color: T.blue700, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: T.blue700, lineHeight: 1.4 }}>
                      Gunakan <strong>Kode Unik</strong> (6 huruf/angka) dan <strong>Email</strong> yang diberikan Admin. Tidak perlu password.
                    </div>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const payload = { kode_unik: String(fd.get('kode_unik') || '').toUpperCase().trim(), email: fd.get('email') };
                    try {
                      const res = await fetch('/api/login/auditor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                      if (res.ok) { login(await res.json()); }
                      else { const err = await res.json(); addToast(err.error || 'Login gagal', 'error'); }
                    } catch { addToast('Tidak dapat terhubung ke server', 'error'); }
                  }}>
                    <Field label="Kode Unik">
                      <input name="kode_unik" type="text" required placeholder="Contoh: K7X2P9" maxLength={6}
                        style={{ ...inp, fontFamily: MONO, letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 16, fontWeight: 700 }}
                        onInput={e => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.toUpperCase(); }}
                        onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                    </Field>
                    <Field label="Email Terdaftar">
                      <input name="email" type="email" required placeholder="nama@email.com" style={inp}
                        onFocus={e => Object.assign(e.target.style, focus)} onBlur={e => Object.assign(e.target.style, blur)} />
                    </Field>
                    <BtnPrimary type="submit" fullWidth>Masuk sebagai Auditor</BtnPrimary>
                  </form>
                  <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: T.gray50, border: `1px solid ${T.gray200}` }}>
                    <div style={{ fontSize: 11, color: T.gray500, lineHeight: 1.6 }}>
                      <strong style={{ color: T.gray700 }}>Belum punya Kode Unik / Email?</strong><br />
                      Hubungi Admin atau Supervisor untuk mendapatkan Kode Unik akun Anda.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </ToastContext.Provider>
  );

  const navItems = [
    { id: 'dashboard',   label: 'Dashboard',       icon: LayoutDashboard, roles: ['Admin', 'Auditor', 'Supervisor', 'Manager'] },
    { id: 'pts',         label: 'PT Management',   icon: Building2,       roles: ['Admin', 'Supervisor', 'Manager'] },
    { id: 'assignments', label: 'Assignments',     icon: Users,           roles: ['Admin', 'Supervisor', 'Manager'] },
    { id: 'reports',     label: 'Laporan Harian',  icon: FileText,        roles: ['Admin', 'Auditor', 'Supervisor', 'Manager'] },
    { id: 'daily_log',   label: 'Catatan Harian',  icon: BookOpen,        roles: ['Supervisor', 'Manager'] },
    { id: 'visits',      label: 'Kunjungan',        icon: MapPin,          roles: ['Admin', 'Auditor', 'Supervisor', 'Manager'] },
    { id: 'archive',     label: 'Arsip PT',         icon: Archive,         roles: ['Admin', 'Supervisor', 'Manager', 'Auditor'] },
    { id: 'progress',    label: 'Progress Audit',  icon: BarChart2,       roles: ['Admin', 'Supervisor', 'Manager'] },
    { id: 'monitor',     label: 'Monitor Laporan', icon: BarChart2,       roles: ['Admin'] },
    { id: 'users',       label: 'User Management', icon: UserCog,         roles: ['Admin'] },
    { id: 'settings',    label: 'Pengaturan',       icon: Settings,        roles: ['Admin', 'Auditor', 'Supervisor', 'Manager'] },
  ].filter(n => n.roles.includes(user.role));

  const SW = collapsed ? SIDEBAR_MINI : SIDEBAR_FULL;

  // Bottom nav: show max 5 items; if more → show 4 + "More"
  const BOTTOM_MAX    = 5;
  const showMore      = isMobile && navItems.length > BOTTOM_MAX;
  const bottomItems   = showMore ? navItems.slice(0, BOTTOM_MAX - 1) : navItems;
  const drawerItems   = showMore ? navItems.slice(BOTTOM_MAX - 1)    : [];
  const BOTTOM_H      = 62; // px height of mobile bottom bar

  return (
    <AuthContext.Provider value={{ user, login, logout, themeKey, applyTheme }}>
      <MobileContext.Provider value={isMobile}>
      <ToastContext.Provider value={addToast}>
        <ToastContainer toasts={toasts} remove={removeToast} />
        <AuditNotifContainer notifs={auditNotifs} remove={removeAuditNotif} />

        <div style={{ minHeight: '100vh', display: 'flex', background: T.bg, fontFamily: SANS }}>

          {/* ── SIDEBAR (desktop only) ── */}
          <aside style={{
            position: 'fixed', left: 0, top: 0, height: '100%', zIndex: 40,
            width: SW, background: T.sidebarBg, display: isMobile ? 'none' : 'flex', flexDirection: 'column',
            transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: '2px 0 8px rgba(0,0,0,0.15)', overflow: 'hidden',
          }}>
            <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: collapsed ? '0 0 0 8px' : '0 14px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, overflow: 'hidden' }}>
              {/* Logo icon — full tanpa kotak */}
              <img
                src={logoMonitra}
                alt="MONITRA"
                style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.4))' }}
              />
              {!collapsed && (
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.white, letterSpacing: '0.04em' }}>MONITRA</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Monitoring &amp; Tracking</div>
                </div>
              )}
            </div>

            <nav style={{ flex: 1, padding: collapsed ? '10px 6px' : '10px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
              {!collapsed && (
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', padding: '6px 14px 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Navigasi</div>
              )}
              {navItems.map(item => (
                <SidebarItem key={item.id} icon={item.icon} label={item.label} active={activeTab === item.id} collapsed={collapsed} onClick={() => setActiveTab(item.id)} />
              ))}
            </nav>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: collapsed ? '10px 6px' : '10px 10px', flexShrink: 0 }}>
              {!collapsed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: 'rgba(255,255,255,0.06)', cursor: 'pointer' }}
                  onClick={() => setActiveTab('settings')}>
                  {user.photo_url ? (
                    <img src={user.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: T.blue700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: T.white, flexShrink: 0 }}>
                      {user.full_name.charAt(0)}
                    </div>
                  )}
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.full_name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{user.role}</div>
                  </div>
                </div>
              )}
              {/* Pengaturan */}
              <button onClick={() => setActiveTab('settings')} title="Pengaturan Akun"
                style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8, width: '100%', padding: collapsed ? '9px 0' : '8px 10px', borderRadius: 6, background: activeTab === 'settings' ? T.sidebarActive : 'none', border: 'none', color: activeTab === 'settings' ? T.white : 'rgba(255,255,255,0.45)', fontFamily: SANS, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', marginBottom: 2 }}
                onMouseEnter={e => { if (activeTab !== 'settings') { (e.currentTarget).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget).style.color = T.white; } }}
                onMouseLeave={e => { if (activeTab !== 'settings') { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = 'rgba(255,255,255,0.45)'; } }}
              >
                <Settings size={15} style={{ flexShrink: 0 }} />
                {!collapsed && 'Pengaturan'}
              </button>
              {/* Logout */}
              <button onClick={logout} title="Logout" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8, width: '100%', padding: collapsed ? '9px 0' : '8px 10px', borderRadius: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontFamily: SANS, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,77,77,0.1)'; (e.currentTarget).style.color = '#fca5a5'; }}
                onMouseLeave={e => { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = 'rgba(255,255,255,0.45)'; }}
              >
                <LogOut size={15} style={{ flexShrink: 0 }} />
                {!collapsed && 'Logout'}
              </button>
            </div>
          </aside>

          {/* ── MAIN ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: isMobile ? 0 : SW, transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
            <header style={{ position: 'sticky', top: 0, zIndex: 30, height: 56, background: T.white, borderBottom: `1px solid ${T.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 14px' : '0 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
                {/* Desktop: sidebar collapse button */}
                {!isMobile && (
                  <button onClick={() => setCollapsed(!collapsed)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, background: 'none', border: `1px solid ${T.gray200}`, color: T.gray500, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget).style.background = T.gray50; (e.currentTarget).style.color = T.gray900; }}
                    onMouseLeave={e => { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = T.gray500; }}>
                    {collapsed ? <Menu size={15} /> : <ChevronLeft size={15} />}
                  </button>
                )}
                {/* Mobile: logo mark */}
                {isMobile && (
                  <img src={logoMonitra} alt="M" style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                  {!isMobile && <><span style={{ color: T.gray400 }}>MONITRA</span><span style={{ color: T.gray300 }}>›</span></>}
                  <span style={{ color: T.gray700, fontWeight: 600, fontSize: isMobile ? 14 : 13 }}>{navItems.find(n => n.id === activeTab)?.label}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10 }}>
                {/* WS indicator — on mobile show only dot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={wsConnected ? 'Realtime terhubung' : 'Realtime terputus'}>
                  {wsConnected
                    ? <Wifi size={14} style={{ color: T.green }} />
                    : <WifiOff size={14} style={{ color: T.gray400 }} />}
                  {!isMobile && <span style={{ fontSize: 11, color: wsConnected ? T.green : T.gray400 }}>{wsConnected ? 'Live' : 'Offline'}</span>}
                </div>
                {/* ── Notification Bell ─────────────────────── */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setNotifOpen(o => !o)}
                    title={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ''}`}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: notifOpen ? T.gray100 : 'none', border: 'none', cursor: 'pointer', color: unreadCount > 0 ? T.blue700 : T.gray500, transition: 'all 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.gray100; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = notifOpen ? T.gray100 : 'none'; }}
                  >
                    <Bell size={16} />
                    {unreadCount > 0 && (
                      <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: `2px solid ${T.white}` }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown panel */}
                  {notifOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, background: T.white, borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.16)', border: `1px solid ${T.gray200}`, overflow: 'hidden', zIndex: 9999 }}>

                      {/* ── Header ── */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', background: T.white, borderBottom: `1px solid ${T.gray100}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Bell size={15} style={{ color: T.gray700 }} />
                          <span style={{ fontWeight: 700, fontSize: 14, color: T.gray900 }}>Notifikasi</span>
                          {unreadCount > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, background: '#ef4444', color: T.white, borderRadius: 20, padding: '1px 7px', fontFamily: MONO }}>
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead}
                            style={{ fontSize: 11, color: T.blue700, background: T.blue50, border: `1px solid ${T.blue100}`, cursor: 'pointer', padding: '4px 9px', borderRadius: 6, fontWeight: 600, fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={11} /> Baca semua
                          </button>
                        )}
                      </div>

                      {/* ── List ── */}
                      <div style={{ overflowY: 'auto', maxHeight: 360 }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                            <div style={{ width: 52, height: 52, borderRadius: 14, background: T.gray50, border: `1px solid ${T.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                              <BellOff size={22} style={{ color: T.gray300 }} />
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.gray500 }}>Belum ada notifikasi</div>
                            <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>Notifikasi akan muncul di sini</div>
                          </div>
                        ) : notifications.map((n, idx) => {
                          const isReminder = n.type === 'REMINDER';
                          const iconBg   = isReminder ? '#fef3c7' : T.blue50;
                          const iconText = isReminder ? '⏰' : '🔔';
                          return (
                            <div key={n.id} onClick={() => markOneRead(n.id)}
                              style={{
                                display: 'flex', gap: 12, padding: '12px 16px',
                                cursor: 'pointer',
                                background: n.is_read ? T.white : '#f0f7ff',
                                borderBottom: idx < notifications.length - 1 ? `1px solid ${T.gray100}` : 'none',
                                transition: 'background 0.12s',
                                borderLeft: n.is_read ? '3px solid transparent' : `3px solid ${T.blue700}`,
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.gray50; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.is_read ? T.white : '#f0f7ff'; }}
                            >
                              {/* Icon */}
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, marginTop: 1 }}>
                                {iconText}
                              </div>
                              {/* Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                                  <div style={{ fontSize: 12, fontWeight: n.is_read ? 500 : 700, color: T.gray900, lineHeight: 1.3 }}>{n.title}</div>
                                  {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.blue700, flexShrink: 0, marginTop: 3 }} />}
                                </div>
                                <div style={{ fontSize: 11, color: T.gray500, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{n.body}</div>
                                <div style={{ fontSize: 10, color: T.gray400, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Clock size={9} />
                                  {relativeTime(n.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* ── Footer ── */}
                      {notifications.length > 0 && (
                        <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.gray100}`, background: T.gray50, textAlign: 'center' }}>
                          <span style={{ fontSize: 11, color: T.gray400 }}>
                            {notifications.length} notifikasi · {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'semua sudah dibaca'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isMobile && <div style={{ width: 1, height: 20, background: T.gray200 }} />}
                <button onClick={() => setActiveTab('settings')} title="Pengaturan Akun"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 8, transition: 'background 0.12s' }}
                  onMouseEnter={e => { (e.currentTarget).style.background = T.gray100; }}
                  onMouseLeave={e => { (e.currentTarget).style.background = 'none'; }}>
                  {/* Name + role — hide on mobile */}
                  {!isMobile && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.gray800 }}>{user.full_name}</div>
                      <div style={{ fontSize: 11, color: T.gray400 }}>{user.role}</div>
                    </div>
                  )}
                  {user.photo_url ? (
                    <img src={user.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: T.blue700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.white, flexShrink: 0 }}>
                      {user.full_name.charAt(0)}
                    </div>
                  )}
                </button>
              </div>
            </header>

            <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 12px' : 22, paddingBottom: isMobile ? BOTTOM_H + 14 : 22 }}>
              <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                    {activeTab === 'dashboard'   && <Dashboard />}
                    {activeTab === 'pts'         && <PTManagement />}
                    {activeTab === 'assignments' && <AuditAssignments />}
                    {activeTab === 'reports'     && <DailyReports />}
                    {activeTab === 'daily_log'   && <SpvDailyLog />}
                    {activeTab === 'visits'      && <VisitLogs />}
                    {activeTab === 'archive'     && <PTArchive />}
                    {activeTab === 'progress'    && <ProgressMonitoring />}
                    {activeTab === 'monitor'     && <ReportMonitor />}
                    {activeTab === 'users'       && <UserManagement />}
                    {activeTab === 'settings'    && <AccountSettings />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>

            {/* Footer — desktop only */}
            {!isMobile && (
              <footer style={{ borderTop: `1px solid ${T.gray200}`, background: T.white }}>
                {/* ── Scrolling ticker ── */}
                <div style={{ background: T.blue900, overflow: 'hidden', padding: '5px 0', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: `linear-gradient(to right, ${T.blue900}, transparent)`, zIndex: 1, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: `linear-gradient(to left, ${T.blue900}, transparent)`, zIndex: 1, pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', width: 'max-content', animation: 'marquee 28s linear infinite', willChange: 'transform' }}>
                    {[0, 1].map(i => (
                      <span key={i} style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'rgba(255,255,255,0.75)', paddingRight: 80, letterSpacing: '0.03em' }}>
                        <span style={{ color: T.blue500, fontWeight: 700, marginRight: 8 }}>●</span>
                        MONITRA &nbsp;·&nbsp; Kantor Akuntan Publik Budiandru dan Rekan &nbsp;·&nbsp; Grand Kartika, Jl. Jambore No.8A-9A, RT.5/RW.6, Cibubur, Kec. Ciracas, Kota Jakarta Timur, Daerah Khusus Ibukota Jakarta 13720
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '7px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: T.gray400 }}>© 2026 MONITRA — Monitoring &amp; Tracking for Audit</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: T.gray300 }}>v1.0.0</span>
                </div>
              </footer>
            )}
          </div>
        </div>

        {/* ══════════ MOBILE BOTTOM NAVIGATION ══════════ */}
        {isMobile && (
          <>
            {/* "More" drawer backdrop */}
            <AnimatePresence>
              {drawerOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setDrawerOpen(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 48 }} />
              )}
            </AnimatePresence>

            {/* "More" drawer — slides up */}
            <AnimatePresence>
              {drawerOpen && (
                <motion.div
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  style={{ position: 'fixed', bottom: BOTTOM_H, left: 0, right: 0, zIndex: 49, background: T.sidebarBg, borderRadius: '18px 18px 0 0', padding: '10px 0 6px', boxShadow: '0 -4px 24px rgba(0,0,0,0.3)' }}>
                  {/* handle bar */}
                  <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 99, margin: '0 auto 12px' }} />
                  <div style={{ padding: '0 8px 4px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', paddingLeft: 18 }}>Menu lainnya</div>
                  {drawerItems.map(item => (
                    <button key={item.id} onClick={() => setActiveTab(item.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 18px', background: activeTab === item.id ? 'rgba(255,255,255,0.1)' : 'none', border: 'none', cursor: 'pointer', color: activeTab === item.id ? T.white : 'rgba(255,255,255,0.65)', fontFamily: SANS, fontSize: 14, fontWeight: activeTab === item.id ? 600 : 400, textAlign: 'left', borderLeft: activeTab === item.id ? `3px solid ${T.blue500}` : '3px solid transparent' }}>
                      <item.icon size={18} />
                      {item.label}
                    </button>
                  ))}
                  {/* Logout inside drawer */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8 }}>
                    <button onClick={logout}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontFamily: SANS, fontSize: 14, textAlign: 'left' }}>
                      <LogOut size={18} /> Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom nav bar */}
            <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, height: BOTTOM_H, background: T.sidebarBg, borderTop: '1px solid rgba(255,255,255,0.09)', display: 'flex', boxShadow: '0 -2px 16px rgba(0,0,0,0.22)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              {bottomItems.map(item => {
                const active = activeTab === item.id;
                return (
                  <button key={item.id} onClick={() => setActiveTab(item.id)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: active ? T.blue500 : 'rgba(255,255,255,0.42)', position: 'relative', transition: 'color 0.15s' }}>
                    {active && (
                      <motion.div layoutId="bottomActive"
                        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 2.5, background: T.blue500, borderRadius: '0 0 4px 4px' }} />
                    )}
                    <item.icon size={21} strokeWidth={active ? 2.2 : 1.7} />
                    <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 400, letterSpacing: '0.01em' }}>{item.label}</span>
                  </button>
                );
              })}
              {/* "More" button */}
              {showMore && (
                <button onClick={() => setDrawerOpen(v => !v)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: drawerOpen ? T.blue500 : 'rgba(255,255,255,0.42)', position: 'relative', transition: 'color 0.15s' }}>
                  {drawerOpen && (
                    <motion.div layoutId="bottomActive"
                      style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 2.5, background: T.blue500, borderRadius: '0 0 4px 4px' }} />
                  )}
                  <Menu size={21} strokeWidth={1.7} />
                  <span style={{ fontSize: 9.5, fontWeight: 400 }}>Lainnya</span>
                </button>
              )}
            </nav>
          </>
        )}

      </ToastContext.Provider>
      </MobileContext.Provider>
    </AuthContext.Provider>
  );
}
