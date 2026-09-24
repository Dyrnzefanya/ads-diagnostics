'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LEVELS } from '@/config/meta/paths';
import { clearHistory, loadHistory, MAX_HISTORY, removeHistory, type HistoryEntry } from '@/lib/storage';

const dot: Record<string, string> = {
  KUAT: 'bg-teal', STABIL: 'bg-teal', 'PERLU PERHATIAN': 'bg-amber', KRITIS: 'bg-rose', NETRAL: 'bg-slate',
};

export function HistoryList() {
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  useEffect(() => setList(loadHistory()), []);
  const refresh = () => setList(loadHistory());

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Riwayat</h1>
          <p className="mt-1 text-dim">Tersimpan hanya di browser ini (maksimal {MAX_HISTORY} entri). Tidak ada data yang dikirim ke server.</p>
        </div>
        {!!list?.length && (
          <button type="button" onClick={() => { if (confirm('Hapus semua riwayat?')) { clearHistory(); refresh(); } }}
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-dim hover:border-rose hover:text-rose">
            Hapus semua
          </button>
        )}
      </div>

      {list === null ? null : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-dim">Belum ada diagnosis tersimpan.</p>
          <Link href="/diagnosis/" className="mt-4 inline-block rounded-xl bg-teal px-5 py-2.5 font-bold text-navy">Mulai Diagnosis</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((h) => (
            <li key={h.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4">
              <span className={`h-3 w-3 shrink-0 rounded-full ${dot[h.kondisi] ?? 'bg-slate'}`} aria-hidden />
              <Link href={`/diagnosis/?s=${h.state}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{h.label}</p>
                <p className="truncate text-sm text-dim">
                  {h.pathLabel} · {LEVELS.find((l) => l.id === h.level)?.label} · {new Date(h.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </Link>
              <button type="button" aria-label={`Hapus ${h.label}`} onClick={() => { removeHistory(h.id); refresh(); }}
                className="rounded-md px-3 py-2 text-sm text-dim hover:text-rose">Hapus</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
