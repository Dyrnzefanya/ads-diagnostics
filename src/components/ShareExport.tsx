'use client';

import { useState, type RefObject } from 'react';

interface Props {
  target: RefObject<HTMLElement | null>;
  /** Nama file PNG tanpa ekstensi. */
  fileName: string;
}

const btn = 'rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium hover:border-teal hover:text-teal disabled:opacity-50';

export function ShareExport({ target, fileName }: Props) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      say('Link disalin.');
    } catch {
      say('Gagal menyalin; salin dari bilah alamat.');
    }
  };

  const png = async () => {
    if (!target.current) return;
    setBusy(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(target.current, { pixelRatio: 2, backgroundColor: '#0b1220', cacheBust: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.png`;
      a.click();
    } catch {
      say('Gagal membuat gambar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button type="button" className={btn} onClick={copy}>Salin link</button>
      <button type="button" className={btn} onClick={png} disabled={busy}>{busy ? 'Membuat…' : 'Unduh PNG'}</button>
      <button type="button" className={btn} onClick={() => window.print()}>Cetak / PDF</button>
      <span role="status" className="text-sm text-dim">{msg}</span>
    </div>
  );
}
