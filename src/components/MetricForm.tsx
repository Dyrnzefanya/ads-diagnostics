'use client';

import { METRICS } from '@/config/meta/metrics';
import { PATHS, fieldsFor } from '@/config/meta/paths';
import type { Economics, Level, MetricKey } from '@/engine/types';
import type { FormState } from '@/lib/form';
import { NumberField } from './NumberField';

interface Props {
  form: FormState;
  bad: string[];
  onMetric: (k: MetricKey, v: string) => void;
  onDays: (v: string) => void;
}

export function MetricForm({ form, bad, onMetric, onDays }: Props) {
  const { required, optional } = fieldsFor(PATHS[form.pathId], form.level as Level);
  const err = (id: string) => (bad.includes(id) ? 'Angka tidak valid.' : undefined);
  const field = (k: MetricKey, req: boolean) => (
    <NumberField
      key={k} id={`m-${k}`} label={METRICS[k].label} hint={METRICS[k].hint} required={req}
      value={form.metrics[k] ?? ''} onChange={(v) => onMetric(k, v)} error={err(k)}
    />
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {required.map((k) => field(k, true))}
      <NumberField
        id="m-days" label="Hari berjalan" hint="Berapa hari iklan ini sudah tayang di rentang data yang diisi." required
        value={form.days} onChange={onDays} error={err('days')} suffix="hari"
      />
      {optional.map((k) => field(k, false))}
    </div>
  );
}

const ECO_FIELDS: Record<string, { key: keyof Economics; label: string; hint: string; req?: boolean; suffix?: string; placeholder?: string }[]> = {
  sales: [
    { key: 'price', label: 'Harga jual rata-rata', hint: 'Harga per penjualan (Rp).' },
    { key: 'cost', label: 'HPP + biaya per penjualan', hint: 'Modal produk, ongkir/packing, fee marketplace, dll. per penjualan (Rp).' },
    { key: 'conversionValue', label: 'Purchase Conversion Value (Meta)', hint: 'Kolom "Purchase conversion value" di Ads Manager. Bila diisi, ROAS memakai angka ini.' },
  ],
  lead: [
    { key: 'dealValue', label: 'Nilai rata-rata deal', hint: 'Nilai satu deal/closing (Rp).' },
    { key: 'dealCost', label: 'HPP/biaya per deal', hint: 'Biaya untuk memenuhi satu deal (Rp).' },
    { key: 'validRate', label: '% lead valid', hint: 'Persen lead yang benar-benar prospek. Kosong = default preset.', suffix: '%', placeholder: 'default' },
    { key: 'closeRate', label: 'Close rate dari lead valid', hint: 'Persen lead valid yang jadi deal. Kosong = default preset.', suffix: '%', placeholder: 'default' },
  ],
  app: [{ key: 'valuePerResult', label: 'Nilai per install/event', hint: 'Nilai sederhana (LTV) per hasil (Rp).' }],
};

export function EconomicsForm({ form, bad, onEco }: { form: FormState; bad: string[]; onEco: (k: keyof Economics, v: string) => void }) {
  const kind = PATHS[form.pathId].economics;
  if (kind === 'none') {
    return <p className="text-sm text-dim">Objective ini tidak memakai economics: dinilai dari efisiensi dan kesehatan funnel saja.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ECO_FIELDS[kind].map((f) => (
        <NumberField
          key={f.key} id={`e-${f.key}`} label={f.label} hint={f.hint} suffix={f.suffix} placeholder={f.placeholder}
          value={form.eco[f.key] ?? ''} onChange={(v) => onEco(f.key, v)} error={bad.includes(f.key) ? 'Angka tidak valid.' : undefined}
        />
      ))}
    </div>
  );
}
