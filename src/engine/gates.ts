import { METRICS } from '../config/meta/metrics';
import { fieldsFor } from '../config/meta/paths';
import type { Economics, Level, Metrics, MetricKey, PathConfig } from './types';
import { validateEconomics } from './economics';

export const MIN_DAYS = 3;

/** Buang metrik yang bukan milik path × level ini. */
export function sanitize(m: Metrics, cfg: PathConfig, level: Level): Metrics {
  const { required, optional } = fieldsFor(cfg, level);
  const out: Metrics = {};
  for (const k of [...required, ...optional]) if (m[k] != null) out[k] = m[k];
  return out;
}

/** Gerbang 0: field wajib, angka masuk akal, dan hubungan antar-metrik yang mustahil. */
export function validate(m: Metrics, cfg: PathConfig, level: Level, days: number, eco?: Economics): string[] {
  const errs: string[] = [];
  const { required } = fieldsFor(cfg, level);
  for (const k of required) {
    if (m[k] == null || !Number.isFinite(m[k])) errs.push(`${METRICS[k].label} wajib diisi.`);
  }
  for (const [k, v] of Object.entries(m) as [MetricKey, number][]) {
    if (!Number.isFinite(v) || v < 0) errs.push(`${METRICS[k].label} tidak boleh negatif.`);
  }
  if (!Number.isFinite(days) || days < 0) errs.push('Hari berjalan wajib diisi (0 atau lebih).');
  errs.push(...validateEconomics(eco));
  if (errs.length) return errs;

  if ((m.spend as number) <= 0) errs.push('Ad Spend harus lebih dari 0.');
  if ((m.impressions as number) <= 0) errs.push('Impressions harus lebih dari 0.');
  const over = (a: MetricKey, b: MetricKey, tol: number, msg: string) => {
    if (m[a] != null && m[b] != null && (m[a] as number) > (m[b] as number) * tol) errs.push(msg);
  };
  over('reach', 'impressions', 1, 'Reach tidak mungkin melebihi Impressions.');
  over('linkClicks', 'impressions', 1, 'Link Clicks tidak mungkin melebihi Impressions.');
  over('plays3s', 'impressions', 1, '3-sec Video Plays tidak mungkin melebihi Impressions.');
  over('lpv', 'linkClicks', 1.1, 'LPV tidak mungkin melebihi Link Clicks lebih dari 10%.');
  over('thruPlays', 'plays3s', 1.1, 'ThruPlays tidak mungkin melebihi 3-sec Video Plays lebih dari 10%.');
  over('purchases', 'initiateCheckout', 1.2, 'Purchases tidak mungkin melebihi Initiate Checkout lebih dari 20%.');
  over('purchases', 'addToCart', 1.2, 'Purchases tidak mungkin melebihi Add to Cart lebih dari 20%.');
  return errs;
}

/** Gerbang 1: pola yang hampir pasti masalah pixel/event, bukan performa. */
export function checkTracking(m: Metrics, cfg: PathConfig): string[] {
  const out: string[] = [];
  const clicks = m.linkClicks ?? 0;
  if (cfg.inputs.includes('lpv') && m.lpv != null && clicks >= 50) {
    if (m.lpv === 0) out.push('Link Clicks ≥ 50 tetapi LPV = 0: pixel tidak jalan atau halaman gagal dimuat.');
    else if (m.lpv / clicks < 0.4) out.push('LPV rate di bawah 40%: halaman lambat atau pixel dobel/hilang.');
  }
  if (m.initiateCheckout != null && m.initiateCheckout >= 10 && m.purchases === 0) {
    out.push('Initiate Checkout ≥ 10 tetapi Purchase = 0: event Purchase tidak terpasang atau pembayaran gagal.');
  }
  if (cfg.inputs.includes('conversations') && clicks >= 50 && m.conversations === 0) {
    out.push('Link Clicks ≥ 50 tetapi chat = 0: tombol WhatsApp/Messenger tidak berfungsi atau event tidak terkirim.');
  }
  return out;
}
