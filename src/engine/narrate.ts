import { STAGE_FIX, STATUS_ACTIONS, type Actions } from '../config/meta/actions';
import { fmtNum, fmtRp, fmtUnit } from '../lib/format';
import { CHECK_VOLUME, weakestStage } from './funnel';
import { funnelOf } from './decide';
import type { Ctx, Decision, StageResult, StatusCode, Tier } from './types';

const OPEN: Record<StatusCode, string> = {
  invalid: 'Angka yang diisi belum konsisten, jadi diagnosis belum bisa dibuat.',
  tracking: 'Ada sinyal tracking yang tidak wajar; jangan menilai creative atau audience sebelum ini beres.',
  early: 'Data belum cukup umur untuk disimpulkan.',
  pause: 'Biaya sudah keluar tanpa hasil yang sepadan; hentikan dan iterasi.',
  kill_creative: 'Creative ini tidak menghasilkan sepadan dengan biayanya; matikan dan ganti.',
  scale_aggr: 'Semua sinyal kuat: aman scale agresif, dengan kenaikan bertahap harian.',
  scale_step: 'Sinyal cukup baik untuk scale bertahap; jangan terburu-buru.',
  optimize: 'Belum ada titik yang patah, tetapi masih ada yang perlu dipantau atau dilengkapi.',
  fix: 'Belum aman untuk scale; ada satu titik yang perlu dibereskan dulu.',
  test_limited: 'Biaya per hasil di atas batas impas, tetapi datanya masih tipis; lanjutkan tes terbatas.',
  test: 'Data belum cukup untuk memutuskan; lanjutkan tes tanpa perubahan besar.',
  keep_creative: 'Creative ini bekerja; pertahankan.',
  iterate_creative: 'Creative ini perlu iterasi; ganti hook dulu, body tetap.',
};

const LEVEL_TEXT = {
  campaign: 'Di level Campaign, angka ini gabungan semua ad set, jadi belum menunjuk satu creative.',
  adset: 'Di level Ad Set, yang dinilai adalah audience dan delivery; kejenuhan audience dibaca dari frequency.',
  ad: 'Di level Ad, yang dinilai hanya creative; masalah landing page atau checkout tidak disimpulkan dari satu ad.',
};

const CONF_TEXT = {
  rendah: 'masih noise: cukup untuk mengamati, belum untuk memutuskan',
  sedang: 'cukup untuk arah, belum cukup untuk memastikan winner',
  tinggi: 'cukup kuat untuk dijadikan dasar keputusan',
};

const TIER_TEXT: Record<Tier, string> = {
  winning: 'di bawah target akuisisi (33%)',
  profitable: 'untung, tetapi di atas target 33%',
  tipis: 'mendekati impas, perlu perbaikan',
  rugi: 'di atas impas: tiap hasil merugi setelah iklan',
};

const limit = (s: StageResult) =>
  s.status === 'na' ? '' : `(sehat ${s.dir === 'higher' ? '≥' : '≤'} ${fmtUnit(s.sehat, s.unit)}, kritis ${s.dir === 'higher' ? '<' : '>'} ${fmtUnit(s.kritis, s.unit)})`;

export function narrate(c: Ctx, d: Decision, issues: string[] = []): { narrative: string[]; checkpoints: string[] } {
  const f = funnelOf(c);
  const kritis = f.find((s) => s.status === 'kritis');
  const waspada = f.filter((s) => s.status === 'waspada');
  const open = d.code === 'fix' ? `Belum aman untuk scale; ${d.tag?.toLowerCase()} perlu dibereskan dulu.` : OPEN[d.code];

  const narrative = [open, ...issues];
  if (kritis) {
    narrative.push(`${kritis.label} ${fmtUnit(kritis.value, kritis.unit)} melewati batas kritis ${fmtUnit(kritis.kritis, kritis.unit)}: ini titik pertama yang patah di funnel.`);
    if (waspada.length) narrative.push(`Tahap lain yang perlu dipantau: ${waspada.map((s) => s.label).join(', ')}.`);
  } else if (waspada.length) {
    narrative.push(`Tidak ada tahap kritis; yang perlu dipantau: ${waspada.map((s) => s.label).join(', ')}.`);
  } else if (f.length) {
    narrative.push('Semua tahap funnel yang bisa dinilai berada di zona sehat.');
  }
  if (c.eco && c.tier && c.costValue != null) {
    narrative.push(`${c.cfg.costLabel} ${fmtRp(c.costValue)} berada di ${fmtNum((c.costValue / c.eco.ref) * 100)}% dari batas impas (${fmtRp(c.eco.ref)}): ${TIER_TEXT[c.tier]}.`);
  } else if (c.cfg.economics !== 'none') {
    narrative.push('Economics belum diisi, jadi biaya per hasil belum bisa dinilai untung atau rugi.');
  }
  narrative.push(LEVEL_TEXT[c.level]);
  narrative.push(`Keyakinan ${c.confidence}: ${fmtNum(c.primary)} ${c.cfg.primaryLabel.toLowerCase()} ${CONF_TEXT[c.confidence]}.`);

  const focus = kritis ?? weakestStage(f) ?? f[0];
  const checkpoints = [
    `Spend ${fmtRp(c.m.spend ?? 0)} · ${c.days} hari · ${fmtNum(c.primary)} ${c.cfg.primaryLabel.toLowerCase()}`,
    focus ? `${focus.label} ${fmtUnit(focus.value, focus.unit)} ${limit(focus)}` : 'Belum ada tahap funnel yang bisa dinilai.',
    c.eco && c.costValue != null
      ? `${c.cfg.costLabel} ${fmtRp(c.costValue)} vs batas impas ${fmtRp(c.eco.ref)} (${c.tier ? c.tier.toUpperCase() : '-'})`
      : c.cfg.economics === 'none' ? `CPM ${fmtUnit(c.stages.find((s) => s.key === 'cpm')?.value, 'rp')}` : 'Economics belum diisi.',
  ];
  return { narrative, checkpoints };
}

/** Aksi: status tetap dari STATUS_ACTIONS; "fix" dirakit dari pustaka bottleneck + batas tahap. */
export function pickActions(c: Ctx, d: Decision): Actions {
  if (d.code !== 'fix') return STATUS_ACTIONS[d.code] as Actions;
  const [sekarang, jangan] = STAGE_FIX[d.stage?.key ?? 'cost'];
  const s = d.stage;
  const vol = `${fmtNum(CHECK_VOLUME[c.cfg.confidenceScale])} ${c.cfg.primaryLabel.toLowerCase()}`;
  return {
    sekarang,
    jangan,
    tahan: s ? `Jangan naikkan budget sampai ${s.label} ${s.dir === 'higher' ? '≥' : '≤'} ${fmtUnit(s.sehat, s.unit)}.` : 'Jangan naikkan budget sampai biaya per hasil di bawah batas impas.',
    berikutnya: s
      ? `Setelah ±${vol} tambahan atau 3 hari, ${s.label} keluar dari zona kritis (${s.dir === 'higher' ? 'minimal' : 'maksimal'} ${fmtUnit(s.kritis, s.unit)}).`
      : `Setelah ±${vol} tambahan atau 3 hari, cek ulang ${c.cfg.costLabel}.`,
  };
}
