import { describe, expect, it } from 'vitest';
import { PATHS } from '../config/meta/paths';
import { resolvePreset } from '../config/meta/thresholds';
import { resolveEconomics, sanitizeEconomics, tierOf, validateEconomics } from './economics';

const P = resolvePreset('ecommerce');

describe('resolveEconomics', () => {
  it('Sales: GP, target 33%, ROAS, profit', () => {
    const e = resolveEconomics(PATHS.sales_website, { price: 149000, cost: 45000 }, { spend: 350000, purchases: 6 }, P)!;
    expect(e.ref).toBe(104000);
    expect(e.targetCost).toBeCloseTo(34320);
    expect(e.roas).toBeCloseTo((6 * 149000) / 350000);
    expect(e.profit).toBe(6 * 104000 - 350000);
  });
  it('Sales: conversionValue dari Meta menggantikan purchases × harga untuk ROAS', () => {
    const e = resolveEconomics(PATHS.sales_website, { price: 149000, cost: 45000, conversionValue: 1000000 }, { spend: 500000, purchases: 6 }, P)!;
    expect(e.roas).toBe(2);
  });
  it('Lead: CPL impas = GP deal × valid × close; default preset dipakai bila kosong', () => {
    const e = resolveEconomics(PATHS.leads_whatsapp, { dealValue: 5_000_000, dealCost: 3_000_000 }, { spend: 800000, conversations: 90 }, P)!;
    expect(e.ref).toBeCloseTo(2_000_000 * 0.7 * 0.07);
    expect(e.defaultsUsed).toBe(true);
    const b2b = resolveEconomics(PATHS.leads_website, { dealValue: 5_000_000, dealCost: 3_000_000 }, { spend: 1, leads: 1 }, resolvePreset('b2b'))!;
    expect(b2b.ref).toBeCloseTo(2_000_000 * 0.3 * 0.4);
  });
  it('Lead: rate dari user menang atas default', () => {
    const e = resolveEconomics(PATHS.leads_website, { dealValue: 1_000_000, dealCost: 0, validRate: 50, closeRate: 10 }, { spend: 1, leads: 1 }, P)!;
    expect(e.ref).toBeCloseTo(50000);
    expect(e.defaultsUsed).toBe(false);
  });
  it('App: nilai per hasil', () => {
    const e = resolveEconomics(PATHS.app_installs, { valuePerResult: 20000 }, { spend: 100000, installs: 10 }, P)!;
    expect(e.ref).toBe(20000);
    expect(e.profit).toBe(10 * 20000 - 100000);
  });
  it('tidak lengkap atau path tanpa economics → null', () => {
    expect(resolveEconomics(PATHS.sales_website, { price: 149000 }, { spend: 1 }, P)).toBeNull();
    expect(resolveEconomics(PATHS.sales_website, undefined, { spend: 1 }, P)).toBeNull();
    expect(resolveEconomics(PATHS.traffic_lp, { price: 1, cost: 0 }, { spend: 1 }, P)).toBeNull();
  });
});

describe('tierOf', () => {
  it.each([[33, 'winning'], [34, 'profitable'], [60, 'profitable'], [61, 'tipis'], [100, 'tipis'], [101, 'rugi']] as const)(
    'biaya %d%% dari impas → %s', (pct, tier) => expect(tierOf(pct, 100)).toBe(tier));
});

describe('economics helpers', () => {
  it('sanitize membuang field milik path lain', () => {
    expect(sanitizeEconomics(PATHS.sales_website, { price: 1, cost: 0, dealValue: 5 })).toEqual({ price: 1, cost: 0 });
    expect(sanitizeEconomics(PATHS.traffic_lp, { price: 1 })).toBeUndefined();
  });
  it('validate menolak harga ≤ biaya, rate di luar 0-100, dan negatif', () => {
    expect(validateEconomics({ price: 100, cost: 100 })).toHaveLength(1);
    expect(validateEconomics({ dealValue: 10, dealCost: 20 })).toHaveLength(1);
    expect(validateEconomics({ validRate: 120, closeRate: 0 })).toHaveLength(1);
    expect(validateEconomics({ price: -1 })).toHaveLength(1);
    expect(validateEconomics({ price: 149000, cost: 45000 })).toEqual([]);
  });
});
