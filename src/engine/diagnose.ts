import { PATHS, stagesFor } from '../config/meta/paths';
import { STATUS_ACTIONS } from '../config/meta/actions';
import { per } from '../lib/math';
import { applyLevel, decideBase, funnelOf } from './decide';
import { resolveEconomics, sanitizeEconomics, tierOf } from './economics';
import { scoreConfidence, scoreStage } from './funnel';
import { MIN_DAYS, checkTracking, sanitize, validate } from './gates';
import { narrate, pickActions } from './narrate';
import {
  FLAG, type Ctx, type Decision, type DiagnosisInput, type DiagnosisResult, type Kondisi, type Kpi, type ResolvedPreset,
  type StatusCode, type Tier,
} from './types';

function kondisiOf(code: StatusCode, tier?: Tier): Kondisi {
  switch (code) {
    case 'scale_aggr': return 'KUAT';
    case 'scale_step': return tier === 'winning' ? 'KUAT' : 'STABIL';
    case 'optimize': case 'test': case 'keep_creative': return 'STABIL';
    case 'fix': case 'test_limited': case 'tracking': case 'iterate_creative': return 'PERLU PERHATIAN';
    case 'pause': case 'kill_creative': return 'KRITIS';
    default: return 'NETRAL';
  }
}

const LABEL: Record<StatusCode, string> = {
  invalid: 'DATA BELUM VALID', tracking: 'CEK TRACKING DULU', early: 'TERLALU DINI', pause: 'PAUSE & ITERASI',
  kill_creative: 'MATIKAN CREATIVE', scale_aggr: 'SCALE AGRESIF', scale_step: 'SCALE BERTAHAP', optimize: 'OPTIMASI & PANTAU',
  fix: 'PERBAIKI', test_limited: 'LANJUT TES TERBATAS', test: 'LANJUT TES', keep_creative: 'PERTAHANKAN CREATIVE',
  iterate_creative: 'ITERASI CREATIVE',
};

function buildKpis(c: Ctx): Kpi[] {
  const { cfg, eco, primary, costValue, stages } = c;
  const head: Kpi[] = [
    { label: cfg.primaryLabel, value: primary, unit: 'num' },
    { label: cfg.costLabel, value: costValue, unit: 'rp' },
  ];
  const sv = (k: string) => stages.find((s) => s.key === k)?.value ?? null;
  if (cfg.economics === 'none') {
    const extra = stages.filter((s) => !['cpm', 'frequency', 'frequency_aware'].includes(s.key)).find((s) => s.value != null);
    return [
      ...head,
      { label: 'CPM', value: sv('cpm'), unit: 'rp' },
      { label: 'Frequency', value: sv('frequency') ?? sv('frequency_aware'), unit: 'x' },
      { label: extra?.label ?? 'CTR link', value: extra?.value ?? null, unit: extra?.unit ?? 'pct' },
    ];
  }
  const est = cfg.economics === 'sales' ? '' : 'Estimasi ';
  return [
    ...head,
    { label: `Break-even ${cfg.costLabel}`, value: eco?.ref ?? null, unit: 'rp', needsEconomics: !eco },
    { label: `${est}ROAS`, value: eco?.roas ?? null, unit: 'x', needsEconomics: !eco },
    { label: `${est}Profit setelah iklan`, value: eco?.profit ?? null, unit: 'rp', needsEconomics: !eco },
  ];
}

function invalid(errors: string[]): DiagnosisResult {
  return {
    code: 'invalid', label: LABEL.invalid, kondisi: 'NETRAL', confidence: null, kpis: [], stages: [],
    narrative: [], checkpoints: [], actions: STATUS_ACTIONS.invalid!, flags: [], errors,
  };
}

/** Diagnosis murni: input + preset → hasil. Tanpa side effect. */
export function diagnose(input: DiagnosisInput, preset: ResolvedPreset): DiagnosisResult {
  const cfg = PATHS[input.pathId];
  if (!cfg) return invalid(['Result path tidak dikenal.']);

  const m = sanitize(input.metrics, cfg, input.level);
  const economics = sanitizeEconomics(cfg, input.economics);
  const errors = validate(m, cfg, input.level, input.days, economics);
  if (errors.length) return invalid(errors);

  const eco = resolveEconomics(cfg, economics, m, preset);
  const primary = m[cfg.primary] ?? 0;
  const spend = m.spend as number;
  const costValue = per(spend, primary, cfg.costPer ?? 1);
  const c: Ctx = {
    cfg, level: input.level, days: input.days, m, eco, primary, costValue,
    stages: stagesFor(cfg, input.level, m).map((s) => scoreStage(s, m, preset.th, eco?.ref)),
    confidence: scoreConfidence(primary, cfg.confidenceScale),
    tier: eco && costValue != null ? tierOf(costValue, eco.ref) : undefined,
  };

  const flags: string[] = [];
  if (cfg.economics !== 'none' && !eco) flags.push(FLAG.ECONOMICS_MISSING);
  if (cfg.economics === 'lead' && eco?.defaultsUsed) flags.push(FLAG.LEAD_DEFAULTS);
  if (cfg.objective === 'traffic' || cfg.objective === 'engagement') flags.push(FLAG.OBJECTIVE);
  if (funnelOf(c).length === 0) flags.push(FLAG.NO_STAGE);

  const finish = (d: Decision, issues: string[] = []): DiagnosisResult => {
    if (d.code === 'keep_creative' && c.stages.some((s) => s.tag !== 'CREATIVE' && s.tag !== 'DELIVERY' && s.status === 'kritis')) {
      flags.push(FLAG.AD_CHECK_CAMPAIGN);
    }
    if (d.code === 'test' && c.tier && c.tier !== 'tipis' && c.tier !== 'rugi' && c.confidence === 'rendah') {
      flags.push(FLAG.WINNER_TIPIS);
    }
    const { narrative, checkpoints } = narrate(c, d, issues);
    return {
      code: d.code,
      label: d.code === 'fix' ? `PERBAIKI ${d.tag} DULU` : LABEL[d.code],
      kondisi: kondisiOf(d.code, c.tier),
      confidence: c.confidence,
      kpis: buildKpis(c), stages: c.stages,
      bottleneck: funnelOf(c).find((s) => s.status === 'kritis'),
      tier: c.tier, narrative, checkpoints, actions: pickActions(c, d), flags, errors: [],
    };
  };

  const tracking = checkTracking(m, cfg);
  if (tracking.length) return finish({ code: 'tracking' }, tracking);

  const target = eco?.targetCost;
  if (input.days < MIN_DAYS) return finish({ code: 'early' });
  if (target != null && spend < target) {
    // Level Ad: spend < 1× target berarti LANJUT TES, bukan TERLALU DINI (Spec §4.1 aturan 5).
    return finish({ code: input.level === 'ad' ? 'test' : 'early' });
  }
  if (target != null && primary === 0 && spend >= 3 * target) {
    return finish({ code: input.level === 'ad' ? 'kill_creative' : 'pause' });
  }
  return finish(applyLevel(decideBase(c), c));
}
