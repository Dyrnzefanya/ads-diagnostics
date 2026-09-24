import Link from 'next/link';
import { SAMPLES } from '@/config/meta/samples';
import { resolvePreset } from '@/config/meta/thresholds';
import { ResultView } from '@/components/ResultView';
import { diagnose } from '@/engine/diagnose';

const cta = 'inline-block rounded-xl bg-teal px-6 py-3.5 text-base font-bold text-navy hover:brightness-110';

const STEPS = [
  ['Pilih konteks', 'Objective, hasil yang dikejar, dan level (Campaign, Ad Set, atau Ad). Form menyesuaikan diri.'],
  ['Isi angka mentah', 'Spend, impressions, klik, dan hasil dari Ads Manager. Rasio dihitung otomatis, jadi tidak ada angka yang saling bertentangan.'],
  ['Baca keputusan', 'Satu status tegas, funnel per tahap, dan aksi: Sekarang, Jangan, Tahan sampai, Checkpoint berikutnya.'],
];

const REASONS = [
  ['Pause terlalu cepat', 'Data belum cukup, tetapi iklan sudah dimatikan.'],
  ['Scale terlalu cepat', 'Satu hari bagus, budget langsung dinaikkan, hasilnya ambruk.'],
  ['Menyalahkan creative', 'Masalahnya ada di landing page, checkout, atau follow-up chat.'],
];

export default function Home() {
  // Contoh hasil nyata dari engine yang sama (dirender saat build).
  const demo = diagnose(SAMPLES[1].input, resolvePreset('ecommerce'));
  return (
    <main>
      <section className="mx-auto max-w-3xl px-4 pb-12 pt-14 text-center sm:pt-20">
        <p className="mb-4 text-sm font-semibold text-teal">Diagnosis Meta Ads sampai closing</p>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Angkamu benar. <span className="text-teal">Bacaannya yang sering salah.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-dim">
          Isi beberapa angka dari Ads Manager, dapatkan satu keputusan tegas: scale, perbaiki, atau pause. Lengkap dengan urutan tindakannya.
        </p>
        <div className="mt-8"><Link href="/diagnosis/" className={cta}>Mulai Diagnosis</Link></div>
        <p className="mt-3 text-sm text-dim">Gratis · tanpa login · angkamu tidak dikirim ke server</p>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10" aria-labelledby="h-masalah">
        <h2 id="h-masalah" className="mb-6 text-2xl font-bold">Tiga kesalahan yang paling mahal</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {REASONS.map(([t, d]) => (
            <li key={t} className="rounded-xl border border-line bg-panel p-4">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-dim">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10" aria-labelledby="h-contoh">
        <h2 id="h-contoh" className="mb-2 text-2xl font-bold">Contoh hasil</h2>
        <p className="mb-6 text-dim">Website Purchase, Campaign: 6 purchase, CPA 56% dari gross profit. Kebanyakan orang akan langsung scale. Tool ini menunjuk landing page.</p>
        <ResultView r={demo} levelLabel="Campaign" />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10" aria-labelledby="h-cara">
        <h2 id="h-cara" className="mb-6 text-2xl font-bold">Cara kerja, 3 langkah</h2>
        <ol className="space-y-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-xl border border-line bg-panel p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/15 font-bold text-teal">{i + 1}</span>
              <div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-dim">{d}</p></div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-dim">
          14 jalur hasil termasuk WhatsApp (CTWA) Sales, break-even sampai deal untuk Leads/WA, threshold per industri, dan link hasil yang bisa dikirim ke klien.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 pt-6 text-center">
        <Link href="/diagnosis/" className={cta}>Mulai Diagnosis</Link>
        <p className="mt-6 text-sm text-dim">
          Butuh campaign diaudit langsung? Tool ini membaca angka; keputusan budget tetap milikmu.
        </p>
      </section>
    </main>
  );
}
