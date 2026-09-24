import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'Meta Ads Diagnostic — keputusan tegas dari 5 angka Ads Manager',
  description:
    'Isi angka dari Ads Manager, dapat satu keputusan tegas plus urutan tindakan: scale, perbaiki, atau pause. Membaca sampai closing, gratis, tanpa login.',
};

export const viewport: Viewport = { themeColor: '#0b1220', width: 'device-width', initialScale: 1 };

const NAV = [
  { href: '/diagnosis/', label: 'Diagnosis' },
  { href: '/riwayat/', label: 'Riwayat' },
  { href: '/panduan/', label: 'Panduan' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-dvh antialiased">
        <header className="no-print border-b border-line">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3" aria-label="Utama">
            <Link href="/" className="font-bold tracking-tight">
              Ads<span className="text-teal">Diagnostic</span>
            </Link>
            <ul className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="rounded-md px-3 py-2 text-dim hover:bg-panel hover:text-fg">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
