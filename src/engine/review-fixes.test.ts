import { describe, expect, it } from 'vitest';
import { resolvePreset } from '../config/meta/thresholds';
import { diagnose } from './diagnose';

describe('review fixes (engine)', () => {
  it('pathId nama prototype → DATA BELUM VALID, tidak melempar', () => {
    for (const pathId of ['constructor', 'toString', '__proto__']) {
      const r = diagnose({ pathId, level: 'campaign', days: 5, metrics: {} } as never, resolvePreset('ecommerce'));
      expect(r.label).toBe('DATA BELUM VALID');
    }
  });

  const metrics = { spend: 1000000, impressions: 100000, reach: 40000, linkClicks: 2000, lpv: 1800, initiateCheckout: 500, purchases: 250 };
  const run = (level: 'campaign' | 'ad') =>
    diagnose({ pathId: 'sales_website', level, days: 5, economics: { price: 10000, cost: 5000 }, metrics }, resolvePreset('ecommerce'));

  it('tipis dengan semua tahap sehat → OFFER & HARGA, bukan tahap sehat', () => {
    expect(run('campaign').label).toBe('PERBAIKI OFFER & HARGA DULU');
  });
  it('level ad pada kasus itu tidak ITERASI CREATIVE', () => {
    const r = run('ad');
    expect(r.label).not.toBe('ITERASI CREATIVE');
    expect(r.label).toBe('PERTAHANKAN CREATIVE');
  });
});
