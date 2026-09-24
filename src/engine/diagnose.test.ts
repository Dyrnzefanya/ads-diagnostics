import { describe, expect, it } from 'vitest';
import { PATH_LIST, fieldsFor } from '../config/meta/paths';
import { resolvePreset } from '../config/meta/thresholds';
import { diagnose } from './diagnose';
import { FLAG, type DiagnosisInput, type Economics, type Metrics } from './types';

const P = resolvePreset('ecommerce');
const eco: Economics = { price: 149000, cost: 45000 }; // GP 104.000 → target CPA 34.320
const run = (i: Partial<DiagnosisInput> & { metrics: Metrics }) =>
  diagnose({ pathId: 'sales_website', level: 'campaign', days: 5, economics: eco, ...i }, P);

// Test case #1 Dok Planning: LP conversion 9,2% (< 15%), CPA 56% GP.
const s1: Metrics = { spend: 350000, impressions: 30000, reach: 22000, linkClicks: 400, lpv: 260, initiateCheckout: 24, purchases: 6 };
// Test case #5: semua tahap sehat, CPA 25% GP, 20 purchase, frequency 1,8.
const s5: Metrics = { spend: 520000, impressions: 15000, reach: 8333, linkClicks: 250, lpv: 200, initiateCheckout: 50, purchases: 20 };

describe('10 test case Dok Planning', () => {
  it('#1 LP conversion rendah → PERBAIKI LANDING PAGE DULU', () => {
    const r = run({ metrics: s1 });
    expect(r.label).toBe('PERBAIKI LANDING PAGE DULU');
    expect(r.kondisi).toBe('PERLU PERHATIAN');
    expect(r.bottleneck?.key).toBe('lp_conversion');
    expect(r.bottleneck?.value).toBeCloseTo(9.23, 1);
    expect(r.tier).toBe('profitable');
    expect(r.confidence).toBe('sedang');
    expect(r.kpis.map((k) => k.label)).toEqual(['Purchase', 'CPA', 'Break-even CPA', 'ROAS', 'Profit setelah iklan']);
    expect(r.narrative.join(' ')).toContain('LP conversion');
  });
  it('#2 purchase 0 padahal IC ≥ 10 → CEK TRACKING DULU', () => {
    expect(run({ metrics: { ...s1, purchases: 0 } }).label).toBe('CEK TRACKING DULU');
  });
  it('#3 hari berjalan 2 → TERLALU DINI', () => {
    const r = run({ metrics: s1, days: 2 });
    expect(r.label).toBe('TERLALU DINI');
    expect(r.kondisi).toBe('NETRAL');
  });
  it('#4 spend ≥ 3× target tanpa hasil → PAUSE & ITERASI', () => {
    const r = run({ metrics: { spend: 400000, impressions: 30000, reach: 22000, linkClicks: 300, lpv: 200, initiateCheckout: 3, purchases: 0 } });
    expect(r.label).toBe('PAUSE & ITERASI');
    expect(r.kondisi).toBe('KRITIS');
  });
  it('#5 semua sehat, CPA 25% GP, 20 purchase → SCALE AGRESIF', () => {
    const r = run({ metrics: s5 });
    expect(r.label).toBe('SCALE AGRESIF');
    expect(r.kondisi).toBe('KUAT');
    expect(r.tier).toBe('winning');
    expect(r.stages.every((s) => s.status === 'sehat')).toBe(true);
  });
  it('#6 sama dengan #5 di level Ad → PERTAHANKAN CREATIVE', () => {
    expect(run({ metrics: s5, level: 'ad' }).label).toBe('PERTAHANKAN CREATIVE');
  });
  it('#7 Leads WhatsApp Ad Set, click-to-chat 30% → PERBAIKI FOLLOW-UP CHAT DULU', () => {
    const r = diagnose({
      pathId: 'leads_whatsapp', level: 'adset', days: 7,
      metrics: { spend: 800000, impressions: 20000, reach: 15000, linkClicks: 300, conversations: 90 },
      economics: { dealValue: 5_000_000, dealCost: 3_000_000 },
    }, P);
    expect(r.label).toBe('PERBAIKI FOLLOW-UP CHAT DULU');
    expect(r.bottleneck?.key).toBe('click_to_chat');
  });
  it('#8 Awareness Ad Set, frequency 5,5 dan CPM 45rb → PERBAIKI DELIVERY DULU', () => {
    const r = diagnose({
      pathId: 'awareness_reach', level: 'adset', days: 5,
      metrics: { spend: 900000, impressions: 20000, reach: 3636 },
    }, P);
    expect(r.label).toBe('PERBAIKI DELIVERY DULU');
    expect(r.flags).not.toContain(FLAG.ECONOMICS_MISSING);
  });
  it('#9 LPV melebihi Link Clicks → DATA BELUM VALID', () => {
    const r = diagnose({
      pathId: 'traffic_lp', level: 'campaign', days: 5,
      metrics: { spend: 500000, impressions: 40000, reach: 30000, linkClicks: 200, lpv: 240 },
    }, P);
    expect(r.label).toBe('DATA BELUM VALID');
    expect(r.errors).toContain('LPV tidak mungkin melebihi Link Clicks lebih dari 10%.');
  });
  it('#10 Instant Form tanpa economics → OPTIMASI & PANTAU + flag', () => {
    const r = diagnose({
      pathId: 'leads_instant', level: 'campaign', days: 5,
      metrics: { spend: 200000, impressions: 6000, reach: 5000, linkClicks: 80, leads: 13 },
    }, P);
    expect(r.label).toBe('OPTIMASI & PANTAU');
    expect(r.flags).toContain(FLAG.ECONOMICS_MISSING);
  });
});

