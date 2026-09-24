import type { Economics, Eco, Metrics, PathConfig, ResolvedPreset, Tier } from './types';

/** Target biaya akuisisi = 33% dari batas impas (Ads Calculator Jordan). */
export const TARGET = 0.33;

const KEYS = {
  sales: ['price', 'cost', 'conversionValue'],
  lead: ['dealValue', 'dealCost', 'validRate', 'closeRate'],
  app: ['valuePerResult'],
  none: [],
} as const;

/** Buang field economics yang bukan milik path ini (sisa dari path sebelumnya). */
export function sanitizeEconomics(cfg: PathConfig, e?: Economics): Economics | undefined {
  if (!e) return undefined;
  const out: Economics = {};
  for (const k of KEYS[cfg.economics]) if (e[k] != null) out[k] = e[k];
  return Object.keys(out).length ? out : undefined;
}

export function validateEconomics(e?: Economics): string[] {
  if (!e) return [];
  const errs: string[] = [];
  if (Object.values(e).some((v) => v != null && (!Number.isFinite(v) || v < 0))) {
    errs.push('Angka economics tidak boleh negatif.');
  }
  if (e.price != null && e.cost != null && e.price <= e.cost) {
    errs.push('Harga jual harus lebih besar dari HPP + biaya per penjualan.');
  }
  if (e.dealValue != null && e.dealCost != null && e.dealValue <= e.dealCost) {
    errs.push('Nilai deal harus lebih besar dari HPP/biaya per deal.');
  }
  for (const r of [e.validRate, e.closeRate]) {
    if (r != null && (r <= 0 || r > 100)) errs.push('% lead valid dan close rate harus di atas 0 dan maksimal 100.');
  }
  return [...new Set(errs)];
}

/** null = economics belum lengkap (bukan error). */
export function resolveEconomics(cfg: PathConfig, e: Economics | undefined, m: Metrics, preset: ResolvedPreset): Eco | null {
  if (!e || cfg.economics === 'none') return null;
  const spend = m.spend ?? 0;
  const n = m[cfg.primary] ?? 0;
  const done = (ref: number, revenue: number, profit: number, defaultsUsed = false): Eco | null =>
    ref > 0 ? { kind: cfg.economics, ref, targetCost: TARGET * ref, revenue, roas: revenue / spend, profit, defaultsUsed } : null;

  if (cfg.economics === 'sales') {
    if (e.price == null || e.price <= 0 || e.cost == null) return null;
    const gp = e.price - e.cost;
    const revenue = e.conversionValue ?? n * e.price;
    return done(gp, revenue, n * gp - spend);
  }
  if (cfg.economics === 'lead') {
    if (e.dealValue == null || e.dealValue <= 0 || e.dealCost == null) return null;
    const gp = e.dealValue - e.dealCost;
    const y = ((e.validRate ?? preset.validRate) / 100) * ((e.closeRate ?? preset.closeRate) / 100);
    return done(gp * y, n * y * e.dealValue, n * y * gp - spend, e.validRate == null || e.closeRate == null);
  }
  if (e.valuePerResult == null || e.valuePerResult <= 0) return null;
  return done(e.valuePerResult, n * e.valuePerResult, n * e.valuePerResult - spend);
}

/** Tier dari biaya per hasil vs batas impas: ≤33% winning, ≤60% profitable, ≤100% tipis, di atas itu rugi. */
export function tierOf(cost: number, ref: number): Tier {
  const r = cost / ref;
  return r <= TARGET ? 'winning' : r <= 0.6 ? 'profitable' : r <= 1 ? 'tipis' : 'rugi';
}
