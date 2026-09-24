import { describe, expect, it } from 'vitest';
import { BASE_TH } from '../config/meta/thresholds';
import { scoreConfidence, scoreStage, weakestStage } from './funnel';
import type { StageDef } from './types';

const def = (key: string, v: number | null): StageDef => ({ key, label: key, unit: 'pct', tag: 'X', compute: () => v });

describe('scoreStage', () => {
  it('higher_better: batas sehat inklusif, batas kritis eksklusif', () => {
    const s = (v: number) => scoreStage(def('lp_conversion', v), {}, BASE_TH).status;
    expect(s(20)).toBe('sehat');
    expect(s(15)).toBe('waspada');
    expect(s(14.99)).toBe('kritis');
  });
  it('lower_better', () => {
    const s = (v: number) => scoreStage(def('cpm', v), {}, BASE_TH).status;
    expect(s(40000)).toBe('sehat');
    expect(s(100000)).toBe('waspada');
    expect(s(100001)).toBe('kritis');
  });
  it('rel: batas dikali ref; tanpa ref → na', () => {
    expect(scoreStage(def('cost', 25000), {}, BASE_TH, 100000).status).toBe('sehat');
    expect(scoreStage(def('cost', 60000), {}, BASE_TH, 100000).status).toBe('waspada');
    expect(scoreStage(def('cost', 120000), {}, BASE_TH, 100000).status).toBe('kritis');
    expect(scoreStage(def('cost', 25000), {}, BASE_TH).status).toBe('na');
  });
  it('nilai null atau threshold tak dikenal → na', () => {
    expect(scoreStage(def('cpm', null), {}, BASE_TH).status).toBe('na');
    expect(scoreStage(def('tidak_ada', 1), {}, BASE_TH).status).toBe('na');
  });
});

describe('scoreConfidence', () => {
  it.each([
    [4, 'purchase', 'rendah'], [5, 'purchase', 'sedang'], [14, 'purchase', 'sedang'], [15, 'purchase', 'tinggi'],
    [9, 'lead', 'rendah'], [30, 'lead', 'tinggi'], [99, 'traffic', 'rendah'], [300, 'traffic', 'tinggi'],
    [1000, 'engagement', 'tinggi'], [4999, 'reach', 'rendah'], [20000, 'reach', 'tinggi'],
  ] as const)('%d %s → %s', (n, scale, want) => expect(scoreConfidence(n, scale)).toBe(want));
});

describe('weakestStage', () => {
  it('memilih skor terendah dan mengabaikan cost', () => {
    const a = scoreStage(def('lpv_rate', 60), {}, BASE_TH); // (60-50)/25 = 0.4
    const b = scoreStage(def('checkout_completion', 15), {}, BASE_TH); // (15-12)/13 ≈ 0.23
    const cost = scoreStage(def('cost', 100000), {}, BASE_TH, 100000); // skor 0, harus diabaikan
    expect(weakestStage([a, b, cost])?.key).toBe('checkout_completion');
  });
});
