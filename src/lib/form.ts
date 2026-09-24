import { fieldsFor, PATHS } from '../config/meta/paths';
import type { ThOverrides } from '../config/meta/thresholds';
import type { DiagnosisInput, Economics, Level, MetricKey } from '../engine/types';
import { parseID } from './format';

/** State form = string mentah dari input, supaya "1.250" atau "12," tidak rusak saat diketik. */
export interface FormState {
  pathId: string;
  level: Level;
  days: string;
  metrics: Partial<Record<MetricKey, string>>;
  eco: Partial<Record<keyof Economics, string>>;
  presetId: string;
  overrides: ThOverrides;
}

export const emptyForm = (): FormState => ({
  pathId: 'sales_website', level: 'campaign', days: '', metrics: {}, eco: {}, presetId: 'ecommerce', overrides: {},
});

const toStr = (n: number) => (Number.isFinite(n) ? String(n) : '').replace('.', ',');

export function fromInput(input: DiagnosisInput, presetId: string, overrides: ThOverrides): FormState {
  const strs = <T extends string>(o: Partial<Record<T, number>> | undefined) =>
    Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, toStr(v as number)])) as Partial<Record<T, string>>;
  return {
    pathId: input.pathId, level: input.level, days: toStr(input.days),
    metrics: strs<MetricKey>(input.metrics), eco: strs<keyof Economics>(input.economics), presetId, overrides,
  };
}

/** bad = id field yang isinya tidak bisa dibaca sebagai angka (kosong bukan bad). */
export function parseForm(f: FormState): { input: DiagnosisInput; bad: string[] } {
  const bad: string[] = [];
  const num = (s: string | undefined, id: string): number | undefined => {
    if (s == null || s.trim() === '') return undefined;
    const n = parseID(s);
    if (n == null) bad.push(id);
    return n ?? undefined;
  };
  const metrics: DiagnosisInput['metrics'] = {};
  for (const [k, v] of Object.entries(f.metrics) as [MetricKey, string][]) {
    const n = num(v, k);
    if (n != null) metrics[k] = n;
  }
  const economics: Economics = {};
  for (const [k, v] of Object.entries(f.eco) as [keyof Economics, string][]) {
    const n = num(v, k);
    if (n != null) economics[k] = n;
  }
  const days = num(f.days, 'days');
  return {
    input: { pathId: f.pathId, level: f.level, days: days ?? NaN, metrics, economics: Object.keys(economics).length ? economics : undefined },
    bad,
  };
}

/** Field wajib (termasuk hari berjalan) yang masih kosong. */
export function missingRequired(f: FormState): string[] {
  const cfg = Object.hasOwn(PATHS, f.pathId) ? PATHS[f.pathId] : undefined;
  if (!cfg) return ['pathId'];
  const empty = (s?: string) => s == null || s.trim() === '';
  const missing = fieldsFor(cfg, f.level).required.filter((k) => empty(f.metrics[k]));
  return empty(f.days) ? ['days', ...missing] : missing;
}