describe('aturan penutup celah (Spec §4.1)', () => {
  it('1. economics kosong: tidak ada kill check, tidak pernah SCALE, maturity hanya dari hari', () => {
    const healthy = run({ metrics: s5, economics: undefined });
    expect(healthy.label).toBe('OPTIMASI & PANTAU');
    expect(healthy.flags).toContain(FLAG.ECONOMICS_MISSING);
    expect(healthy.kpis.find((k) => k.label === 'ROAS')?.needsEconomics).toBe(true);
    const noResult = run({ metrics: { ...s1, purchases: 0, initiateCheckout: 3, spend: 2_000_000 }, economics: undefined });
    expect(noResult.label).not.toBe('PAUSE & ITERASI');
    expect(run({ metrics: { ...s5, spend: 100 }, economics: undefined, days: 3 }).label).not.toBe('TERLALU DINI');
    expect(run({ metrics: s5, economics: undefined, days: 2 }).label).toBe('TERLALU DINI');
  });
  it('2. path tanpa economics: semua sehat → SCALE BERTAHAP; Awareness tidak pernah SCALE AGRESIF', () => {
    const aware = diagnose({ pathId: 'awareness_reach', level: 'campaign', days: 5, metrics: { spend: 400000, impressions: 20000, reach: 10000 } }, P);
    expect(aware.label).toBe('SCALE BERTAHAP');
    const traffic = diagnose({
      pathId: 'traffic_lp', level: 'campaign', days: 5,
      metrics: { spend: 300000, impressions: 30000, reach: 25000, linkClicks: 400, lpv: 320 },
    }, P);
    expect(traffic.label).toBe('SCALE BERTAHAP');
    expect(traffic.flags).toContain(FLAG.OBJECTIVE);
    const lowConf = diagnose({ pathId: 'awareness_reach', level: 'campaign', days: 5, metrics: { spend: 100000, impressions: 5000, reach: 3000 } }, P);
    expect(lowConf.label).toBe('LANJUT TES');
  });
  it('3. urutan matriks: Kritis + Rugi → PAUSE; Tipis + Rendah → PERBAIKI tahap terlemah', () => {
    const kritisRugi = run({ metrics: { spend: 600000, impressions: 30000, reach: 22000, linkClicks: 300, lpv: 200, initiateCheckout: 20, purchases: 5 } });
    expect(kritisRugi.bottleneck?.key).toBe('lp_conversion');
    expect(kritisRugi.tier).toBe('rugi');
    expect(kritisRugi.label).toBe('PAUSE & ITERASI');
    const tipisRendah = run({ metrics: { spend: 240000, impressions: 10000, reach: 8000, linkClicks: 130, lpv: 100, initiateCheckout: 20, purchases: 3 } });
    expect(tipisRendah.tier).toBe('tipis');
    expect(tipisRendah.confidence).toBe('rendah');
    expect(tipisRendah.bottleneck).toBeUndefined();
    expect(tipisRendah.label).toBe('PERBAIKI CHECKOUT DULU');
  });
  it('3b. Rugi + confidence rendah → LANJUT TES TERBATAS', () => {
    const r = run({ metrics: { spend: 500000, impressions: 30000, reach: 22000, linkClicks: 300, lpv: 240, initiateCheckout: 20, purchases: 3 } });
    expect(r.tier).toBe('rugi');
    expect(r.label).toBe('LANJUT TES TERBATAS');
  });
  it('4. level Ad + rugi + purchase > 0: Tinggi → MATIKAN CREATIVE, selain itu LANJUT TES', () => {
    const base = { impressions: 60000, reach: 40000, linkClicks: 900, lpv: 700, initiateCheckout: 60 };
    expect(run({ level: 'ad', metrics: { ...base, spend: 1_800_000, purchases: 15 } }).label).toBe('MATIKAN CREATIVE');
    expect(run({ level: 'ad', metrics: { ...base, spend: 600_000, purchases: 5 } }).label).toBe('LANJUT TES');
  });
  it('5. level Ad: spend < 1× target → LANJUT TES; level lain → TERLALU DINI; hari < 3 tetap TERLALU DINI', () => {
    const tiny: Metrics = { spend: 20000, impressions: 2000, reach: 1800, linkClicks: 30, lpv: 25, initiateCheckout: 2, purchases: 1 };
    expect(run({ level: 'ad', metrics: tiny }).label).toBe('LANJUT TES');
    expect(run({ level: 'campaign', metrics: tiny }).label).toBe('TERLALU DINI');
    expect(run({ level: 'ad', metrics: tiny, days: 2 }).label).toBe('TERLALU DINI');
  });
  it('6. CPC tanpa GP → na dan tidak ikut bottleneck', () => {
    const r = diagnose({
      pathId: 'traffic_lp', level: 'campaign', days: 5,
      metrics: { spend: 300000, impressions: 30000, reach: 25000, linkClicks: 400, lpv: 320 },
    }, P);
    expect(r.stages.find((s) => s.key === 'cpc')?.status).toBe('na');
  });
});

