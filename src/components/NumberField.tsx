'use client';

interface Props {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
  suffix?: string;
}

/** Input angka format Indonesia; teks mentah disimpan apa adanya (parsing dilakukan di lib/form). */
export function NumberField({ id, label, hint, value, onChange, required, error, placeholder, suffix }: Props) {
  return (
    <div className="group">
      <label htmlFor={id} className="mb-1 flex items-baseline justify-between gap-2 text-sm font-medium">
        <span>
          {label}
          {required && <span className="text-teal" aria-hidden> *</span>}
        </span>
        {!required && <span className="text-xs font-normal text-dim">opsional</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-required={required || undefined}
          aria-describedby={`${id}-d`}
          className={`w-full rounded-lg border bg-navy px-3 py-2.5 text-base tabular-nums placeholder:text-dim/60 ${
            error ? 'border-rose' : 'border-line focus:border-teal'
          } ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-dim">{suffix}</span>}
      </div>
      <p id={`${id}-d`} className={`mt-1 text-xs ${error ? 'text-rose' : 'hidden text-dim group-focus-within:block'}`}>
        {error ?? hint}
      </p>
    </div>
  );
}
