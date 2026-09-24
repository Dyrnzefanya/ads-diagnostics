import type { ResolvedPreset, Th, ThMap } from '../../engine/types';

/**
 * Sumber: FW = materi Jordan (Framework 7-8, blueprint, Ads Calculator); Default = titik awal
 * perkiraan pasar Indonesia, WAJIB dikalibrasi dari data beta.
 * Bertanda [baru] = tidak ada di Dok Planning, ditambahkan agar tahapnya bisa dinilai.
 * rel=true → pengali terhadap eco.ref (GP / CPL impas / nilai per hasil).
 */
export const BASE_TH: ThMap = {
  cpm: { sehat: 40000, kritis: 100000, dir: 'lower' },
  frequency: { sehat: 2.5, kritis: 4, dir: 'lower' },
  frequency_aware: { sehat: 3, kritis: 5, dir: 'lower' },
  ctr: { sehat: 1.2, kritis: 0.7, dir: 'higher' },
  cpc: { sehat: 0.01, kritis: 0.02, dir: 'lower', rel: true }, // FW: CPC max 1% GP
  lpv_rate: { sehat: 75, kritis: 50, dir: 'higher' }, // FW
  lp_conversion: { sehat: 20, kritis: 15, dir: 'higher' }, // FW
  checkout_completion: { sehat: 25, kritis: 12, dir: 'higher' },
  hook_rate: { sehat: 30, kritis: 20, dir: 'higher' },
  hold_rate: { sehat: 25, kritis: 15, dir: 'higher' },
  engagement_rate: { sehat: 3, kritis: 1, dir: 'higher' },
  share_save_rate: { sehat: 10, kritis: 3, dir: 'higher' }, // [baru]
  click_to_chat: { sehat: 60, kritis: 40, dir: 'higher' },
  click_to_call: { sehat: 40, kritis: 20, dir: 'higher' }, // [baru]
  form_cvr: { sehat: 15, kritis: 8, dir: 'higher' },
  lead_cvr: { sehat: 15, kritis: 7, dir: 'higher' },
  click_to_atc: { sehat: 8, kritis: 4, dir: 'higher' },
  atc_to_purchase: { sehat: 25, kritis: 10, dir: 'higher' },
  click_to_install: { sehat: 20, kritis: 10, dir: 'higher' },
  install_to_event: { sehat: 20, kritis: 8, dir: 'higher' }, // [baru]
  cost: { sehat: 0.33, kritis: 1, dir: 'lower', rel: true }, // FW: target 33% GP, impas 100%
};

export interface Preset {
  id: string;
  label: string;
  desc: string;
  overrides: Record<string, Partial<Pick<Th, 'sehat' | 'kritis'>>>;
  validRate: number;
  closeRate: number;
}

export const PRESETS: Preset[] = [
  { id: 'ecommerce', label: 'E-commerce / produk fisik', desc: 'Nilai default.', overrides: {}, validRate: 70, closeRate: 7 },
  {
    id: 'digital', label: 'Digital product', desc: 'LP conversion sehat ≥ 24%, checkout completion sehat ≥ 40%.',
    overrides: { lp_conversion: { sehat: 24 }, checkout_completion: { sehat: 40 } }, validRate: 70, closeRate: 7,
  },
  {
    id: 'b2b', label: 'Lead gen B2B / high-ticket', desc: 'CTR lebih rendah, CPM sehat ≤ Rp70.000, lead valid 30%, close rate 40%.',
    overrides: { ctr: { sehat: 0.8, kritis: 0.4 }, cpm: { sehat: 70000 } }, validRate: 30, closeRate: 40,
  },
  {
    id: 'lokal', label: 'Jasa lokal (CTWA/Calls)', desc: 'Click-to-chat sehat ≥ 50%, frequency kritis > 5 (audience sempit).',
    overrides: { click_to_chat: { sehat: 50 }, frequency: { kritis: 5 } }, validRate: 70, closeRate: 7,
  },
  { id: 'app', label: 'App', desc: 'Memakai default; confidence sudah berbasis jumlah install/event.', overrides: {}, validRate: 70, closeRate: 7 },
];

export type ThOverrides = Record<string, Partial<Pick<Th, 'sehat' | 'kritis'>>>;

export function resolvePreset(id: string, user: ThOverrides = {}): ResolvedPreset {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  const th: ThMap = {};
  for (const k of Object.keys(BASE_TH)) th[k] = { ...BASE_TH[k], ...p.overrides[k], ...user[k] };
  return { id: p.id, th, validRate: p.validRate, closeRate: p.closeRate };
}
