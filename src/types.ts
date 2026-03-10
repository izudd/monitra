export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'Admin' | 'Auditor' | 'Supervisor' | 'Manager';
  photo_url?: string;
  email?: string;
  email_reminder?: number; // 1 = aktif, 0 = nonaktif
}

export interface PT {
  id: number;
  nama_pt: string;
  alamat: string;
  PIC: string;
  periode_start: string;
  periode_end: string;
  status: 'Active' | 'Completed' | 'Cancelled';
  // tracking siapa dan dari mana PT ini dibuat
  source?: 'manual' | 'imdacs_import' | 'imdacs_sync';
  created_by?: number | null;
  created_by_name?: string | null;
  created_at?: string;
}

export interface Assignment {
  id: number;
  pt_id: number;
  auditor_id: number;
  start_date: string;
  end_date: string;
  status: 'Active' | 'Inactive';
  nama_pt?: string;
  auditor_name?: string;
}

export interface DailyReport {
  id: number;
  assignment_id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  area_diaudit: string;
  deskripsi_pekerjaan: string;
  temuan: string;
  progress: number;
  kendala: string;
  status: 'Ongoing' | 'Completed';
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  approved_by?: number;
  approved_at?: string;
  supervisor_notes?: string;
  created_at?: string;
  nama_pt?: string;
  auditor_name?: string;
}
