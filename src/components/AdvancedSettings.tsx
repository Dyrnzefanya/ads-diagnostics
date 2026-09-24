'use client';

import { useState } from 'react';
import { PATHS, stagesFor } from '@/config/meta/paths';
import { PRESETS, resolvePreset, type ThOverrides } from '@/config/meta/thresholds';
import { fmtNum, parseID } from '@/lib/format';
import type { FormState } from '@/lib/form';

interface Props {
  form: FormState;
  onPreset: (id: string) => void;
  onOverrides: (o: ThOverrides) => void;
}

export function AdvancedSettings({ form, onPreset, onOverrides }: Props) {
  const preset = resolvePreset(form.presetId);
  const stages = stagesFor(PATHS[form.pathId], form.level, {});
  const [raw, setRaw] = useState<Record<string, string>>({});
  const shown = (key: string, side: 'sehat' | 'kritis') =>
    raw[`${key}.${side}`] ?? (form.overrides[key]?.[side] != null ? String(form.overrides[key]![side]).replace('.', ',') : '');
  const setOne = (key: string, side: 'sehat' | 'kritis', text: string) => {
    setRaw((r) => ({ ...r, [`${key}.${side}`]: text }));
    const n = parseID(text);
    if (text.trim() !== '' && n == null) return; // belum lengkap, mis. "0,": biarkan override tersimpan
    const next = { ...form.overrides, [key]: { ...form.overrides[key] } };
    if (n == null) delete next[key][side]; else next[key][side] = n;
    if (!Object.keys(next[key]).length) delete next[key];
    onOverrides(next);
  };
  const input = 'w-24 rounded-md border border-line bg-navy px-2 py-1.5 text-sm tabular-nums';

  return (
    <details className="rounded-xl border border-line bg-panel">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Pengaturan lanjutan (preset industri &amp; threshold)</summary>
      <div className="space-y-4 border-t border-line p-4">
        <div>
          <label htmlFor="preset" className="mb-1 block text-sm font-medium">Preset industri</label>
          <select id="preset" value={form.presetId} onChange={(e) => onPreset(e.target.value)} className="w-full rounded-lg border border-line bg-navy px-3 py-2.5 text-base">
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-dim">{PRESETS.find((p) => p.id === form.presetId)?.desc}</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Override batas untuk tahap di konteks ini</p>
          <p className="mb-3 text-xs text-dim">Kosongkan untuk memakai nilai preset. Batas biaya (CPA/CPL/CPC) berupa pengali terhadap batas impas.</p>
          <div className="space-y-2">
            {[...stages.map((s) => s.key), 'cost'].filter((k, i, a) => a.indexOf(k) === i && preset.th[k]).map((key) => {
              const t = preset.th[key];
              const label = key === 'cost' ? 'Biaya per hasil' : stages.find((s) => s.key === key)?.label ?? key;
              return (
                <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="w-40 shrink-0">{label}</span>
                  <label className="flex items-center gap-1 text-dim">Sehat
                    <input aria-label={`${label} batas sehat`} className={input} inputMode="decimal" placeholder={fmtNum(t.sehat, 2)}
                      value={shown(key, 'sehat')}
                      onChange={(e) => setOne(key, 'sehat', e.target.value)} />
                  </label>
                  <label className="flex items-center gap-1 text-dim">Kritis
                    <input aria-label={`${label} batas kritis`} className={input} inputMode="decimal" placeholder={fmtNum(t.kritis, 2)}
                      value={shown(key, 'kritis')}
                      onChange={(e) => setOne(key, 'kritis', e.target.value)} />
                  </label>
                </div>
              );
            })}
          </div>
          {Object.keys(form.overrides).length > 0 && (
            <button type="button" onClick={() => { setRaw({}); onOverrides({}); }} className="mt-3 text-sm text-teal underline underline-offset-2">Reset semua override</button>
          )}
        </div>
      </div>
    </details>
  );
}
