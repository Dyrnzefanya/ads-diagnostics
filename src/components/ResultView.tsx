import type { DiagnosisResult, Kondisi, StageResult, StageStatus } from '@/engine/types';
import { fmtUnit } from '@/lib/format';

const TONE: Record<Kondisi, { text: string; border: string; bg: string }> = {
  KUAT: { text: 'text-teal', border: 'border-teal/50', bg: 'bg-teal/10' },
  STABIL: { text: 'text-teal', border: 'border-teal/50', bg: 'bg-teal/10' },
  'PERLU PERHATIAN': { text: 'text-amber', border: 'border-amber/50', bg: 'bg-amber/10' },
  KRITIS: { text: 'text-rose', border: 'border-rose/50', bg: 'bg-rose/10' },
  NETRAL: { text: 'text-slate', border: 'border-slate/50', bg: 'bg-slate/10' },
};

const STAGE: Record<StageStatus, { text: string; bar: string; label: string }> = {
  sehat: { text: 'text-teal', bar: 'bg-teal', label: 'Sehat' },
  waspada: { text: 'text-amber', bar: 'bg-amber', label: 'Waspada' },
  kritis: { text: 'text-rose', bar: 'bg-rose', label: 'Kritis' },
  na: { text: 'text-slate', bar: 'bg-slate', label: 'Tidak dinilai' },
};

function Funnel({ stages }: { stages: StageResult[] }) {
  return (
    <ol className="space-y-3">
      {stages.map((s) => {
        const t = STAGE[s.status];
        const width = s.score == null ? 0 : Math.max(4, Math.min(100, s.score * 100));
        return (
          <li key={s.key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums">
                {fmtUnit(s.value, s.unit)} <span className={`ml-1 text-xs font-semibold ${t.text}`}>{t.label}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel2" role="img" aria-label={`${s.label}: ${t.label}`}>
              <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${width}%` }} />
            </div>
            {s.status !== 'na' && (
              <p className="mt-1 text-xs text-dim">
                Sehat {s.dir === 'higher' ? '≥' : '≤'} {fmtUnit(s.sehat, s.unit)} · Kritis {s.dir === 'higher' ? '<' : '>'} {fmtUnit(s.kritis, s.unit)}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const ACTIONS = [
  ['sekarang', 'Sekarang'],
  ['jangan', 'Jangan'],
  ['tahan', 'Tahan sampai'],
  ['berikutnya', 'Checkpoint berikutnya'],
] as const;

const card = 'rounded-2xl border border-line bg-panel p-5';

/** Komponen presentasi murni (tanpa hook) supaya bisa dirender di landing (server) dan /diagnosis (client). */
export function ResultView({ r, levelLabel }: { r: DiagnosisResult; levelLabel?: string }) {
  if (r.code === 'invalid') {
    return (
      <section className={`${card} border-slate/50`} aria-live="polite">
        <p className="text-xs font-semibold tracking-wide text-slate">{r.kondisi}</p>
        <h2 className="mt-1 text-2xl font-extrabold">{r.label}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose">
          {r.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
        <p className="mt-4 text-sm text-dim">{r.actions.sekarang}</p>
      </section>
    );
  }
  const tone = TONE[r.kondisi];
  return (
    <div className="space-y-4" aria-live="polite">
      <section className={`rounded-2xl border p-5 ${tone.border} ${tone.bg}`}>
        <p className={`text-xs font-semibold tracking-wide ${tone.text}`}>
          {r.kondisi}{levelLabel ? ` · ${levelLabel}` : ''}{r.confidence ? ` · Keyakinan ${r.confidence}` : ''}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{r.label}</h2>
        {r.flags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {r.flags.map((f) => (
              <li key={f} className="rounded-full border border-line bg-navy/60 px-3 py-1 text-xs text-dim">{f}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="KPI">
        {r.kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-line bg-panel p-4">
            <p className="text-xs text-dim">{k.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${k.needsEconomics ? 'text-dim' : ''}`}>
              {k.needsEconomics ? 'Isi economics' : fmtUnit(k.value, k.unit)}
            </p>
          </div>
        ))}
      </section>

      <section className={card}>
        <h3 className="mb-4 text-sm font-semibold text-dim">Funnel</h3>
        <Funnel stages={r.stages} />
      </section>

      <section className={card}>
        <h3 className="mb-3 text-sm font-semibold text-dim">Ringkasan diagnosis</h3>
        <div className="space-y-2 leading-relaxed">
          {r.narrative.map((n, i) => <p key={i}>{n}</p>)}
        </div>
        <h3 className="mb-2 mt-5 text-sm font-semibold text-dim">Checkpoint data</h3>
        <ul className="space-y-1 text-sm tabular-nums">
          {r.checkpoints.map((c, i) => <li key={i} className="text-fg/90">• {c}</li>)}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map(([key, title]) => (
          <div key={key} className={`rounded-xl border p-4 ${key === 'jangan' ? 'border-rose/40 bg-rose/5' : 'border-line bg-panel'}`}>
            <h3 className={`text-sm font-semibold ${key === 'jangan' ? 'text-rose' : 'text-teal'}`}>{title}</h3>
            <p className="mt-1 text-sm leading-relaxed">{r.actions[key]}</p>
          </div>
        ))}
      </section>

      <p className="text-xs text-dim">
        Diagnosis ini hanya membaca angka yang diisi. Keputusan budget tetap keputusan finansialmu.
      </p>
    </div>
  );
}
