import { per } from '../../lib/math';
import type { Level, Metrics, MetricKey, Objective, PathConfig, StageDef, Unit } from '../../engine/types';
import { GLOBAL_FIELDS } from './metrics';

const st = (key: string, label: string, unit: Unit, tag: string, compute: StageDef['compute']): StageDef =>
  ({ key, label, unit, tag, compute });

const S = {
  cpm: st('cpm', 'CPM', 'rp', 'DELIVERY', (m) => per(m.spend, m.impressions, 1000)),
  frequency: st('frequency', 'Frequency', 'x', 'DELIVERY', (m) => per(m.impressions, m.reach)),
  frequencyAware: st('frequency_aware', 'Frequency', 'x', 'DELIVERY', (m) => per(m.impressions, m.reach)),
  ctr: st('ctr', 'CTR link', 'pct', 'CREATIVE', (m) => per(m.linkClicks, m.impressions, 100)),
  cpc: st('cpc', 'CPC link', 'rp', 'CREATIVE', (m) => per(m.spend, m.linkClicks)),
  lpvRate: st('lpv_rate', 'LPV rate', 'pct', 'LANDING PAGE', (m) => per(m.lpv, m.linkClicks, 100)),
  lpConversion: st('lp_conversion', 'LP conversion', 'pct', 'LANDING PAGE', (m) => per(m.initiateCheckout, m.lpv, 100)),
  checkout: st('checkout_completion', 'Checkout completion', 'pct', 'CHECKOUT', (m) => per(m.purchases, m.initiateCheckout, 100)),
  hook: st('hook_rate', 'Hook rate', 'pct', 'CREATIVE', (m) => per(m.plays3s, m.impressions, 100)),
  hold: st('hold_rate', 'Hold rate', 'pct', 'CREATIVE', (m) => per(m.thruPlays, m.plays3s, 100)),
  engRate: st('engagement_rate', 'Engagement rate', 'pct', 'CREATIVE', (m) => per(m.engagements, m.reach, 100)),
  shareSave: st('share_save_rate', 'Share/save rate', 'pct', 'CREATIVE', (m) => per(m.sharesSaves, m.engagements, 100)),
  clickToChat: st('click_to_chat', 'Click-to-chat', 'pct', 'FOLLOW-UP CHAT', (m) => per(m.conversations, m.linkClicks, 100)),
  clickToCall: st('click_to_call', 'Click-to-call', 'pct', 'TOMBOL TELEPON', (m) => per(m.calls, m.linkClicks, 100)),
  formCvr: st('form_cvr', 'Form CVR', 'pct', 'FORM', (m) => per(m.leads, m.linkClicks, 100)),
  leadCvr: st('lead_cvr', 'Lead CVR', 'pct', 'LANDING PAGE', (m) => per(m.leads, m.lpv, 100)),
  clickToAtc: st('click_to_atc', 'Click → ATC', 'pct', 'LANDING PAGE', (m) => per(m.addToCart, m.linkClicks, 100)),
  atcToPurchase: st('atc_to_purchase', 'ATC → Purchase', 'pct', 'CHECKOUT', (m) => per(m.purchases, m.addToCart, 100)),
  clickToInstall: st('click_to_install', 'Click → Install', 'pct', 'HALAMAN APP', (m) => per(m.installs, m.linkClicks, 100)),
  installToEvent: st('install_to_event', 'Install → Event', 'pct', 'ONBOARDING APP', (m) => per(m.appEvents, m.installs, 100)),
  cost: (primary: MetricKey, label: string) =>
    st('cost', label, 'rp', 'OFFER & HARGA', (m) => per(m.spend, m[primary])),
};

type Def = Omit<PathConfig, 'platform' | 'optional'> & { optional?: MetricKey[] };
const def = (d: Def): PathConfig => ({ platform: 'meta', optional: [], ...d });

const REACH: MetricKey[] = ['reach'];

