import type { Unit } from '../engine/types';

const nf = (n: number, max: number) => n.toLocaleString('id-ID', { maximumFractionDigits: max });

export const fmtNum = (n: number, max = 0) => nf(n, max);
export const fmtRp = (n: number) => `${n < 0 ? '-' : ''}Rp${nf(Math.abs(Math.round(n)), 0)}`;
export const fmtPct = (n: number) => `${nf(n, 1)}%`;
export const fmtX = (n: number) => `${nf(n, 1)}x`;

export function fmtUnit(v: number | null | undefined, u: Unit): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return u === 'rp' ? fmtRp(v) : u === 'pct' ? fmtPct(v) : u === 'x' ? fmtX(v) : fmtNum(v, 1);
}

/** Terima "Rp1.250.000", "1.250.000", "12,5", "1.234,56", "12.5". Kosong/rusak → null. */
export function parseID(raw: string): number | null {
  let s = raw.trim().replace(/^rp\.?\s*/i, '').replace(/\s+/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}
