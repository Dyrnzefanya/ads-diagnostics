import type { Metadata } from 'next';
import { METRICS } from '@/config/meta/metrics';
import { PATH_LIST } from '@/config/meta/paths';
import { BASE_TH } from '@/config/meta/thresholds';
import { fmtNum } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Panduan — Meta Ads Diagnostic',
  description: 'Cara mengambil angka di Ads Manager, arti tiap status keputusan, dan batas sehat/kritis yang dipakai.',
};

const STATUSES: [string, string][] = [
  ['DATA BELUM VALID', 'Ada angka yang mustahil (mis. LPV lebih besar dari klik). Periksa ulang sebelum apa pun.'],
  ['CEK TRACKING DULU', 'Polanya khas masalah pixel/event, bukan performa. Perbaiki pengukuran sebelum menilai iklan.'],
  ['TERLALU DINI', 'Kurang dari 3 hari atau spend belum mencapai 1× target biaya per hasil. Jangan ubah apa pun.'],
  ['SCALE AGRESIF / BERTAHAP', 'Semua tahap sehat dan biaya di bawah target. Naikkan budget 20–30% (agresif) atau 10–20% (bertahap) per hari.'],
  ['OPTIMASI & PANTAU', 'Tidak ada tahap kritis, tetapi ada yang waspada atau economics belum diisi. Pertahankan budget.'],
  ['PERBAIKI [TAHAP] DULU', 'Ada satu tahap funnel yang patah (creative, landing page, checkout, follow-up chat, delivery). Perbaiki itu, bukan yang lain.'],
  ['PAUSE & ITERASI', 'Biaya per hasil di atas batas impas dengan data cukup, atau spend ≥ 3× target tanpa hasil.'],
  ['LANJUT TES (TERBATAS)', 'Data masih tipis untuk vonis. Lanjutkan tanpa perubahan besar.'],
  ['PERTAHANKAN / ITERASI / MATIKAN CREATIVE', 'Status untuk level Ad: hanya menilai creative, tidak pernah memutuskan scale.'],
];

const th = 'px-3 py-2 text-left text-xs font-semibold text-dim';
const td = 'px-3 py-2 align-top text-sm';

export default function Page() {
  const stageLabels = new Map<string, string>();
  for (const p of PATH_LIST) for (const s of p.stages) stageLabels.set(s.key, s.label);
  return (
    <main className="mx-auto max-w-3xl space-y-12 px-4 py-8">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Panduan</h1>
        <p className="mt-1 text-dim">Cara mengambil angka, membaca status, dan batas yang dipakai.</p>
      </header>

      <section aria-labelledby="h-angka">
        <h2 id="h-angka" className="mb-3 text-xl font-bold">Mengambil angka di Ads Manager</h2>
        <p className="mb-4 text-sm text-dim">Pakai rentang tanggal dan level (Campaign / Ad Set / Ad) yang sama untuk semua angka. Tambahkan kolom yang belum tampil lewat Customize columns.</p>
        <dl className="divide-y divide-line rounded-xl border border-line bg-panel">
          {Object.values(METRICS).map((m) => (
            <div key={m.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr]">
              <dt className="font-medium">{m.label}</dt>
              <dd className="text-sm text-dim">{m.hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="h-status">
        <h2 id="h-status" className="mb-3 text-xl font-bold">Arti tiap status</h2>
        <dl className="divide-y divide-line rounded-xl border border-line bg-panel">
          {STATUSES.map(([s, d]) => (
            <div key={s} className="px-4 py-3">
              <dt className="font-semibold">{s}</dt>
              <dd className="mt-1 text-sm text-dim">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="h-batas">
        <h2 id="h-batas" className="mb-3 text-xl font-bold">Batas sehat dan kritis (default)</h2>
        <p className="mb-4 text-sm text-dim">
          Nilai di antara batas sehat dan kritis berstatus waspada. Batas biaya berupa pengali terhadap batas impas (gross profit per penjualan).
          Banyak batas adalah titik awal perkiraan pasar Indonesia, bukan data terverifikasi; kalibrasi dengan datamu di Pengaturan lanjutan.
        </p>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[28rem]">
            <thead className="border-b border-line"><tr><th className={th}>Tahap</th><th className={th}>Sehat</th><th className={th}>Kritis</th></tr></thead>
            <tbody className="divide-y divide-line">
              {Object.entries(BASE_TH).map(([k, t]) => (
                <tr key={k}>
                  <td className={td}>{k === 'cost' ? 'Biaya per hasil (CPA/CPL)' : stageLabels.get(k) ?? k}</td>
                  <td className={`${td} tabular-nums`}>{t.dir === 'higher' ? '≥' : '≤'} {fmtNum(t.sehat, 2)}{t.rel ? '× impas' : ''}</td>
                  <td className={`${td} tabular-nums`}>{t.dir === 'higher' ? '<' : '>'} {fmtNum(t.kritis, 2)}{t.rel ? '× impas' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