export const PATH_LIST: PathConfig[] = [
  def({
    id: 'awareness_reach', objective: 'awareness', label: 'Reach / Brand Awareness',
    inputs: ['reach'], optional: ['plays3s', 'thruPlays'],
    stages: [S.cpm, S.frequencyAware, S.hook, S.hold],
    primary: 'reach', primaryLabel: 'Reach', costLabel: 'Biaya per 1.000 reach', costPer: 1000,
    confidenceScale: 'reach', economics: 'none',
  }),
  def({
    id: 'traffic_lp', objective: 'traffic', label: 'Website / Landing Page',
    inputs: ['reach', 'linkClicks', 'lpv'],
    stages: [S.cpm, S.frequency, S.ctr, S.cpc, S.lpvRate],
    primary: 'lpv', primaryLabel: 'LPV', costLabel: 'Biaya per LPV',
    confidenceScale: 'traffic', economics: 'none',
  }),
  def({
    id: 'engagement_post', objective: 'engagement', label: 'Post Engagement',
    inputs: ['reach', 'engagements', 'sharesSaves'],
    stages: [S.cpm, S.frequency, S.engRate, S.shareSave],
    primary: 'engagements', primaryLabel: 'Engagement', costLabel: 'Biaya per engagement',
    confidenceScale: 'engagement', economics: 'none',
  }),
  def({
    id: 'engagement_video', objective: 'engagement', label: 'Video Engagement',
    inputs: ['reach', 'plays3s', 'thruPlays'],
    stages: [S.cpm, S.frequency, S.hook, S.hold],
    primary: 'thruPlays', primaryLabel: 'ThruPlay', costLabel: 'Biaya per ThruPlay',
    confidenceScale: 'engagement', economics: 'none',
  }),
  def({
    id: 'engagement_messaging', objective: 'engagement', label: 'Messaging Conversations',
    inputs: ['linkClicks', 'conversations'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToChat, S.cost('conversations', 'Biaya per chat')],
    primary: 'conversations', primaryLabel: 'Chat', costLabel: 'Biaya per chat',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'leads_instant', objective: 'leads', label: 'Instant Form',
    inputs: ['linkClicks', 'leads'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.formCvr, S.cost('leads', 'CPL')],
    primary: 'leads', primaryLabel: 'Lead', costLabel: 'CPL',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'leads_website', objective: 'leads', label: 'Website Leads',
    inputs: ['linkClicks', 'lpv', 'leads'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.lpvRate, S.leadCvr, S.cost('leads', 'CPL')],
    primary: 'leads', primaryLabel: 'Lead', costLabel: 'CPL',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'leads_whatsapp', objective: 'leads', label: 'WhatsApp / Messaging',
    inputs: ['linkClicks', 'conversations'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToChat, S.cost('conversations', 'Biaya per chat')],
    primary: 'conversations', primaryLabel: 'Chat', costLabel: 'Biaya per chat',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'leads_calls', objective: 'leads', label: 'Calls',
    inputs: ['linkClicks', 'calls'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToCall, S.cost('calls', 'Biaya per call')],
    primary: 'calls', primaryLabel: 'Call', costLabel: 'Biaya per call',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'app_installs', objective: 'app', label: 'App Installs',
    inputs: ['linkClicks', 'installs'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToInstall, S.cost('installs', 'CPI')],
    primary: 'installs', primaryLabel: 'Install', costLabel: 'CPI',
    confidenceScale: 'lead', economics: 'app',
  }),
  def({
    id: 'app_events', objective: 'app', label: 'App Events',
    inputs: ['linkClicks', 'installs', 'appEvents'], optional: REACH,
    stages: [S.frequency, S.ctr, S.clickToInstall, S.installToEvent, S.cost('appEvents', 'Biaya per event')],
    primary: 'appEvents', primaryLabel: 'Event', costLabel: 'Biaya per event',
    confidenceScale: 'purchase', economics: 'app',
  }),
  def({
    id: 'sales_website', objective: 'sales', label: 'Website Purchase',
    inputs: ['linkClicks', 'lpv', 'initiateCheckout', 'purchases'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.lpvRate, S.lpConversion, S.checkout, S.cost('purchases', 'CPA')],
    primary: 'purchases', primaryLabel: 'Purchase', costLabel: 'CPA',
    confidenceScale: 'purchase', economics: 'sales',
  }),
  def({
    id: 'sales_catalog', objective: 'sales', label: 'Catalog / Shop Purchase',
    inputs: ['linkClicks', 'addToCart', 'purchases'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToAtc, S.atcToPurchase, S.cost('purchases', 'CPA')],
    primary: 'purchases', primaryLabel: 'Purchase', costLabel: 'CPA',
    confidenceScale: 'purchase', economics: 'sales',
  }),
  def({
    id: 'sales_ctwa', objective: 'sales', label: 'WhatsApp (CTWA) Sales',
    inputs: ['linkClicks', 'conversations'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToChat, S.cost('conversations', 'Biaya per chat')],
    primary: 'conversations', primaryLabel: 'Chat', costLabel: 'Biaya per chat',
    confidenceScale: 'lead', economics: 'lead',
  }),
];

export const PATHS: Record<string, PathConfig> = Object.fromEntries(PATH_LIST.map((p) => [p.id, p]));

export const OBJECTIVES: { id: Objective; label: string }[] = [
  { id: 'awareness', label: 'Awareness' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'leads', label: 'Leads' },
  { id: 'app', label: 'App Promotion' },
  { id: 'sales', label: 'Sales' },
];

export const LEVELS: { id: Level; label: string }[] = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'adset', label: 'Ad Set' },
  { id: 'ad', label: 'Ad' },
];

/** Field wajib/opsional per path × level. Ad Set: reach wajib. Ad: 3s plays & ThruPlays opsional. */
export function fieldsFor(cfg: PathConfig, level: Level): { required: MetricKey[]; optional: MetricKey[] } {
  const required: MetricKey[] = [...GLOBAL_FIELDS, ...cfg.inputs];
  let optional = [...cfg.optional];
  if (level === 'adset' && !required.includes('reach')) {
    required.push('reach');
    optional = optional.filter((k) => k !== 'reach');
  }
  if (level === 'ad') {
    for (const k of ['plays3s', 'thruPlays'] as const) {
      if (!required.includes(k) && !optional.includes(k)) optional.push(k);
    }
  }
  return { required, optional };
}

/** Stage path + (level Ad, data video diisi) hook/hold setelah CTR. */
export function stagesFor(cfg: PathConfig, level: Level, m: Metrics): StageDef[] {
  if (level !== 'ad' || m.plays3s == null || cfg.stages.some((s) => s.key === 'hook_rate')) return cfg.stages;
  const extra = m.thruPlays != null ? [S.hook, S.hold] : [S.hook];
  const after = (key: string) => cfg.stages.findIndex((s) => s.key === key) + 1;
  const at = after('ctr') || after('cpm');
  return [...cfg.stages.slice(0, at), ...extra, ...cfg.stages.slice(at)];
}