describe('aturan level dan objective', () => {
  it('Ad Set dengan frequency waspada tidak pernah SCALE AGRESIF', () => {
    const r = run({ level: 'adset', metrics: { ...s5, reach: 5000 } }); // frequency 3,0 → waspada
    expect(r.stages.find((s) => s.key === 'frequency')?.status).toBe('waspada');
    expect(r.label).not.toBe('SCALE AGRESIF');
  });
  it('Ad: masalah creative → ITERASI CREATIVE; masalah LP → PERTAHANKAN CREATIVE + catatan level Campaign', () => {
    const lowCtr = run({ level: 'ad', metrics: { ...s5, impressions: 60000, reach: 30000 } }); // CTR 0,4%
    expect(lowCtr.label).toBe('ITERASI CREATIVE');
    const lp = run({ level: 'ad', metrics: s1 });
    expect(lp.label).toBe('PERTAHANKAN CREATIVE');
    expect(lp.flags).toContain(FLAG.AD_CHECK_CAMPAIGN);
  });
  it('Profit ada tetapi purchase < 5 tidak pernah SCALE → LANJUT TES + kandidat winner', () => {
    const r = run({ metrics: { spend: 100000, impressions: 8000, reach: 6000, linkClicks: 120, lpv: 100, initiateCheckout: 20, purchases: 4 } });
    expect(r.tier).toBe('winning');
    expect(r.label).toBe('LANJUT TES');
    expect(r.flags).toContain(FLAG.WINNER_TIPIS);
  });
  it('Ad dengan data video menambah hook/hold rate', () => {
    const r = run({ level: 'ad', metrics: { ...s5, plays3s: 6000, thruPlays: 2000 } });
    expect(r.stages.map((s) => s.key)).toEqual(expect.arrayContaining(['hook_rate', 'hold_rate']));
    expect(run({ level: 'campaign', metrics: { ...s5, plays3s: 6000 } }).stages.some((s) => s.key === 'hook_rate')).toBe(false);
  });
  it('preset & override threshold mengubah diagnosis', () => {
    const strict = resolvePreset('ecommerce', { lp_conversion: { sehat: 30, kritis: 26 } });
    const r = diagnose({ pathId: 'sales_website', level: 'campaign', days: 5, economics: eco, metrics: s5 }, strict);
    expect(r.bottleneck?.key).toBe('lp_conversion');
  });
  it('path tidak dikenal → DATA BELUM VALID', () => {
    expect(diagnose({ pathId: 'x', level: 'ad', days: 5, metrics: {} }, P).label).toBe('DATA BELUM VALID');
  });
  it('angka 0 valid dan tidak crash (semua hasil nol)', () => {
    const r = run({ metrics: { spend: 1000, impressions: 1000, linkClicks: 0, lpv: 0, initiateCheckout: 0, purchases: 0 } });
    expect(r.code).not.toBe('invalid');
    expect(r.narrative.length).toBeGreaterThan(0);
  });
});

describe('smoke: setiap result path × level menghasilkan diagnosis utuh', () => {
  const all: Metrics = {
    spend: 500000, impressions: 40000, reach: 30000, linkClicks: 600, lpv: 480, initiateCheckout: 60, addToCart: 90,
    purchases: 15, leads: 40, conversations: 300, calls: 20, installs: 100, appEvents: 30, engagements: 1500,
    sharesSaves: 200, plays3s: 12000, thruPlays: 4000,
  };
  const allEco: Economics = {
    price: 149000, cost: 45000, dealValue: 5_000_000, dealCost: 3_000_000, valuePerResult: 20000,
  };
  for (const cfg of PATH_LIST) {
    for (const level of ['campaign', 'adset', 'ad'] as const) {
      it(`${cfg.id} · ${level}`, () => {
        const { required, optional } = fieldsFor(cfg, level);
        const metrics = Object.fromEntries([...required, ...optional].map((k) => [k, all[k]])) as Metrics;
        const r = diagnose({ pathId: cfg.id, level, days: 7, metrics, economics: allEco }, P);
        expect(r.errors).toEqual([]);
        expect(r.label).toBeTruthy();
        expect(r.kpis).toHaveLength(5);
        expect(r.stages.length).toBeGreaterThanOrEqual(cfg.stages.length);
        expect(r.narrative.length).toBeGreaterThanOrEqual(3);
        expect(r.checkpoints).toHaveLength(3);
        for (const a of Object.values(r.actions)) expect(a.length).toBeGreaterThan(5);
      });
    }
  }
});
