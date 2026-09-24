import { describe, expect, it } from 'vitest';
import { PATHS } from '../config/meta/paths';
import { checkTracking, sanitize, validate } from './gates';

const web = PATHS.sales_website;
const ok = { spend: 350000, impressions: 30000, linkClicks: 400, lpv: 260, initiateCheckout: 24, purchases: 6 };

describe('validate', () => {
  it('lolos untuk data wajar', () => expect(validate(ok, web, 'campaign', 5)).toEqual([]));
  it('field wajib kosong', () => {
    const errs = validate({ spend: 1000, impressions: 100 }, web, 'campaign', 5);
    expect(errs).toContain('Link Clicks wajib diisi.');
    expect(errs).toContain('Purchases wajib diisi.');
  });
  it('Ad Set mewajibkan reach', () => {
    expect(validate(ok, web, 'adset', 5)).toContain('Reach wajib diisi.');
    expect(validate(ok, web, 'campaign', 5)).not.toContain('Reach wajib diisi.');
  });
  it('hubungan mustahil', () => {
    expect(validate({ ...ok, reach: 40000 }, web, 'campaign', 5)).toContain('Reach tidak mungkin melebihi Impressions.');
    expect(validate({ ...ok, linkClicks: 40000 }, web, 'campaign', 5)).toContain('Link Clicks tidak mungkin melebihi Impressions.');
    expect(validate({ ...ok, lpv: 441 }, web, 'campaign', 5)).toContain('LPV tidak mungkin melebihi Link Clicks lebih dari 10%.');
    expect(validate({ ...ok, lpv: 440 }, web, 'campaign', 5)).toEqual([]); // toleransi 10%
    expect(validate({ ...ok, purchases: 29 }, web, 'campaign', 5)).toContain('Purchases tidak mungkin melebihi Initiate Checkout lebih dari 20%.');
    expect(validate({ ...ok, purchases: 28 }, web, 'campaign', 5)).toEqual([]); // 24 × 1,2 = 28,8
  });
  it('negatif, spend 0, days tidak valid', () => {
    expect(validate({ ...ok, lpv: -1 }, web, 'campaign', 5)).toContain('Landing Page Views tidak boleh negatif.');
    expect(validate({ ...ok, spend: 0 }, web, 'campaign', 5)).toContain('Ad Spend harus lebih dari 0.');
    expect(validate(ok, web, 'campaign', NaN)).toHaveLength(1);
  });
  it('economics tidak konsisten ikut ditolak', () => {
    expect(validate(ok, web, 'campaign', 5, { price: 100, cost: 200 })).toHaveLength(1);
  });
});

describe('checkTracking', () => {
  it('LPV 0 dengan klik ≥ 50', () => expect(checkTracking({ ...ok, lpv: 0 }, web)).toHaveLength(1));
  it('LPV rate < 40%', () => expect(checkTracking({ ...ok, lpv: 100 }, web)).toHaveLength(1));
  it('klik < 50 tidak dicurigai', () => expect(checkTracking({ ...ok, linkClicks: 40, lpv: 0 }, web)).toEqual([]));
  it('IC ≥ 10 tanpa purchase', () => expect(checkTracking({ ...ok, purchases: 0 }, web)).toHaveLength(1));
  it('chat 0 dengan klik ≥ 50 (path chat)', () => {
    expect(checkTracking({ linkClicks: 60, conversations: 0 }, PATHS.leads_whatsapp)).toHaveLength(1);
    expect(checkTracking({ linkClicks: 60, leads: 0 }, PATHS.leads_instant)).toEqual([]);
  });
  it('data sehat → kosong', () => expect(checkTracking(ok, web)).toEqual([]));
});

describe('sanitize', () => {
  it('membuang metrik milik path lain', () => {
    expect(sanitize({ ...ok, calls: 5, leads: 3 }, web, 'campaign')).toEqual(ok);
  });
  it('level Ad menyimpan 3s plays dan ThruPlays opsional', () => {
    expect(sanitize({ ...ok, plays3s: 100, thruPlays: 40 }, web, 'ad')).toMatchObject({ plays3s: 100, thruPlays: 40 });
    expect(sanitize({ ...ok, plays3s: 100 }, web, 'campaign')).not.toHaveProperty('plays3s');
  });
});
