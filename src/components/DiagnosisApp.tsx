'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { METRICS } from '@/config/meta/metrics';
import { LEVELS, PATHS } from '@/config/meta/paths';
import { SAMPLES } from '@/config/meta/samples';
import { resolvePreset, type ThOverrides } from '@/config/meta/thresholds';
import { diagnose } from '@/engine/diagnose';
import { sanitizeEconomics } from '@/engine/economics';
import { sanitize, validate } from '@/engine/gates';
import type { DiagnosisResult, Economics, Level, MetricKey } from '@/engine/types';
import { emptyForm, fromInput, missingRequired, parseForm, type FormState } from '@/lib/form';
import { decodeState, encodeState } from '@/lib/share';
import { addHistory, loadSettings, saveSettings } from '@/lib/storage';
import { AdvancedSettings } from './AdvancedSettings';
import { ContextPicker } from './ContextPicker';
import { EconomicsForm, MetricForm } from './MetricForm';
import { ResultView } from './ResultView';
import { ShareExport } from './ShareExport';

const card = 'rounded-2xl border border-line bg-panel p-5 sm:p-6';
const h2 = 'mb-4 text-lg font-bold';

export function DiagnosisApp() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [result, setResult] = useState<{ r: DiagnosisResult; pathId: string; level: Level; days: number } | null>(null);
  const [notice, setNotice] = useState('');
  const [sampleIdx, setSampleIdx] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const run = (f: FormState, save: boolean) => {
    const { input } = parseForm(f);
    const r = diagnose(input, resolvePreset(f.presetId, f.overrides));
    setResult({ r, pathId: f.pathId, level: f.level, days: input.days });
    const state = encodeState({ input, presetId: f.presetId, overrides: f.overrides });
    window.history.replaceState(null, '', `?s=${state}`);
    if (save && r.code !== 'invalid') {
      addHistory({ label: r.label, kondisi: r.kondisi, pathLabel: PATHS[f.pathId].label, level: f.level, state });
    }
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Buka link share (?s=) atau pulihkan pengaturan terakhir.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('s');
    if (raw) {
      const s = decodeState(raw);
      if (s) {
        const f = fromInput(s.input, s.presetId, s.overrides);
        setForm(f);
        run(f, false);
        return;
      }
      setNotice('Link tidak valid, form dikosongkan.');
    }
    const st = loadSettings();
    setForm((f) => ({ ...f, presetId: st.presetId, overrides: st.overrides }));
  }, []);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const setSettings = (presetId: string, overrides: ThOverrides) => {
    set({ presetId, overrides });
    saveSettings({ presetId, overrides });
  };

  const { input, bad } = useMemo(() => parseForm(form), [form]);
  const missing = missingRequired(form);
  const liveErrors = useMemo(() => {
    if (missing.length || bad.length) return [];
    const cfg = PATHS[form.pathId];
    return validate(sanitize(input.metrics, cfg, form.level), cfg, form.level, input.days, sanitizeEconomics(cfg, input.economics));
  }, [form.pathId, form.level, input, missing.length, bad.length]);

  const canRun = !missing.length && !bad.length && !liveErrors.length;
  const missingLabels = missing.map((k) => (k === 'days' ? 'Hari berjalan' : METRICS[k as MetricKey].label));

  const trySample = () => {
    const s = SAMPLES[sampleIdx % SAMPLES.length];
    const f = fromInput(s.input, form.presetId, form.overrides);
    setForm(f);
    setNotice(`Skenario contoh: ${s.label}.`);
    setSampleIdx(sampleIdx + 1);
    run(f, false);
  };

  const reset = () => {
    setForm({ ...emptyForm(), presetId: form.presetId, overrides: form.overrides });
    setResult(null);
    setNotice('');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const levelLabel = result ? LEVELS.find((l) => l.id === result.level)?.label : undefined;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Diagnosis Meta Ads</h1>
          <p className="mt-1 text-dim">Isi angka mentah dari Ads Manager. Rasio dihitung otomatis.</p>
        </div>
        <button type="button" onClick={trySample} className="rounded-lg border border-teal/60 px-4 py-2.5 text-sm font-medium text-teal hover:bg-teal/10">
          Coba Skenario
        </button>
      </div>
      <div role="status" className="no-print">
        {notice && <p className="rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-dim">{notice}</p>}
      </div>

      <div className="no-print space-y-6">
        <section className={card} aria-labelledby="h-konteks">
          <h2 id="h-konteks" className={h2}>Konteks</h2>
          <ContextPicker pathId={form.pathId} level={form.level} onPath={(id) => set({ pathId: id })} onLevel={(l: Level) => set({ level: l })} />
        </section>

        <section className={card} aria-labelledby="h-metrik">
          <h2 id="h-metrik" className={h2}>Angka dari Ads Manager</h2>
          <MetricForm
            form={form} bad={bad}
            onMetric={(k, v) => set({ metrics: { ...form.metrics, [k]: v } })}
            onDays={(v) => set({ days: v })}
          />
        </section>

        <section className={card} aria-labelledby="h-eco">
          <h2 id="h-eco" className={h2}>Economics <span className="text-sm font-normal text-dim">(opsional, mengaktifkan break-even, ROAS, dan profit)</span></h2>
          <EconomicsForm form={form} bad={bad} onEco={(k: keyof Economics, v) => set({ eco: { ...form.eco, [k]: v } })} />
        </section>

        <AdvancedSettings form={form} onPreset={(id) => setSettings(id, form.overrides)} onOverrides={(o) => setSettings(form.presetId, o)} />

        {liveErrors.length > 0 && (
          <ul role="alert" className="list-disc space-y-1 rounded-xl border border-rose/50 bg-rose/10 py-3 pl-8 pr-4 text-sm text-rose">
            {liveErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button" disabled={!canRun} onClick={() => run(form, true)}
            className="rounded-xl bg-teal px-6 py-3 text-base font-bold text-navy disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyze
          </button>
          <button type="button" onClick={reset} className="rounded-xl border border-line px-4 py-3 text-sm text-dim hover:text-fg">Kosongkan</button>
          {missing.length > 0 && <p className="basis-full text-sm text-dim">Lengkapi dulu: {missingLabels.join(', ')}.</p>}
        </div>
      </div>

      <div id="hasil" ref={resultRef} aria-live="polite" className="scroll-mt-4 space-y-4">
        {result && (
          <>
            <div className="space-y-4 bg-navy">
              <p className="text-sm text-dim">
                {PATHS[result.pathId].label} · {levelLabel} · {result.days} hari
              </p>
              <ResultView r={result.r} levelLabel={levelLabel} />
            </div>
            {result.r.code !== 'invalid' && <ShareExport target={resultRef} fileName={`diagnosis-${result.pathId}-${result.level}`} />}
          </>
        )}
      </div>
    </main>
  );
}
