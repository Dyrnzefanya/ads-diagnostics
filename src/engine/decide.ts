import { weakestStage } from './funnel';
import type { Ctx, Decision } from './types';

/** Tahap funnel yang dinilai untuk bottleneck; stage "cost" dinilai lewat tier, bukan di sini. */
export const funnelOf = (c: Pick<Ctx, 'stages'>) => c.stages.filter((s) => s.key !== 'cost' && s.status !== 'na');

/**
 * Matriks keputusan (Spec §4.1, aturan 1-3). Baris pertama yang cocok menang:
 * Rugi → Tipis → Kritis → confidence Rendah → Waspada → scale.
 */
export function decideBase(c: Ctx): Decision {
  const f = funnelOf(c);
  const kritis = f.find((s) => s.status === 'kritis');
  const { tier, confidence, cfg } = c;

  if (tier === 'rugi') return { code: confidence === 'rendah' ? 'test_limited' : 'pause' };
  if (tier === 'tipis') {
    const stage = kritis ?? weakestStage(f);
    return { code: 'fix', tag: stage?.tag ?? 'OFFER & HARGA', stage };
  }
  if (kritis) return { code: 'fix', tag: kritis.tag, stage: kritis };
  if (confidence === 'rendah' || f.length === 0) return { code: 'test' };
  if (f.some((s) => s.status === 'waspada')) return { code: 'optimize' };
  if (cfg.economics === 'none') return { code: 'scale_step' };
  if (!tier) return { code: 'optimize' }; // economics belum diisi: tidak pernah scale
  return { code: tier === 'winning' && confidence === 'tinggi' ? 'scale_aggr' : 'scale_step' };
}

/** Wewenang level Ad: hanya menilai creative (Spec §4.1 aturan 4). Level lain tidak difilter. */
export function applyLevel(d: Decision, c: Ctx): Decision {
  if (c.level !== 'ad') return d;
  switch (d.code) {
    case 'fix':
      return d.tag === 'CREATIVE' || d.tag === 'DELIVERY'
        ? { ...d, code: 'iterate_creative' }
        : { ...d, code: 'keep_creative' };
    case 'pause':
      return { code: c.confidence === 'tinggi' ? 'kill_creative' : 'test' };
    case 'test_limited':
      return { code: 'test' };
    case 'scale_aggr':
    case 'scale_step':
    case 'optimize':
      return { code: 'keep_creative' };
    default:
      return d;
  }
}
