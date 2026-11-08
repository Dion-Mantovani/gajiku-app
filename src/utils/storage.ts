// src/utils/storage.ts
import type {
  UserSettings,
  AttendanceStatus,
  MonthAttendanceRecord,
  SalarySummary,
} from '../types';

const SETTINGS_KEY = 'absensi_app_settings';

const DEFAULT_SETTINGS: UserSettings = {
  name: '',
  dailySalary: 80000,
  attendanceBonus: 200000,
  saturdayBonus: 10000,
  workDaysPerWeek: 6,
  isOnboarded: false,
};

// --- SETTINGS MANAGEMENT ---
export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) return DEFAULT_SETTINGS;
  try {
    // Merge dengan default supaya data lama tanpa field baru tetap aman
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// --- ATTENDANCE STORAGE KEYS ---
export function getStorageKey(yearMonth: string): `absensi_${string}` {
  return `absensi_${yearMonth}`;
}

export function getMonthAttendance(yearMonth: string): MonthAttendanceRecord {
  if (typeof window === 'undefined') return {};
  const key = getStorageKey(yearMonth);
  const data = localStorage.getItem(key);
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveMonthAttendance(
  yearMonth: string,
  record: MonthAttendanceRecord
): void {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(yearMonth);
  localStorage.setItem(key, JSON.stringify(record));
}

// --- DATE HELPERS ---
export function formatYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- ATTENDANCE ENGINE (AUTO-PRESENT WITH MUTEX SUNDAY) ---
export function initializeAutoPresent(
  yearMonth: string,
  workDaysPerWeek: number = 6,
  referenceDate: Date = new Date()
): MonthAttendanceRecord {
  const currentRecord = getMonthAttendance(yearMonth);
  const currentYearMonthStr = formatYearMonth(referenceDate);
  const todayStr = formatDateString(referenceDate);

  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;

  const lastDay = new Date(year, month + 1, 0).getDate();
  let updated = false;

  const newRecord: MonthAttendanceRecord = { ...currentRecord };

  for (let day = 1; day <= lastDay; day++) {
    const dateObj = new Date(year, month, day);
    const dateStr = formatDateString(dateObj);
    const dayOfWeek = dateObj.getDay(); // 0 = Minggu

    const isSunday = dayOfWeek === 0;
    const isWeekend =
      workDaysPerWeek === 5 ? isSunday || dayOfWeek === 6 : isSunday;

    const isFutureMonth = yearMonth > currentYearMonthStr;
    const isFutureDayInCurrentMonth =
      yearMonth === currentYearMonthStr && dateStr > todayStr;

    // 🛑 ATURAN MUTLAK HARI MINGGU: selalu libur, disimpan sebagai status
    // khusus 'minggu' supaya tidak ambigu dengan libur perusahaan sungguhan.
    if (isSunday) {
      if (newRecord[dateStr] !== 'minggu') {
        newRecord[dateStr] = 'minggu';
        updated = true;
      }
      continue;
    }

    // Hari di masa depan dikosongkan jika belum ada data
    if (isFutureMonth || isFutureDayInCurrentMonth) {
      if (!newRecord[dateStr]) {
        newRecord[dateStr] = 'empty';
        updated = true;
      }
      continue;
    }

    // Jangan timpa jika sudah di-override user secara manual (Sakit/Izin/Alpha/Hadir)
    if (newRecord[dateStr] && newRecord[dateStr] !== 'empty') {
      continue;
    }

    if (isWeekend) {
      if (!newRecord[dateStr] || newRecord[dateStr] === 'empty') {
        newRecord[dateStr] = 'libur_perusahaan';
        updated = true;
      }
    } else {
      // Hari kerja biasa -> Otomatis Hadir
      if (!newRecord[dateStr] || newRecord[dateStr] === 'empty') {
        newRecord[dateStr] = 'hadir';
        updated = true;
      }
    }
  }

  if (updated) {
    saveMonthAttendance(yearMonth, newRecord);
  }

  return newRecord;
}

// --- FINANCIAL & SALARY ENGINE ---
export function calculateSalary(
  yearMonth: string,
  referenceDate: Date = new Date()
): SalarySummary & { totalWorkingDaysInMonth: number } {
  const settings = getSettings();
  const attendance = getMonthAttendance(yearMonth);

  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let totalHadir = 0;
  let totalSetengahHari = 0;
  let totalHadirSabtu = 0;
  let totalSetengahSabtu = 0;
  let totalSakit = 0;
  let totalIzin = 0;
  let totalAlpha = 0;
  let totalLibur = 0;
  let totalWorkingDaysInMonth = 0;

  let hasViolatedBonus = false;

  // Hitung total hari kerja efektif dalam 1 bulan (Total hari - Minggu - Libur Perusahaan)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dStr = formatDateString(dateObj);
    const isSunday = dateObj.getDay() === 0;
    const status = attendance[dStr];

    // Jika bukan hari Minggu dan bukan Libur Perusahaan, maka ini adalah Hari Kerja Efektif
    if (
      !isSunday &&
      status !== 'libur_perusahaan' &&
      status !== 'tanggal_merah'
    ) {
      totalWorkingDaysInMonth++;
    }
  }

  // Rekap akumulasi status
  for (const dateStr in attendance) {
    const status = attendance[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const isSunday = dateObj.getDay() === 0;

    if (isSunday) continue; // Hari Minggu selalu dilewati dari rekap gaji

    if (status === 'hadir') {
      totalHadir++;
      // Sabtu masuk dapat tambahan tersendiri
      if (dateObj.getDay() === 6) totalHadirSabtu++;
    } else if (status === 'setengah_hari') {
      totalSetengahHari++;
      if (dateObj.getDay() === 6) totalSetengahSabtu++;
    } else if (status === 'sakit') {
      totalSakit++;
      hasViolatedBonus = true;
    } else if (status === 'izin') {
      totalIzin++;
      hasViolatedBonus = true;
    } else if (status === 'alpha') {
      totalAlpha++;
      hasViolatedBonus = true;
    } else if (status === 'libur_perusahaan' || status === 'tanggal_merah') {
      totalLibur++;
    }
  }

  // Setengah hari dihitung 0,5 hari kerja (Sabtu: total gaji + tambahan diprorata)
  const effectiveHadir = totalHadir + totalSetengahHari * 0.5;
  const effectiveSabtu = totalHadirSabtu + totalSetengahSabtu * 0.5;

  const baseSalary = effectiveHadir * settings.dailySalary;
  const saturdayBonus = effectiveSabtu * settings.saturdayBonus;
  // Bonus hangus jika ada Sakit / Izin / Alpha (setengah hari tidak menggugurkan)
  const bonusEligible = !hasViolatedBonus && effectiveHadir > 0;
  const bonusAmount = bonusEligible ? settings.attendanceBonus : 0;
  const totalEstimated = baseSalary + saturdayBonus + bonusAmount;

  return {
    totalHadir,
    totalSetengahHari,
    totalHadirSabtu,
    totalSetengahSabtu,
    totalSakit,
    totalIzin,
    totalAlpha,
    totalLibur,
    totalWorkingDaysInMonth,
    baseSalary,
    saturdayBonus,
    bonusEligible,
    bonusAmount,
    totalEstimated,
  };
}

// --- DATA CONTOH (DEMO) ---
const DEMO_SEED_KEY = 'absensi_demo_seed_v1';

/**
 * Mengisi bulan-bulan sebelumnya dengan contoh absensi supaya kalender
 * punya riwayat. Data yang sudah diisi user tidak akan ditimpa.
 */
export function seedSampleData(monthsBack: number = 2): void {
  if (typeof window === 'undefined') return;

  const settings = getSettings();
  const now = new Date();

  for (let offset = monthsBack; offset >= 1; offset--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const yearMonth = formatYearMonth(monthDate);
    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const record = getMonthAttendance(yearMonth);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = formatDateString(dateObj);

      // Jangan timpa data yang sudah ada
      if (record[dateStr] && record[dateStr] !== 'empty') continue;

      const dayOfWeek = dateObj.getDay(); // 0 = Minggu, 6 = Sabtu

      if (dayOfWeek === 0) {
        record[dateStr] = 'minggu';
      } else if (dayOfWeek === 6 && settings.workDaysPerWeek === 5) {
        record[dateStr] = 'libur_perusahaan';
      } else if (dateStr.endsWith('-12')) {
        record[dateStr] = 'sakit';
      } else if (dateStr.endsWith('-19')) {
        record[dateStr] = 'izin';
      } else if (dateStr.endsWith('-26')) {
        record[dateStr] = 'alpha';
      } else {
        record[dateStr] = 'hadir';
      }
    }

    saveMonthAttendance(yearMonth, record);
  }

  localStorage.setItem(DEMO_SEED_KEY, '1');
}

// --- HIGHEST STREAK STORAGE (PERSONAL BEST) ---
const HIGHEST_STREAK_KEY = 'absensi_highest_streak';

export function getHighestStreak(): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(HIGHEST_STREAK_KEY);
  return val ? parseInt(val, 10) : 0;
}

export function updateHighestStreak(currentActiveStreak: number): number {
  if (typeof window === 'undefined') return currentActiveStreak;
  const currentHighest = getHighestStreak();
  if (currentActiveStreak > currentHighest) {
    localStorage.setItem(HIGHEST_STREAK_KEY, currentActiveStreak.toString());
    return currentActiveStreak;
  }
  return currentHighest;
}
