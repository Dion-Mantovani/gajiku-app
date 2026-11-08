// src/types/index.ts

export type AttendanceStatus =
  | 'hadir'
  | 'sakit'
  | 'izin'
  | 'alpha'
  | 'libur_perusahaan'
  | 'tanggal_merah'
  | 'minggu'
  | 'empty';

export interface UserSettings {
  name: string;
  dailySalary: number; // Default: 80000
  attendanceBonus: number; // Default: 200000
  saturdayBonus: number; // Tambahan per Sabtu masuk, default: 10000
  workDaysPerWeek: number; // Default: 6 (Senin - Sabtu)
  isOnboarded: boolean;
}

// Key format: YYYY-MM-DD -> Status
export type MonthAttendanceRecord = Record<string, AttendanceStatus>;

export interface SalarySummary {
  totalHadir: number;
  totalHadirSabtu: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpha: number;
  totalLibur: number;
  baseSalary: number;
  saturdayBonus: number;
  bonusEligible: boolean;
  bonusAmount: number;
  totalEstimated: number;
}
