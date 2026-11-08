// src/utils/slip-modal.ts
// Logika bersama untuk modal slip gaji di dashboard dan kalender.
import { calculateSalary, getSettings } from './storage';

function setText(id: string, text: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

/** Isi modal slip dengan data bulan tertentu. */
export function renderSlip(yearMonth: string): void {
  const settings = getSettings();
  const salary = calculateSalary(yearMonth);

  const formatDays = (value: number) =>
    value.toLocaleString('id-ID', { maximumFractionDigits: 1 });
  const effectiveHadir = salary.totalHadir + salary.totalSetengahHari * 0.5;
  const effectiveSabtu = salary.totalHadirSabtu + salary.totalSetengahSabtu * 0.5;

  setText('slip-periode-text', `PERIODE: ${yearMonth}`);
  setText('slip-name', settings.name || 'Belum diatur');
  setText('slip-rate', `Rp ${settings.dailySalary.toLocaleString('id-ID')}`);
  setText(
    'slip-hadir',
    `${formatDays(effectiveHadir)} / ${salary.totalWorkingDaysInMonth} Hari`
  );
  setText(
    'slip-base-salary',
    `Rp ${salary.baseSalary.toLocaleString('id-ID')}`
  );
  setText(
    'slip-saturday-count',
    `${formatDays(effectiveSabtu)} × Rp ${settings.saturdayBonus.toLocaleString('id-ID')}`
  );
  setText(
    'slip-saturday-bonus',
    `Rp ${salary.saturdayBonus.toLocaleString('id-ID')}`
  );
  setText(
    'slip-bonus-amount',
    `Rp ${salary.bonusAmount.toLocaleString('id-ID')}`
  );
  setText(
    'slip-total-estimated',
    `Rp ${salary.totalEstimated.toLocaleString('id-ID')}`
  );

  const badge = document.getElementById('slip-bonus-badge');
  const amount = document.getElementById('slip-bonus-amount');
  if (!badge || !amount) return;

  if (salary.bonusEligible) {
    badge.textContent = 'Cair';
    badge.className =
      'rounded px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-100 text-emerald-700';
    amount.className = 'font-bold tabular-nums text-emerald-600';
  } else {
    badge.textContent = 'Hangus';
    badge.className =
      'rounded px-1.5 py-0.5 text-[9px] font-black uppercase bg-rose-100 text-rose-700';
    amount.className = 'font-bold tabular-nums text-slate-400 line-through';
  }
}

interface SlipModalOptions {
  /** id tombol yang membuka modal */
  triggerId: string;
  /** bulan yang sedang dilihat halaman */
  getMonth: () => string;
}

/** Pasang event buka/tutup modal slip (termasuk klik backdrop & Escape). */
export function initSlipModal({
  triggerId,
  getMonth,
}: SlipModalOptions): void {
  const modal = document.getElementById('slip-modal');
  const trigger = document.getElementById(triggerId);
  const closeButton = modal?.querySelector<HTMLElement>('[data-slip-close]');

  const close = () => modal?.classList.add('hidden');
  const open = () => {
    renderSlip(getMonth());
    modal?.classList.remove('hidden');
  };

  trigger?.addEventListener('click', open);
  closeButton?.addEventListener('click', close);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}
