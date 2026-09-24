import { beforeEach, describe, expect, it } from 'vitest';
import { SAMPLES } from '../config/meta/samples';
import { resolvePreset } from '../config/meta/thresholds';
import { emptyForm, fromInput, missingRequired, parseForm } from './form';
import { decodeState, encodeState } from './share';
import { loadSettings } from './storage';

describe('review fixes (lib)', () => {
  it('share: pathId prototype ditolak', () => {
    const s = encodeState({ input: { ...SAMPLES[0].input, pathId: 'constructor' }, presetId: 'ecommerce', overrides: {} });
    expect(decodeState(s)).toBeNull();
  });
  it('missingRequired: pathId prototype tidak melempar', () => {
    expect(missingRequired({ ...emptyForm(), pathId: 'toString' })).toContain('pathId');
  });
  it('resolvePreset hanya menyalin sehat/kritis numerik', () => {
    const t = resolvePreset('ecommerce', { ctr: { dir: 'lower', sehat: 'x', kritis: 0.5 } as never }).th.ctr;
    expect(t.dir).toBe('higher');
    expect(t.sehat).toBe(1.2);
    expect(t.kritis).toBe(0.5);
  });
  it('fromInput: days NaN → kosong, bukan "NaN"', () => {
    const f = fromInput({ ...SAMPLES[0].input, days: NaN }, 'ecommerce', {});
    expect(f.days).toBe('');
    expect(parseForm(f).bad).not.toContain('days');
  });

  describe('storage', () => {
    let data: Map<string, string>;
    beforeEach(() => {
      data = new Map();
      (globalThis as { localStorage?: unknown }).localStorage = {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => { data.set(k, v); },
      };
    });
    it('loadSettings jatuh ke default untuk nilai tersimpan yang tidak valid', () => {
      for (const raw of ['null', '"x"', '{"presetId":5}']) {
        data.set('ads-diag:settings:v1', raw);
        expect(loadSettings()).toEqual({ presetId: 'ecommerce', overrides: {} });
      }
    });
  });
});
