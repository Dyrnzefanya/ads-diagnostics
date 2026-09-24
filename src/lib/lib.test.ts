import { beforeEach, describe, expect, it } from 'vitest';
import { SAMPLES } from '../config/meta/samples';
import { resolvePreset } from '../config/meta/thresholds';
import { diagnose } from '../engine/diagnose';
import { emptyForm, fromInput, missingRequired, parseForm } from './form';
import { decodeState, encodeState } from './share';
import { MAX_HISTORY, addHistory, clearHistory, loadHistory, loadSettings, removeHistory, saveSettings } from './storage';

describe('form', () => {
  it('parseForm membaca format Indonesia dan menandai teks rusak', () => {
    const f = { ...emptyForm(), days: '5', metrics: { spend: 'Rp1.250.000', impressions: '30.000', linkClicks: 'abc' }, eco: { price: '149.000' } };
    const { input, bad } = parseForm(f);
    expect(input.metrics).toEqual({ spend: 1250000, impressions: 30000 });
    expect(input.economics).toEqual({ price: 149000 });
    expect(input.days).toBe(5);
    expect(bad).toEqual(['linkClicks']);
  });
  it('field kosong bukan error parse, tetapi terdeteksi sebagai wajib kosong', () => {
    const f = emptyForm();
    expect(parseForm(f).bad).toEqual([]);
    expect(missingRequired(f)).toEqual(expect.arrayContaining(['days', 'spend', 'impressions', 'linkClicks', 'lpv', 'initiateCheckout', 'purchases']));
    expect(missingRequired({ ...f, level: 'adset' })).toContain('reach');
  });
  it('fromInput ↔ parseForm bolak-balik tanpa kehilangan angka (termasuk desimal)', () => {
    const input = { ...SAMPLES[1].input, metrics: { ...SAMPLES[1].input.metrics, spend: 350000.5 } };
    expect(parseForm(fromInput(input, 'ecommerce', {})).input).toEqual(input);
  });
});

describe('share', () => {
  it('encode → decode identik dan aman di URL', () => {
    const state = { input: SAMPLES[0].input, presetId: 'b2b', overrides: { ctr: { sehat: 1.5 } } };
    const s = encodeState(state);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeState(s)).toEqual(state);
  });
  it('link rusak atau isi tidak valid → null', () => {
    expect(decodeState('bukan-base64!!')).toBeNull();
    expect(decodeState(encodeState({ input: { ...SAMPLES[0].input, pathId: 'ngawur' }, presetId: 'x', overrides: {} }))).toBeNull();
    expect(decodeState('')).toBeNull();
  });
  it('days kosong (NaN) selamat melewati JSON', () => {
    const s = decodeState(encodeState({ input: { ...SAMPLES[0].input, days: NaN }, presetId: 'ecommerce', overrides: {} }));
    expect(Number.isNaN(s?.input.days)).toBe(true);
  });
});

describe('storage', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
    };
  });
  const entry = (n: number) => ({ label: `L${n}`, kondisi: 'STABIL', pathLabel: 'p', level: 'campaign' as const, state: 's' });

  it('riwayat terbaru di depan, maksimal 50, bisa hapus satu dan semua', () => {
    for (let i = 0; i < MAX_HISTORY + 5; i++) addHistory(entry(i));
    const list = loadHistory();
    expect(list).toHaveLength(MAX_HISTORY);
    expect(list[0].label).toBe(`L${MAX_HISTORY + 4}`);
    removeHistory(list[0].id);
    expect(loadHistory()).toHaveLength(MAX_HISTORY - 1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it('settings tersimpan; storage rusak → default', () => {
    expect(loadSettings().presetId).toBe('ecommerce');
    saveSettings({ presetId: 'b2b', overrides: { ctr: { sehat: 1 } } });
    expect(loadSettings().presetId).toBe('b2b');
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadSettings().presetId).toBe('ecommerce');
    expect(loadHistory()).toEqual([]);
    expect(() => addHistory(entry(1))).not.toThrow();
  });
});

describe('samples', () => {
  const want = ['SCALE AGRESIF', 'PERBAIKI LANDING PAGE DULU', 'PERBAIKI CHECKOUT DULU', 'PAUSE & ITERASI'];
  it.each(SAMPLES.map((s, i) => [s.id, s, want[i]] as const))('%s → %s', (_id, sample, label) => {
    expect(diagnose(sample.input, resolvePreset('ecommerce')).label).toBe(label);
  });
});
