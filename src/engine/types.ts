export type Level = 'campaign' | 'adset' | 'ad';
export type Objective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'app' | 'sales';
export type StageStatus = 'sehat' | 'waspada' | 'kritis' | 'na';
export type Confidence = 'rendah' | 'sedang' | 'tinggi';
export type Tier = 'winning' | 'profitable' | 'tipis' | 'rugi';
export type Kondisi = 'KUAT' | 'STABIL' | 'PERLU PERHATIAN' | 'KRITIS' | 'NETRAL';
export type Unit = 'pct' | 'rp' | 'x' | 'num';
export type ConfidenceScale = 'purchase' | 'lead' | 'traffic' | 'engagement' | 'reach';
export type EconomicsKind = 'sales' | 'lead' | 'app' | 'none';

export type MetricKey =
  | 'spend' | 'impressions' | 'reach' | 'linkClicks' | 'lpv' | 'initiateCheckout' | 'addToCart'
  | 'purchases' | 'leads' | 'conversations' | 'calls' | 'installs' | 'appEvents'
  | 'engagements' | 'sharesSaves' | 'plays3s' | 'thruPlays';

export type Metrics = Partial<Record<MetricKey, number>>;

/** validRate & closeRate dalam persen (0-100). Kosong = pakai default preset. */
export interface Economics {
  price?: number; cost?: number; conversionValue?: number;
  dealValue?: number; dealCost?: number; validRate?: number; closeRate?: number;
  valuePerResult?: number;
}

export interface DiagnosisInput {
  pathId: string;
  level: Level;
  days: number;
  metrics: Metrics;
  economics?: Economics;
}

/** rel=true: sehat/kritis adalah pengali terhadap eco.ref (GP, CPL impas, nilai per hasil). */
export interface Th { sehat: number; kritis: number; dir: 'higher' | 'lower'; rel?: boolean }
export type ThMap = Record<string, Th>;
export interface ResolvedPreset { id: string; th: ThMap; validRate: number; closeRate: number }

export interface StageDef {
  key: string;
  label: string;
  unit: Unit;
  tag: string;
  compute: (m: Metrics) => number | null;
}

export interface PathConfig {
  id: string;
  platform: 'meta';
  objective: Objective;
  label: string;
  inputs: MetricKey[];
  optional: MetricKey[];
  stages: StageDef[];
  primary: MetricKey;
  primaryLabel: string;
  costLabel: string;
  /** cost per hasil dikali ini (Awareness: 1000). */
  costPer?: number;
  confidenceScale: ConfidenceScale;
  economics: EconomicsKind;
}

export interface StageResult {
  key: string;
  label: string;
  unit: Unit;
  tag: string;
  value: number | null;
  status: StageStatus;
  sehat?: number;
  kritis?: number;
  dir?: 'higher' | 'lower';
  /** 0 = di batas kritis, 1 = di batas sehat; dipakai memilih tahap terlemah. */
  score: number | null;
}

export interface Eco {
  kind: EconomicsKind;
  ref: number;
  targetCost: number;
  revenue: number;
  roas: number;
  profit: number;
  defaultsUsed: boolean;
}

export interface Kpi { label: string; value: number | null; unit: Unit; needsEconomics?: boolean }

export type StatusCode =
  | 'invalid' | 'tracking' | 'early' | 'pause' | 'kill_creative'
  | 'scale_aggr' | 'scale_step' | 'optimize' | 'fix'
  | 'test_limited' | 'test' | 'keep_creative' | 'iterate_creative';

export interface Decision { code: StatusCode; tag?: string; stage?: StageResult }

export interface Ctx {
  cfg: PathConfig;
  level: Level;
  days: number;
  m: Metrics;
  stages: StageResult[];
  eco: Eco | null;
  primary: number;
  confidence: Confidence;
  costValue: number | null;
  tier?: Tier;
}

export interface DiagnosisResult {
  code: StatusCode;
  label: string;
  kondisi: Kondisi;
  confidence: Confidence | null;
  kpis: Kpi[];
  stages: StageResult[];
  bottleneck?: StageResult;
  tier?: Tier;
  narrative: string[];
  checkpoints: string[];
  actions: { sekarang: string; jangan: string; tahan: string; berikutnya: string };
  flags: string[];
  errors: string[];
}

export const FLAG = {
  ECONOMICS_MISSING: 'economics belum diisi',
  LEAD_DEFAULTS: 'lead valid dan close rate memakai default preset',
  OBJECTIVE: 'objective ini mengoptimasi klik/interaksi, bukan penjualan; pindah ke Sales atau Leads bila tujuanmu closing',
  WINNER_TIPIS: 'kandidat winner, data masih tipis',
  AD_CHECK_CAMPAIGN: 'cek landing page/checkout di level Campaign',
  NO_STAGE: 'tidak ada tahap funnel yang bisa dinilai',
} as const;
