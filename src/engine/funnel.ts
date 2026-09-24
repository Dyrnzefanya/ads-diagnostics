import type { Confidence, ConfidenceScale, Metrics, StageDef, StageResult, StageStatus, ThMap } from './types';

export function scoreStage(def: StageDef, m: Metrics, th: ThMap, ref?: number): StageResult {
  const value = def.compute(m);
  const t = th[def.key];
  const base = { key: def.key, label: def.label, unit: def.unit, tag: def.tag, value };
  if (value == null || !t || (t.rel && ref == null)) return { ...base, status: 'na', score: null };

  const k = t.rel ? (ref as number) : 1;
  const sehat = t.sehat * k;
  const kritis = t.kritis * k;
  const hi = t.dir === 'higher';
  const status: StageStatus = hi
    ? value >= sehat ? 'sehat' : value < kritis ? 'kritis' : 'waspada'
    : value <= sehat ? 'sehat' : value > kritis ? 'kritis' : 'waspada';
  const span = hi ? sehat - kritis : kritis - sehat;
  const score = span === 0 ? (status === 'sehat' ? 1 : 0) : (hi ? value - kritis : kritis - value) / span;
  return { ...base, status, sehat, kritis, dir: t.dir, score };
}

const CONF: Record<ConfidenceScale, [number, number]> = {
  purchase: [5, 15],
  lead: [10, 30],
  traffic: [100, 300],
  engagement: [300, 1000],
  reach: [5000, 20000],
};

/** Jumlah hasil baru yang wajar sebelum checkpoint berikutnya. */
export const CHECK_VOLUME: Record<ConfidenceScale, number> = {
  purchase: 5, lead: 10, traffic: 100, engagement: 300, reach: 5000,
};

export function scoreConfidence(n: number, scale: ConfidenceScale): Confidence {
  const [mid, high] = CONF[scale];
  return n < mid ? 'rendah' : n < high ? 'sedang' : 'tinggi';
}

/** Tahap non-cost dengan skor terendah (paling dekat / melewati batas kritis). */
export function weakestStage(stages: StageResult[]): StageResult | undefined {
  return stages
    .filter((s) => s.key !== 'cost' && s.score != null)
    .reduce<StageResult | undefined>((w, s) => (w && (w.score as number) <= (s.score as number) ? w : s), undefined);
}
