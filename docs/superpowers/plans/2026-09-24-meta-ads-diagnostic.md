# Meta Ads Diagnostic Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun web app statis (tanpa database) yang membaca angka Ads Manager per Objective × Hasil × Level dan mengeluarkan satu keputusan tegas plus aksi, sesuai spec `docs/superpowers/specs/2026-09-24-meta-ads-diagnostic-design.md`.

**Architecture:** Engine berupa fungsi murni `diagnose(input, preset) → DiagnosisResult` yang digerakkan config (14 result path, threshold, aksi). UI Next.js static export memanggil engine di browser; riwayat dan pengaturan di `localStorage`; share lewat state base64url di query string. Engine dan test dibangun lebih dulu (Task 2–8), UI sesudahnya (Task 9–14).

**Tech Stack:** Next.js 15 (App Router, `output: 'export'`), React 19, TypeScript 5 (jangan TS 7: Next 15 gagal memuat `next.config.ts`), Tailwind v4, Vitest, html-to-image.

**Status verifikasi:** Seluruh kode di dokumen ini sudah dijalankan di folder scratch sebelum ditulis ke sini: `tsc --noEmit` bersih, **139 test Vitest lulus**, `next build` sukses (7 halaman statis), dan alur Coba Skenario → hasil → URL share → buka ulang sudah dicek di Chrome. Tetap jalankan setiap langkah verifikasi di bawah.

## Catatan: perbedaan dari Dok Planning / spec

1. **Engine dipecah 7 file** (`types, funnel, economics, gates, decide, narrate, diagnose`), bukan `diagnose.ts` + `narrate.ts`. Fungsinya sama; tiap file kecil dan punya test sendiri.
2. **Label kill = `PAUSE & ITERASI`** (bukan `MATIKAN / PAUSE`). Dok Planning tidak konsisten antara diagram gerbang dan test case #4; test case dipakai sebagai acuan.
3. **Tiga threshold baru** yang tidak ada di Dok Planning agar tahapnya bisa dinilai: `share_save_rate` (10/3), `click_to_call` (40/20), `install_to_event` (20/8). Ditandai `[baru]` di `thresholds.ts`, wajib dikalibrasi saat beta.
4. **Stage `frequency`** ditambahkan ke semua path (na bila Reach kosong); di level Ad, `hook_rate`/`hold_rate` ikut dinilai bila 3-sec plays / ThruPlays diisi.
5. **Tidak diimplementasikan (YAGNI):** "Est. Ad Recall Lift" (input opsional Awareness yang tidak dipakai rule apa pun), filter level Ad Set untuk SCALE AGRESIF (sudah tidak mungkin terjadi karena frequency waspada selalu menghasilkan OPTIMASI & PANTAU; ada test yang menjaganya), dan pembatasan Awareness dari SCALE AGRESIF (path `none` tidak pernah menghasilkannya).
6. **Tombol Analyze** nonaktif sampai semua field wajib terisi (sesuai Dok Planning), disertai daftar field yang masih kurang.

---

### Task 1: Scaffold proyek

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Buat `package.json`**

`package.json`

```json
{
  "name": "ads-diagnostics",
  "private": true,
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@types/node": "^26.6.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.9.3",
    "vitest": "^5.0.1"
  },
  "dependencies": {
    "html-to-image": "^1.11.13",
    "next": "^15.5.26",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "npx serve out",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "version": "0.1.0"
}
```

- [ ] **Step 2: Buat `tsconfig.json`**

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": [
      "dom",
      "dom.iterable",
      "ES2022"
    ],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    },
    "allowJs": true
  },
  "include": [
    "next-env.d.ts",
    "src",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

- [ ] **Step 3: Buat `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`**

`next.config.ts`

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
```

`postcss.config.mjs`

```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

- [ ] **Step 4: Buat `.gitignore`**

```gitignore
node_modules
.next
out
next-env.d.ts
*.tsbuildinfo
.vercel
```

- [ ] **Step 5: Install dan cek**

Run: `npm install`
Expected: selesai tanpa error. Lalu `npx tsc -v` menampilkan `Version 5.x`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.ts .gitignore
git commit -m "chore: scaffold Next.js static export, Tailwind v4, Vitest"
```

---

### Task 2: Tipe engine dan util format

**Files:**
- Create: `src/engine/types.ts`, `src/lib/math.ts`, `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

- [ ] **Step 1: Tulis test `parseID` dan format**

`src/lib/format.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fmtRp, fmtUnit, parseID } from './format';

describe('parseID', () => {
  it.each([
    ['Rp1.250.000', 1250000], ['1.250.000', 1250000], ['1250000', 1250000], ['12,5', 12.5],
    ['1.234,56', 1234.56], ['12.5', 12.5], ['1.250', 1250], ['0', 0], ['  Rp 500.000 ', 500000],
  ])('%s → %d', (raw, n) => expect(parseID(raw)).toBe(n));

  it.each(['', '   ', 'abc', '1,2,3', 'Rp'])('menolak %j', (raw) => expect(parseID(raw)).toBeNull());
});

describe('format', () => {
  it('Rupiah memakai titik ribuan', () => expect(fmtRp(1250000)).toBe('Rp1.250.000'));
  it('null tampil strip', () => expect(fmtUnit(null, 'rp')).toBe('—'));
  it('persen memakai koma desimal', () => expect(fmtUnit(9.2307, 'pct')).toBe('9,2%'));
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL (`./format` tidak ditemukan).

- [ ] **Step 3: Tulis tipe engine**

`src/engine/types.ts`

```ts
export type Level = 'campaign' | 'adset' | 'ad';
export type Objective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'app' | 'sales';
export type StageStatus = 'sehat' | 'waspada' | 'kritis' | 'na';
export type Confidence = 'rendah' | 'sedang' | 'tinggi';
export type Tier = 'winning' | 'profitable' | 'tipis' | 'rugi';
export type Kondisi = 'KUAT' | 'STABIL' | 'PERLU PERHATIAN' | 'KRITIS' | 'NETRAL';
export type Unit = 'pct' | 'rp' | 'x' | 'num';
export type ConfidenceScale = 'purchase' | 'lead' | 'traffic' | 'engagement' | 'reach';
export type EconomicsKind = 'sales' | 'lead' | 'app' | 'none';

export type MetricKey =
  | 'spend' | 'impressions' | 'reach' | 'linkClicks' | 'lpv' | 'initiateCheckout' | 'addToCart'
  | 'purchases' | 'leads' | 'conversations' | 'calls' | 'installs' | 'appEvents'
  | 'engagements' | 'sharesSaves' | 'plays3s' | 'thruPlays';

export type Metrics = Partial<Record<MetricKey, number>>;

/** validRate & closeRate dalam persen (0-100). Kosong = pakai default preset. */
export interface Economics {
  price?: number; cost?: number; conversionValue?: number;
  dealValue?: number; dealCost?: number; validRate?: number; closeRate?: number;
  valuePerResult?: number;
}

export interface DiagnosisInput {
  pathId: string;
  level: Level;
  days: number;
  metrics: Metrics;
  economics?: Economics;
}

/** rel=true: sehat/kritis adalah pengali terhadap eco.ref (GP, CPL impas, nilai per hasil). */
export interface Th { sehat: number; kritis: number; dir: 'higher' | 'lower'; rel?: boolean }
export type ThMap = Record<string, Th>;
export interface ResolvedPreset { id: string; th: ThMap; validRate: number; closeRate: number }

export interface StageDef {
  key: string;
  label: string;
  unit: Unit;
  tag: string;
  compute: (m: Metrics) => number | null;
}

export interface PathConfig {
  id: string;
  platform: 'meta';
  objective: Objective;
  label: string;
  inputs: MetricKey[];
  optional: MetricKey[];
  stages: StageDef[];
  primary: MetricKey;
  primaryLabel: string;
  costLabel: string;
  /** cost per hasil dikali ini (Awareness: 1000). */
  costPer?: number;
  confidenceScale: ConfidenceScale;
  economics: EconomicsKind;
}

export interface StageResult {
  key: string;
  label: string;
  unit: Unit;
  tag: string;
  value: number | null;
  status: StageStatus;
  sehat?: number;
  kritis?: number;
  dir?: 'higher' | 'lower';
  /** 0 = di batas kritis, 1 = di batas sehat; dipakai memilih tahap terlemah. */
  score: number | null;
}

export interface Eco {
  kind: EconomicsKind;
  ref: number;
  targetCost: number;
  revenue: number;
  roas: number;
  profit: number;
  defaultsUsed: boolean;
}

export interface Kpi { label: string; value: number | null; unit: Unit; needsEconomics?: boolean }

export type StatusCode =
  | 'invalid' | 'tracking' | 'early' | 'pause' | 'kill_creative'
  | 'scale_aggr' | 'scale_step' | 'optimize' | 'fix'
  | 'test_limited' | 'test' | 'keep_creative' | 'iterate_creative';

export interface Decision { code: StatusCode; tag?: string; stage?: StageResult }

export interface Ctx {
  cfg: PathConfig;
  level: Level;
  days: number;
  m: Metrics;
  stages: StageResult[];
  eco: Eco | null;
  primary: number;
  confidence: Confidence;
  costValue: number | null;
  tier?: Tier;
}

export interface DiagnosisResult {
  code: StatusCode;
  label: string;
  kondisi: Kondisi;
  confidence: Confidence | null;
  kpis: Kpi[];
  stages: StageResult[];
  bottleneck?: StageResult;
  tier?: Tier;
  narrative: string[];
  checkpoints: string[];
  actions: { sekarang: string; jangan: string; tahan: string; berikutnya: string };
  flags: string[];
  errors: string[];
}

export const FLAG = {
  ECONOMICS_MISSING: 'economics belum diisi',
  LEAD_DEFAULTS: 'lead valid dan close rate memakai default preset',
  OBJECTIVE: 'objective ini mengoptimasi klik/interaksi, bukan penjualan; pindah ke Sales atau Leads bila tujuanmu closing',
  WINNER_TIPIS: 'kandidat winner, data masih tipis',
  AD_CHECK_CAMPAIGN: 'cek landing page/checkout di level Campaign',
  NO_STAGE: 'tidak ada tahap funnel yang bisa dinilai',
} as const;
```

- [ ] **Step 4: Tulis `math.ts` dan `format.ts`**

`src/lib/math.ts`

```ts
/** a * k / b; null bila data kosong atau pembagi <= 0. Nilai 0 tetap valid. */
export const per = (a?: number, b?: number, k = 1): number | null =>
  a == null || b == null || b <= 0 ? null : (a * k) / b;
```

`src/lib/format.ts`

```ts
import type { Unit } from '../engine/types';

const nf = (n: number, max: number) => n.toLocaleString('id-ID', { maximumFractionDigits: max });

export const fmtNum = (n: number, max = 0) => nf(n, max);
export const fmtRp = (n: number) => `${n < 0 ? '-' : ''}Rp${nf(Math.abs(Math.round(n)), 0)}`;
export const fmtPct = (n: number) => `${nf(n, 1)}%`;
export const fmtX = (n: number) => `${nf(n, 1)}x`;

export function fmtUnit(v: number | null | undefined, u: Unit): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return u === 'rp' ? fmtRp(v) : u === 'pct' ? fmtPct(v) : u === 'x' ? fmtX(v) : fmtNum(v, 1);
}

/** Terima "Rp1.250.000", "1.250.000", "12,5", "1.234,56", "12.5". Kosong/rusak → null. */
export function parseID(raw: string): number | null {
  let s = raw.trim().replace(/^rp\.?\s*/i, '').replace(/\s+/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/lib/math.ts src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: engine types and ID number formatting"
```

---

### Task 3: Config Meta (metrik, threshold + preset, 14 result path)

Config berupa data; perilakunya dites lewat Task 4–7. Di task ini cukup lolos typecheck.

**Files:**
- Create: `src/config/meta/metrics.ts`, `src/config/meta/thresholds.ts`, `src/config/meta/paths.ts`

- [ ] **Step 1: `metrics.ts`** (label, unit, cara ambil di Ads Manager per metrik)

`src/config/meta/metrics.ts`

```ts
import type { MetricKey } from '../../engine/types';

export interface MetricDef { label: string; unit: 'rp' | 'num'; hint: string }

export const METRICS: Record<MetricKey, MetricDef> = {
  spend: { label: 'Ad Spend', unit: 'rp', hint: 'Ads Manager → kolom "Amount spent" untuk rentang tanggal yang sama.' },
  impressions: { label: 'Impressions', unit: 'num', hint: 'Kolom "Impressions".' },
  reach: { label: 'Reach', unit: 'num', hint: 'Kolom "Reach". Wajib di level Ad Set untuk membaca frequency.' },
  linkClicks: { label: 'Link Clicks', unit: 'num', hint: 'Kolom "Link clicks" (bukan "Clicks (all)").' },
  lpv: { label: 'Landing Page Views', unit: 'num', hint: 'Kolom "Landing page views".' },
  initiateCheckout: { label: 'Initiate Checkout', unit: 'num', hint: 'Kolom "Checkouts initiated".' },
  addToCart: { label: 'Add to Cart', unit: 'num', hint: 'Kolom "Adds to cart".' },
  purchases: { label: 'Purchases', unit: 'num', hint: 'Kolom "Website purchases" atau "Purchases".' },
  leads: { label: 'Leads', unit: 'num', hint: 'Kolom "Leads" (instant form atau website).' },
  conversations: { label: 'Messaging Conversations Started', unit: 'num', hint: 'Kolom "Messaging conversations started".' },
  calls: { label: 'Calls Placed', unit: 'num', hint: 'Kolom "Calls placed".' },
  installs: { label: 'App Installs', unit: 'num', hint: 'Kolom "Mobile app installs".' },
  appEvents: { label: 'App Events', unit: 'num', hint: 'Jumlah event utama aplikasi yang kamu optimasi (mis. registrasi, purchase).' },
  engagements: { label: 'Post Engagements', unit: 'num', hint: 'Kolom "Post engagements".' },
  sharesSaves: { label: 'Shares + Saves', unit: 'num', hint: 'Jumlah "Post shares" ditambah "Post saves".' },
  plays3s: { label: '3-sec Video Plays', unit: 'num', hint: 'Kolom "3-second video plays".' },
  thruPlays: { label: 'ThruPlays', unit: 'num', hint: 'Kolom "ThruPlays".' },
};

export const GLOBAL_FIELDS: MetricKey[] = ['spend', 'impressions'];
```

- [ ] **Step 2: `thresholds.ts`** (batas Sehat/Kritis, 5 preset industri, override)

`src/config/meta/thresholds.ts`

```ts
import type { ResolvedPreset, Th, ThMap } from '../../engine/types';

/**
 * Sumber: FW = materi Jordan (Framework 7-8, blueprint, Ads Calculator); Default = titik awal
 * perkiraan pasar Indonesia, WAJIB dikalibrasi dari data beta.
 * Bertanda [baru] = tidak ada di Dok Planning, ditambahkan agar tahapnya bisa dinilai.
 * rel=true → pengali terhadap eco.ref (GP / CPL impas / nilai per hasil).
 */
export const BASE_TH: ThMap = {
  cpm: { sehat: 40000, kritis: 100000, dir: 'lower' },
  frequency: { sehat: 2.5, kritis: 4, dir: 'lower' },
  frequency_aware: { sehat: 3, kritis: 5, dir: 'lower' },
  ctr: { sehat: 1.2, kritis: 0.7, dir: 'higher' },
  cpc: { sehat: 0.01, kritis: 0.02, dir: 'lower', rel: true }, // FW: CPC max 1% GP
  lpv_rate: { sehat: 75, kritis: 50, dir: 'higher' }, // FW
  lp_conversion: { sehat: 20, kritis: 15, dir: 'higher' }, // FW
  checkout_completion: { sehat: 25, kritis: 12, dir: 'higher' },
  hook_rate: { sehat: 30, kritis: 20, dir: 'higher' },
  hold_rate: { sehat: 25, kritis: 15, dir: 'higher' },
  engagement_rate: { sehat: 3, kritis: 1, dir: 'higher' },
  share_save_rate: { sehat: 10, kritis: 3, dir: 'higher' }, // [baru]
  click_to_chat: { sehat: 60, kritis: 40, dir: 'higher' },
  click_to_call: { sehat: 40, kritis: 20, dir: 'higher' }, // [baru]
  form_cvr: { sehat: 15, kritis: 8, dir: 'higher' },
  lead_cvr: { sehat: 15, kritis: 7, dir: 'higher' },
  click_to_atc: { sehat: 8, kritis: 4, dir: 'higher' },
  atc_to_purchase: { sehat: 25, kritis: 10, dir: 'higher' },
  click_to_install: { sehat: 20, kritis: 10, dir: 'higher' },
  install_to_event: { sehat: 20, kritis: 8, dir: 'higher' }, // [baru]
  cost: { sehat: 0.33, kritis: 1, dir: 'lower', rel: true }, // FW: target 33% GP, impas 100%
};

export interface Preset {
  id: string;
  label: string;
  desc: string;
  overrides: Record<string, Partial<Pick<Th, 'sehat' | 'kritis'>>>;
  validRate: number;
  closeRate: number;
}

export const PRESETS: Preset[] = [
  { id: 'ecommerce', label: 'E-commerce / produk fisik', desc: 'Nilai default.', overrides: {}, validRate: 70, closeRate: 7 },
  {
    id: 'digital', label: 'Digital product', desc: 'LP conversion sehat ≥ 24%, checkout completion sehat ≥ 40%.',
    overrides: { lp_conversion: { sehat: 24 }, checkout_completion: { sehat: 40 } }, validRate: 70, closeRate: 7,
  },
  {
    id: 'b2b', label: 'Lead gen B2B / high-ticket', desc: 'CTR lebih rendah, CPM sehat ≤ Rp70.000, lead valid 30%, close rate 40%.',
    overrides: { ctr: { sehat: 0.8, kritis: 0.4 }, cpm: { sehat: 70000 } }, validRate: 30, closeRate: 40,
  },
  {
    id: 'lokal', label: 'Jasa lokal (CTWA/Calls)', desc: 'Click-to-chat sehat ≥ 50%, frequency kritis > 5 (audience sempit).',
    overrides: { click_to_chat: { sehat: 50 }, frequency: { kritis: 5 } }, validRate: 70, closeRate: 7,
  },
  { id: 'app', label: 'App', desc: 'Memakai default; confidence sudah berbasis jumlah install/event.', overrides: {}, validRate: 70, closeRate: 7 },
];

export type ThOverrides = Record<string, Partial<Pick<Th, 'sehat' | 'kritis'>>>;

export function resolvePreset(id: string, user: ThOverrides = {}): ResolvedPreset {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  const th: ThMap = {};
  for (const k of Object.keys(BASE_TH)) th[k] = { ...BASE_TH[k], ...p.overrides[k], ...user[k] };
  return { id: p.id, th, validRate: p.validRate, closeRate: p.closeRate };
}
```

- [ ] **Step 3: `paths.ts`** (14 result path, `fieldsFor`, `stagesFor`)

`src/config/meta/paths.ts`

```ts
import { per } from '../../lib/math';
import type { Level, Metrics, MetricKey, Objective, PathConfig, StageDef, Unit } from '../../engine/types';
import { GLOBAL_FIELDS } from './metrics';

const st = (key: string, label: string, unit: Unit, tag: string, compute: StageDef['compute']): StageDef =>
  ({ key, label, unit, tag, compute });

const S = {
  cpm: st('cpm', 'CPM', 'rp', 'DELIVERY', (m) => per(m.spend, m.impressions, 1000)),
  frequency: st('frequency', 'Frequency', 'x', 'DELIVERY', (m) => per(m.impressions, m.reach)),
  frequencyAware: st('frequency_aware', 'Frequency', 'x', 'DELIVERY', (m) => per(m.impressions, m.reach)),
  ctr: st('ctr', 'CTR link', 'pct', 'CREATIVE', (m) => per(m.linkClicks, m.impressions, 100)),
  cpc: st('cpc', 'CPC link', 'rp', 'CREATIVE', (m) => per(m.spend, m.linkClicks)),
  lpvRate: st('lpv_rate', 'LPV rate', 'pct', 'LANDING PAGE', (m) => per(m.lpv, m.linkClicks, 100)),
  lpConversion: st('lp_conversion', 'LP conversion', 'pct', 'LANDING PAGE', (m) => per(m.initiateCheckout, m.lpv, 100)),
  checkout: st('checkout_completion', 'Checkout completion', 'pct', 'CHECKOUT', (m) => per(m.purchases, m.initiateCheckout, 100)),
  hook: st('hook_rate', 'Hook rate', 'pct', 'CREATIVE', (m) => per(m.plays3s, m.impressions, 100)),
  hold: st('hold_rate', 'Hold rate', 'pct', 'CREATIVE', (m) => per(m.thruPlays, m.plays3s, 100)),
  engRate: st('engagement_rate', 'Engagement rate', 'pct', 'CREATIVE', (m) => per(m.engagements, m.reach, 100)),
  shareSave: st('share_save_rate', 'Share/save rate', 'pct', 'CREATIVE', (m) => per(m.sharesSaves, m.engagements, 100)),
  clickToChat: st('click_to_chat', 'Click-to-chat', 'pct', 'FOLLOW-UP CHAT', (m) => per(m.conversations, m.linkClicks, 100)),
  clickToCall: st('click_to_call', 'Click-to-call', 'pct', 'TOMBOL TELEPON', (m) => per(m.calls, m.linkClicks, 100)),
  formCvr: st('form_cvr', 'Form CVR', 'pct', 'FORM', (m) => per(m.leads, m.linkClicks, 100)),
  leadCvr: st('lead_cvr', 'Lead CVR', 'pct', 'LANDING PAGE', (m) => per(m.leads, m.lpv, 100)),
  clickToAtc: st('click_to_atc', 'Click → ATC', 'pct', 'LANDING PAGE', (m) => per(m.addToCart, m.linkClicks, 100)),
  atcToPurchase: st('atc_to_purchase', 'ATC → Purchase', 'pct', 'CHECKOUT', (m) => per(m.purchases, m.addToCart, 100)),
  clickToInstall: st('click_to_install', 'Click → Install', 'pct', 'HALAMAN APP', (m) => per(m.installs, m.linkClicks, 100)),
  installToEvent: st('install_to_event', 'Install → Event', 'pct', 'ONBOARDING APP', (m) => per(m.appEvents, m.installs, 100)),
  cost: (primary: MetricKey, label: string) =>
    st('cost', label, 'rp', 'OFFER & HARGA', (m) => per(m.spend, m[primary])),
};

type Def = Omit<PathConfig, 'platform' | 'optional'> & { optional?: MetricKey[] };
const def = (d: Def): PathConfig => ({ platform: 'meta', optional: [], ...d });

const REACH: MetricKey[] = ['reach'];

export const PATH_LIST: PathConfig[] = [
  def({
    id: 'awareness_reach', objective: 'awareness', label: 'Reach / Brand Awareness',
    inputs: ['reach'], optional: ['plays3s', 'thruPlays'],
    stages: [S.cpm, S.frequencyAware, S.hook, S.hold],
    primary: 'reach', primaryLabel: 'Reach', costLabel: 'Biaya per 1.000 reach', costPer: 1000,
    confidenceScale: 'reach', economics: 'none',
  }),
  def({
    id: 'traffic_lp', objective: 'traffic', label: 'Website / Landing Page',
    inputs: ['reach', 'linkClicks', 'lpv'],
    stages: [S.cpm, S.frequency, S.ctr, S.cpc, S.lpvRate],
    primary: 'lpv', primaryLabel: 'LPV', costLabel: 'Biaya per LPV',
    confidenceScale: 'traffic', economics: 'none',
  }),
  def({
    id: 'engagement_post', objective: 'engagement', label: 'Post Engagement',
    inputs: ['reach', 'engagements', 'sharesSaves'],
    stages: [S.cpm, S.frequency, S.engRate, S.shareSave],
    primary: 'engagements', primaryLabel: 'Engagement', costLabel: 'Biaya per engagement',
    confidenceScale: 'engagement', economics: 'none',
  }),
  def({
    id: 'engagement_video', objective: 'engagement', label: 'Video Engagement',
    inputs: ['reach', 'plays3s', 'thruPlays'],
    stages: [S.cpm, S.frequency, S.hook, S.hold],
    primary: 'thruPlays', primaryLabel: 'ThruPlay', costLabel: 'Biaya per ThruPlay',
    confidenceScale: 'engagement', economics: 'none',
  }),
  def({
    id: 'engagement_messaging', objective: 'engagement', label: 'Messaging Conversations',
    inputs: ['linkClicks', 'conversations'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToChat, S.cost('conversations', 'Biaya per chat')],
    primary: 'conversations', primaryLabel: 'Chat', costLabel: 'Biaya per chat',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'leads_instant', objective: 'leads', label: 'Instant Form',
    inputs: ['linkClicks', 'leads'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.formCvr, S.cost('leads', 'CPL')],
    primary: 'leads', primaryLabel: 'Lead', costLabel: 'CPL',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'leads_website', objective: 'leads', label: 'Website Leads',
    inputs: ['linkClicks', 'lpv', 'leads'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.lpvRate, S.leadCvr, S.cost('leads', 'CPL')],
    primary: 'leads', primaryLabel: 'Lead', costLabel: 'CPL',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'leads_whatsapp', objective: 'leads', label: 'WhatsApp / Messaging',
    inputs: ['linkClicks', 'conversations'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToChat, S.cost('conversations', 'Biaya per chat')],
    primary: 'conversations', primaryLabel: 'Chat', costLabel: 'Biaya per chat',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'leads_calls', objective: 'leads', label: 'Calls',
    inputs: ['linkClicks', 'calls'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToCall, S.cost('calls', 'Biaya per call')],
    primary: 'calls', primaryLabel: 'Call', costLabel: 'Biaya per call',
    confidenceScale: 'lead', economics: 'lead',
  }),
  def({
    id: 'app_installs', objective: 'app', label: 'App Installs',
    inputs: ['linkClicks', 'installs'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToInstall, S.cost('installs', 'CPI')],
    primary: 'installs', primaryLabel: 'Install', costLabel: 'CPI',
    confidenceScale: 'lead', economics: 'app',
  }),
  def({
    id: 'app_events', objective: 'app', label: 'App Events',
    inputs: ['linkClicks', 'installs', 'appEvents'], optional: REACH,
    stages: [S.frequency, S.ctr, S.clickToInstall, S.installToEvent, S.cost('appEvents', 'Biaya per event')],
    primary: 'appEvents', primaryLabel: 'Event', costLabel: 'Biaya per event',
    confidenceScale: 'purchase', economics: 'app',
  }),
  def({
    id: 'sales_website', objective: 'sales', label: 'Website Purchase',
    inputs: ['linkClicks', 'lpv', 'initiateCheckout', 'purchases'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.lpvRate, S.lpConversion, S.checkout, S.cost('purchases', 'CPA')],
    primary: 'purchases', primaryLabel: 'Purchase', costLabel: 'CPA',
    confidenceScale: 'purchase', economics: 'sales',
  }),
  def({
    id: 'sales_catalog', objective: 'sales', label: 'Catalog / Shop Purchase',
    inputs: ['linkClicks', 'addToCart', 'purchases'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToAtc, S.atcToPurchase, S.cost('purchases', 'CPA')],
    primary: 'purchases', primaryLabel: 'Purchase', costLabel: 'CPA',
    confidenceScale: 'purchase', economics: 'sales',
  }),
  def({
    id: 'sales_ctwa', objective: 'sales', label: 'WhatsApp (CTWA) Sales',
    inputs: ['linkClicks', 'conversations'], optional: REACH,
    stages: [S.cpm, S.frequency, S.ctr, S.clickToChat, S.cost('conversations', 'Biaya per chat')],
    primary: 'conversations', primaryLabel: 'Chat', costLabel: 'Biaya per chat',
    confidenceScale: 'lead', economics: 'lead',
  }),
];

export const PATHS: Record<string, PathConfig> = Object.fromEntries(PATH_LIST.map((p) => [p.id, p]));

export const OBJECTIVES: { id: Objective; label: string }[] = [
  { id: 'awareness', label: 'Awareness' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'leads', label: 'Leads' },
  { id: 'app', label: 'App Promotion' },
  { id: 'sales', label: 'Sales' },
];

export const LEVELS: { id: Level; label: string }[] = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'adset', label: 'Ad Set' },
  { id: 'ad', label: 'Ad' },
];

/** Field wajib/opsional per path × level. Ad Set: reach wajib. Ad: 3s plays & ThruPlays opsional. */
export function fieldsFor(cfg: PathConfig, level: Level): { required: MetricKey[]; optional: MetricKey[] } {
  const required: MetricKey[] = [...GLOBAL_FIELDS, ...cfg.inputs];
  let optional = [...cfg.optional];
  if (level === 'adset' && !required.includes('reach')) {
    required.push('reach');
    optional = optional.filter((k) => k !== 'reach');
  }
  if (level === 'ad') {
    for (const k of ['plays3s', 'thruPlays'] as const) {
      if (!required.includes(k) && !optional.includes(k)) optional.push(k);
    }
  }
  return { required, optional };
}

/** Stage path + (level Ad, data video diisi) hook/hold setelah CTR. */
export function stagesFor(cfg: PathConfig, level: Level, m: Metrics): StageDef[] {
  if (level !== 'ad' || m.plays3s == null || cfg.stages.some((s) => s.key === 'hook_rate')) return cfg.stages;
  const extra = m.thruPlays != null ? [S.hook, S.hold] : [S.hook];
  const after = (key: string) => cfg.stages.findIndex((s) => s.key === key) + 1;
  const at = after('ctr') || after('cpm');
  return [...cfg.stages.slice(0, at), ...extra, ...cfg.stages.slice(at)];
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada output (bersih). Bila muncul error `Cannot find module './globals.css'`, abaikan sampai Task 9 (file itu belum ada).

- [ ] **Step 5: Commit**

```bash
git add src/config
git commit -m "feat: Meta config - metrics, thresholds, presets, 14 result paths"
```

---

### Task 4: Funnel scoring dan confidence

**Files:**
- Create: `src/engine/funnel.ts`
- Test: `src/engine/funnel.test.ts`

- [ ] **Step 1: Tulis test**

`src/engine/funnel.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BASE_TH } from '../config/meta/thresholds';
import { scoreConfidence, scoreStage, weakestStage } from './funnel';
import type { StageDef } from './types';

const def = (key: string, v: number | null): StageDef => ({ key, label: key, unit: 'pct', tag: 'X', compute: () => v });

describe('scoreStage', () => {
  it('higher_better: batas sehat inklusif, batas kritis eksklusif', () => {
    const s = (v: number) => scoreStage(def('lp_conversion', v), {}, BASE_TH).status;
    expect(s(20)).toBe('sehat');
    expect(s(15)).toBe('waspada');
    expect(s(14.99)).toBe('kritis');
  });
  it('lower_better', () => {
    const s = (v: number) => scoreStage(def('cpm', v), {}, BASE_TH).status;
    expect(s(40000)).toBe('sehat');
    expect(s(100000)).toBe('waspada');
    expect(s(100001)).toBe('kritis');
  });
  it('rel: batas dikali ref; tanpa ref → na', () => {
    expect(scoreStage(def('cost', 25000), {}, BASE_TH, 100000).status).toBe('sehat');
    expect(scoreStage(def('cost', 60000), {}, BASE_TH, 100000).status).toBe('waspada');
    expect(scoreStage(def('cost', 120000), {}, BASE_TH, 100000).status).toBe('kritis');
    expect(scoreStage(def('cost', 25000), {}, BASE_TH).status).toBe('na');
  });
  it('nilai null atau threshold tak dikenal → na', () => {
    expect(scoreStage(def('cpm', null), {}, BASE_TH).status).toBe('na');
    expect(scoreStage(def('tidak_ada', 1), {}, BASE_TH).status).toBe('na');
  });
});

describe('scoreConfidence', () => {
  it.each([
    [4, 'purchase', 'rendah'], [5, 'purchase', 'sedang'], [14, 'purchase', 'sedang'], [15, 'purchase', 'tinggi'],
    [9, 'lead', 'rendah'], [30, 'lead', 'tinggi'], [99, 'traffic', 'rendah'], [300, 'traffic', 'tinggi'],
    [1000, 'engagement', 'tinggi'], [4999, 'reach', 'rendah'], [20000, 'reach', 'tinggi'],
  ] as const)('%d %s → %s', (n, scale, want) => expect(scoreConfidence(n, scale)).toBe(want));
});

describe('weakestStage', () => {
  it('memilih skor terendah dan mengabaikan cost', () => {
    const a = scoreStage(def('lpv_rate', 60), {}, BASE_TH); // (60-50)/25 = 0.4
    const b = scoreStage(def('checkout_completion', 15), {}, BASE_TH); // (15-12)/13 ≈ 0.23
    const cost = scoreStage(def('cost', 100000), {}, BASE_TH, 100000); // skor 0, harus diabaikan
    expect(weakestStage([a, b, cost])?.key).toBe('checkout_completion');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/engine/funnel.test.ts`
Expected: FAIL (`./funnel` tidak ditemukan).

- [ ] **Step 3: Implementasi**

`src/engine/funnel.ts`

```ts
import type { Confidence, ConfidenceScale, Metrics, StageDef, StageResult, StageStatus, ThMap } from './types';

export function scoreStage(def: StageDef, m: Metrics, th: ThMap, ref?: number): StageResult {
  const value = def.compute(m);
  const t = th[def.key];
  const base = { key: def.key, label: def.label, unit: def.unit, tag: def.tag, value };
  if (value == null || !t || (t.rel && ref == null)) return { ...base, status: 'na', score: null };

  const k = t.rel ? (ref as number) : 1;
  const sehat = t.sehat * k;
  const kritis = t.kritis * k;
  const hi = t.dir === 'higher';
  const status: StageStatus = hi
    ? value >= sehat ? 'sehat' : value < kritis ? 'kritis' : 'waspada'
    : value <= sehat ? 'sehat' : value > kritis ? 'kritis' : 'waspada';
  const span = hi ? sehat - kritis : kritis - sehat;
  const score = span === 0 ? (status === 'sehat' ? 1 : 0) : (hi ? value - kritis : kritis - value) / span;
  return { ...base, status, sehat, kritis, dir: t.dir, score };
}

const CONF: Record<ConfidenceScale, [number, number]> = {
  purchase: [5, 15],
  lead: [10, 30],
  traffic: [100, 300],
  engagement: [300, 1000],
  reach: [5000, 20000],
};

/** Jumlah hasil baru yang wajar sebelum checkpoint berikutnya. */
export const CHECK_VOLUME: Record<ConfidenceScale, number> = {
  purchase: 5, lead: 10, traffic: 100, engagement: 300, reach: 5000,
};

export function scoreConfidence(n: number, scale: ConfidenceScale): Confidence {
  const [mid, high] = CONF[scale];
  return n < mid ? 'rendah' : n < high ? 'sedang' : 'tinggi';
}

/** Tahap non-cost dengan skor terendah (paling dekat / melewati batas kritis). */
export function weakestStage(stages: StageResult[]): StageResult | undefined {
  return stages
    .filter((s) => s.key !== 'cost' && s.score != null)
    .reduce<StageResult | undefined>((w, s) => (w && (w.score as number) <= (s.score as number) ? w : s), undefined);
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/engine/funnel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/funnel.ts src/engine/funnel.test.ts
git commit -m "feat: funnel stage scoring and confidence"
```

---

### Task 5: Economics (GP, break-even, tier)

**Files:**
- Create: `src/engine/economics.ts`
- Test: `src/engine/economics.test.ts`

- [ ] **Step 1: Tulis test**

`src/engine/economics.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { PATHS } from '../config/meta/paths';
import { resolvePreset } from '../config/meta/thresholds';
import { resolveEconomics, sanitizeEconomics, tierOf, validateEconomics } from './economics';

const P = resolvePreset('ecommerce');

describe('resolveEconomics', () => {
  it('Sales: GP, target 33%, ROAS, profit', () => {
    const e = resolveEconomics(PATHS.sales_website, { price: 149000, cost: 45000 }, { spend: 350000, purchases: 6 }, P)!;
    expect(e.ref).toBe(104000);
    expect(e.targetCost).toBeCloseTo(34320);
    expect(e.roas).toBeCloseTo((6 * 149000) / 350000);
    expect(e.profit).toBe(6 * 104000 - 350000);
  });
  it('Sales: conversionValue dari Meta menggantikan purchases × harga untuk ROAS', () => {
    const e = resolveEconomics(PATHS.sales_website, { price: 149000, cost: 45000, conversionValue: 1000000 }, { spend: 500000, purchases: 6 }, P)!;
    expect(e.roas).toBe(2);
  });
  it('Lead: CPL impas = GP deal × valid × close; default preset dipakai bila kosong', () => {
    const e = resolveEconomics(PATHS.leads_whatsapp, { dealValue: 5_000_000, dealCost: 3_000_000 }, { spend: 800000, conversations: 90 }, P)!;
    expect(e.ref).toBeCloseTo(2_000_000 * 0.7 * 0.07);
    expect(e.defaultsUsed).toBe(true);
    const b2b = resolveEconomics(PATHS.leads_website, { dealValue: 5_000_000, dealCost: 3_000_000 }, { spend: 1, leads: 1 }, resolvePreset('b2b'))!;
    expect(b2b.ref).toBeCloseTo(2_000_000 * 0.3 * 0.4);
  });
  it('Lead: rate dari user menang atas default', () => {
    const e = resolveEconomics(PATHS.leads_website, { dealValue: 1_000_000, dealCost: 0, validRate: 50, closeRate: 10 }, { spend: 1, leads: 1 }, P)!;
    expect(e.ref).toBeCloseTo(50000);
    expect(e.defaultsUsed).toBe(false);
  });
  it('App: nilai per hasil', () => {
    const e = resolveEconomics(PATHS.app_installs, { valuePerResult: 20000 }, { spend: 100000, installs: 10 }, P)!;
    expect(e.ref).toBe(20000);
    expect(e.profit).toBe(10 * 20000 - 100000);
  });
  it('tidak lengkap atau path tanpa economics → null', () => {
    expect(resolveEconomics(PATHS.sales_website, { price: 149000 }, { spend: 1 }, P)).toBeNull();
    expect(resolveEconomics(PATHS.sales_website, undefined, { spend: 1 }, P)).toBeNull();
    expect(resolveEconomics(PATHS.traffic_lp, { price: 1, cost: 0 }, { spend: 1 }, P)).toBeNull();
  });
});

describe('tierOf', () => {
  it.each([[33, 'winning'], [34, 'profitable'], [60, 'profitable'], [61, 'tipis'], [100, 'tipis'], [101, 'rugi']] as const)(
    'biaya %d%% dari impas → %s', (pct, tier) => expect(tierOf(pct, 100)).toBe(tier));
});

describe('economics helpers', () => {
  it('sanitize membuang field milik path lain', () => {
    expect(sanitizeEconomics(PATHS.sales_website, { price: 1, cost: 0, dealValue: 5 })).toEqual({ price: 1, cost: 0 });
    expect(sanitizeEconomics(PATHS.traffic_lp, { price: 1 })).toBeUndefined();
  });
  it('validate menolak harga ≤ biaya, rate di luar 0-100, dan negatif', () => {
    expect(validateEconomics({ price: 100, cost: 100 })).toHaveLength(1);
    expect(validateEconomics({ dealValue: 10, dealCost: 20 })).toHaveLength(1);
    expect(validateEconomics({ validRate: 120, closeRate: 0 })).toHaveLength(1);
    expect(validateEconomics({ price: -1 })).toHaveLength(1);
    expect(validateEconomics({ price: 149000, cost: 45000 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/engine/economics.test.ts`
Expected: FAIL (`./economics` tidak ditemukan).

- [ ] **Step 3: Implementasi**

`src/engine/economics.ts`

```ts
import type { Economics, Eco, Metrics, PathConfig, ResolvedPreset, Tier } from './types';

/** Target biaya akuisisi = 33% dari batas impas (Ads Calculator Jordan). */
export const TARGET = 0.33;

const KEYS = {
  sales: ['price', 'cost', 'conversionValue'],
  lead: ['dealValue', 'dealCost', 'validRate', 'closeRate'],
  app: ['valuePerResult'],
  none: [],
} as const;

/** Buang field economics yang bukan milik path ini (sisa dari path sebelumnya). */
export function sanitizeEconomics(cfg: PathConfig, e?: Economics): Economics | undefined {
  if (!e) return undefined;
  const out: Economics = {};
  for (const k of KEYS[cfg.economics]) if (e[k] != null) out[k] = e[k];
  return Object.keys(out).length ? out : undefined;
}

export function validateEconomics(e?: Economics): string[] {
  if (!e) return [];
  const errs: string[] = [];
  if (Object.values(e).some((v) => v != null && (!Number.isFinite(v) || v < 0))) {
    errs.push('Angka economics tidak boleh negatif.');
  }
  if (e.price != null && e.cost != null && e.price <= e.cost) {
    errs.push('Harga jual harus lebih besar dari HPP + biaya per penjualan.');
  }
  if (e.dealValue != null && e.dealCost != null && e.dealValue <= e.dealCost) {
    errs.push('Nilai deal harus lebih besar dari HPP/biaya per deal.');
  }
  for (const r of [e.validRate, e.closeRate]) {
    if (r != null && (r <= 0 || r > 100)) errs.push('% lead valid dan close rate harus di atas 0 dan maksimal 100.');
  }
  return [...new Set(errs)];
}

/** null = economics belum lengkap (bukan error). */
export function resolveEconomics(cfg: PathConfig, e: Economics | undefined, m: Metrics, preset: ResolvedPreset): Eco | null {
  if (!e || cfg.economics === 'none') return null;
  const spend = m.spend ?? 0;
  const n = m[cfg.primary] ?? 0;
  const done = (ref: number, revenue: number, profit: number, defaultsUsed = false): Eco | null =>
    ref > 0 ? { kind: cfg.economics, ref, targetCost: TARGET * ref, revenue, roas: revenue / spend, profit, defaultsUsed } : null;

  if (cfg.economics === 'sales') {
    if (e.price == null || e.price <= 0 || e.cost == null) return null;
    const gp = e.price - e.cost;
    const revenue = e.conversionValue ?? n * e.price;
    return done(gp, revenue, n * gp - spend);
  }
  if (cfg.economics === 'lead') {
    if (e.dealValue == null || e.dealValue <= 0 || e.dealCost == null) return null;
    const gp = e.dealValue - e.dealCost;
    const y = ((e.validRate ?? preset.validRate) / 100) * ((e.closeRate ?? preset.closeRate) / 100);
    return done(gp * y, n * y * e.dealValue, n * y * gp - spend, e.validRate == null || e.closeRate == null);
  }
  if (e.valuePerResult == null || e.valuePerResult <= 0) return null;
  return done(e.valuePerResult, n * e.valuePerResult, n * e.valuePerResult - spend);
}

/** Tier dari biaya per hasil vs batas impas: ≤33% winning, ≤60% profitable, ≤100% tipis, di atas itu rugi. */
export function tierOf(cost: number, ref: number): Tier {
  const r = cost / ref;
  return r <= TARGET ? 'winning' : r <= 0.6 ? 'profitable' : r <= 1 ? 'tipis' : 'rugi';
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/engine/economics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/economics.ts src/engine/economics.test.ts
git commit -m "feat: economics - break-even, ROAS, profit, tier"
```

---

### Task 6: Gerbang validasi dan tracking

**Files:**
- Create: `src/engine/gates.ts`
- Test: `src/engine/gates.test.ts`

- [ ] **Step 1: Tulis test**

`src/engine/gates.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { PATHS } from '../config/meta/paths';
import { checkTracking, sanitize, validate } from './gates';

const web = PATHS.sales_website;
const ok = { spend: 350000, impressions: 30000, linkClicks: 400, lpv: 260, initiateCheckout: 24, purchases: 6 };

describe('validate', () => {
  it('lolos untuk data wajar', () => expect(validate(ok, web, 'campaign', 5)).toEqual([]));
  it('field wajib kosong', () => {
    const errs = validate({ spend: 1000, impressions: 100 }, web, 'campaign', 5);
    expect(errs).toContain('Link Clicks wajib diisi.');
    expect(errs).toContain('Purchases wajib diisi.');
  });
  it('Ad Set mewajibkan reach', () => {
    expect(validate(ok, web, 'adset', 5)).toContain('Reach wajib diisi.');
    expect(validate(ok, web, 'campaign', 5)).not.toContain('Reach wajib diisi.');
  });
  it('hubungan mustahil', () => {
    expect(validate({ ...ok, reach: 40000 }, web, 'campaign', 5)).toContain('Reach tidak mungkin melebihi Impressions.');
    expect(validate({ ...ok, linkClicks: 40000 }, web, 'campaign', 5)).toContain('Link Clicks tidak mungkin melebihi Impressions.');
    expect(validate({ ...ok, lpv: 441 }, web, 'campaign', 5)).toContain('LPV tidak mungkin melebihi Link Clicks lebih dari 10%.');
    expect(validate({ ...ok, lpv: 440 }, web, 'campaign', 5)).toEqual([]); // toleransi 10%
    expect(validate({ ...ok, purchases: 29 }, web, 'campaign', 5)).toContain('Purchases tidak mungkin melebihi Initiate Checkout lebih dari 20%.');
    expect(validate({ ...ok, purchases: 28 }, web, 'campaign', 5)).toEqual([]); // 24 × 1,2 = 28,8
  });
  it('negatif, spend 0, days tidak valid', () => {
    expect(validate({ ...ok, lpv: -1 }, web, 'campaign', 5)).toContain('Landing Page Views tidak boleh negatif.');
    expect(validate({ ...ok, spend: 0 }, web, 'campaign', 5)).toContain('Ad Spend harus lebih dari 0.');
    expect(validate(ok, web, 'campaign', NaN)).toHaveLength(1);
  });
  it('economics tidak konsisten ikut ditolak', () => {
    expect(validate(ok, web, 'campaign', 5, { price: 100, cost: 200 })).toHaveLength(1);
  });
});

describe('checkTracking', () => {
  it('LPV 0 dengan klik ≥ 50', () => expect(checkTracking({ ...ok, lpv: 0 }, web)).toHaveLength(1));
  it('LPV rate < 40%', () => expect(checkTracking({ ...ok, lpv: 100 }, web)).toHaveLength(1));
  it('klik < 50 tidak dicurigai', () => expect(checkTracking({ ...ok, linkClicks: 40, lpv: 0 }, web)).toEqual([]));
  it('IC ≥ 10 tanpa purchase', () => expect(checkTracking({ ...ok, purchases: 0 }, web)).toHaveLength(1));
  it('chat 0 dengan klik ≥ 50 (path chat)', () => {
    expect(checkTracking({ linkClicks: 60, conversations: 0 }, PATHS.leads_whatsapp)).toHaveLength(1);
    expect(checkTracking({ linkClicks: 60, leads: 0 }, PATHS.leads_instant)).toEqual([]);
  });
  it('data sehat → kosong', () => expect(checkTracking(ok, web)).toEqual([]));
});

describe('sanitize', () => {
  it('membuang metrik milik path lain', () => {
    expect(sanitize({ ...ok, calls: 5, leads: 3 }, web, 'campaign')).toEqual(ok);
  });
  it('level Ad menyimpan 3s plays dan ThruPlays opsional', () => {
    expect(sanitize({ ...ok, plays3s: 100, thruPlays: 40 }, web, 'ad')).toMatchObject({ plays3s: 100, thruPlays: 40 });
    expect(sanitize({ ...ok, plays3s: 100 }, web, 'campaign')).not.toHaveProperty('plays3s');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/engine/gates.test.ts`
Expected: FAIL (`./gates` tidak ditemukan).

- [ ] **Step 3: Implementasi**

`src/engine/gates.ts`

```ts
import { METRICS } from '../config/meta/metrics';
import { fieldsFor } from '../config/meta/paths';
import type { Economics, Level, Metrics, MetricKey, PathConfig } from './types';
import { validateEconomics } from './economics';

export const MIN_DAYS = 3;

/** Buang metrik yang bukan milik path × level ini. */
export function sanitize(m: Metrics, cfg: PathConfig, level: Level): Metrics {
  const { required, optional } = fieldsFor(cfg, level);
  const out: Metrics = {};
  for (const k of [...required, ...optional]) if (m[k] != null) out[k] = m[k];
  return out;
}

/** Gerbang 0: field wajib, angka masuk akal, dan hubungan antar-metrik yang mustahil. */
export function validate(m: Metrics, cfg: PathConfig, level: Level, days: number, eco?: Economics): string[] {
  const errs: string[] = [];
  const { required } = fieldsFor(cfg, level);
  for (const k of required) {
    if (m[k] == null || !Number.isFinite(m[k])) errs.push(`${METRICS[k].label} wajib diisi.`);
  }
  for (const [k, v] of Object.entries(m) as [MetricKey, number][]) {
    if (!Number.isFinite(v) || v < 0) errs.push(`${METRICS[k].label} tidak boleh negatif.`);
  }
  if (!Number.isFinite(days) || days < 0) errs.push('Hari berjalan wajib diisi (0 atau lebih).');
  errs.push(...validateEconomics(eco));
  if (errs.length) return errs;

  if ((m.spend as number) <= 0) errs.push('Ad Spend harus lebih dari 0.');
  if ((m.impressions as number) <= 0) errs.push('Impressions harus lebih dari 0.');
  const over = (a: MetricKey, b: MetricKey, tol: number, msg: string) => {
    if (m[a] != null && m[b] != null && (m[a] as number) > (m[b] as number) * tol) errs.push(msg);
  };
  over('reach', 'impressions', 1, 'Reach tidak mungkin melebihi Impressions.');
  over('linkClicks', 'impressions', 1, 'Link Clicks tidak mungkin melebihi Impressions.');
  over('plays3s', 'impressions', 1, '3-sec Video Plays tidak mungkin melebihi Impressions.');
  over('lpv', 'linkClicks', 1.1, 'LPV tidak mungkin melebihi Link Clicks lebih dari 10%.');
  over('thruPlays', 'plays3s', 1.1, 'ThruPlays tidak mungkin melebihi 3-sec Video Plays lebih dari 10%.');
  over('purchases', 'initiateCheckout', 1.2, 'Purchases tidak mungkin melebihi Initiate Checkout lebih dari 20%.');
  over('purchases', 'addToCart', 1.2, 'Purchases tidak mungkin melebihi Add to Cart lebih dari 20%.');
  return errs;
}

/** Gerbang 1: pola yang hampir pasti masalah pixel/event, bukan performa. */
export function checkTracking(m: Metrics, cfg: PathConfig): string[] {
  const out: string[] = [];
  const clicks = m.linkClicks ?? 0;
  if (cfg.inputs.includes('lpv') && m.lpv != null && clicks >= 50) {
    if (m.lpv === 0) out.push('Link Clicks ≥ 50 tetapi LPV = 0: pixel tidak jalan atau halaman gagal dimuat.');
    else if (m.lpv / clicks < 0.4) out.push('LPV rate di bawah 40%: halaman lambat atau pixel dobel/hilang.');
  }
  if (m.initiateCheckout != null && m.initiateCheckout >= 10 && m.purchases === 0) {
    out.push('Initiate Checkout ≥ 10 tetapi Purchase = 0: event Purchase tidak terpasang atau pembayaran gagal.');
  }
  if (cfg.inputs.includes('conversations') && clicks >= 50 && m.conversations === 0) {
    out.push('Link Clicks ≥ 50 tetapi chat = 0: tombol WhatsApp/Messenger tidak berfungsi atau event tidak terkirim.');
  }
  return out;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run src/engine/gates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gates.ts src/engine/gates.test.ts
git commit -m "feat: validation and tracking gates"
```

---

### Task 7: Decision matrix, narasi, aksi, dan `diagnose()`

Task inti. Test-nya memuat 10 test case Dok Planning, 6 aturan penutup celah (Spec §4.1), aturan level/objective, dan smoke test 14 path × 3 level (42 kasus).

**Files:**
- Create: `src/engine/decide.ts`, `src/config/meta/actions.ts`, `src/engine/narrate.ts`, `src/engine/diagnose.ts`
- Test: `src/engine/diagnose.test.ts`

- [ ] **Step 1: Tulis test**

`src/engine/diagnose.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { PATH_LIST, fieldsFor } from '../config/meta/paths';
import { resolvePreset } from '../config/meta/thresholds';
import { diagnose } from './diagnose';
import { FLAG, type DiagnosisInput, type Economics, type Metrics } from './types';

const P = resolvePreset('ecommerce');
const eco: Economics = { price: 149000, cost: 45000 }; // GP 104.000 → target CPA 34.320
const run = (i: Partial<DiagnosisInput> & { metrics: Metrics }) =>
  diagnose({ pathId: 'sales_website', level: 'campaign', days: 5, economics: eco, ...i }, P);

// Test case #1 Dok Planning: LP conversion 9,2% (< 15%), CPA 56% GP.
const s1: Metrics = { spend: 350000, impressions: 30000, reach: 22000, linkClicks: 400, lpv: 260, initiateCheckout: 24, purchases: 6 };
// Test case #5: semua tahap sehat, CPA 25% GP, 20 purchase, frequency 1,8.
const s5: Metrics = { spend: 520000, impressions: 15000, reach: 8333, linkClicks: 250, lpv: 200, initiateCheckout: 50, purchases: 20 };

describe('10 test case Dok Planning', () => {
  it('#1 LP conversion rendah → PERBAIKI LANDING PAGE DULU', () => {
    const r = run({ metrics: s1 });
    expect(r.label).toBe('PERBAIKI LANDING PAGE DULU');
    expect(r.kondisi).toBe('PERLU PERHATIAN');
    expect(r.bottleneck?.key).toBe('lp_conversion');
    expect(r.bottleneck?.value).toBeCloseTo(9.23, 1);
    expect(r.tier).toBe('profitable');
    expect(r.confidence).toBe('sedang');
    expect(r.kpis.map((k) => k.label)).toEqual(['Purchase', 'CPA', 'Break-even CPA', 'ROAS', 'Profit setelah iklan']);
    expect(r.narrative.join(' ')).toContain('LP conversion');
  });
  it('#2 purchase 0 padahal IC ≥ 10 → CEK TRACKING DULU', () => {
    expect(run({ metrics: { ...s1, purchases: 0 } }).label).toBe('CEK TRACKING DULU');
  });
  it('#3 hari berjalan 2 → TERLALU DINI', () => {
    const r = run({ metrics: s1, days: 2 });
    expect(r.label).toBe('TERLALU DINI');
    expect(r.kondisi).toBe('NETRAL');
  });
  it('#4 spend ≥ 3× target tanpa hasil → PAUSE & ITERASI', () => {
    const r = run({ metrics: { spend: 400000, impressions: 30000, reach: 22000, linkClicks: 300, lpv: 200, initiateCheckout: 3, purchases: 0 } });
    expect(r.label).toBe('PAUSE & ITERASI');
    expect(r.kondisi).toBe('KRITIS');
  });
  it('#5 semua sehat, CPA 25% GP, 20 purchase → SCALE AGRESIF', () => {
    const r = run({ metrics: s5 });
    expect(r.label).toBe('SCALE AGRESIF');
    expect(r.kondisi).toBe('KUAT');
    expect(r.tier).toBe('winning');
    expect(r.stages.every((s) => s.status === 'sehat')).toBe(true);
  });
  it('#6 sama dengan #5 di level Ad → PERTAHANKAN CREATIVE', () => {
    expect(run({ metrics: s5, level: 'ad' }).label).toBe('PERTAHANKAN CREATIVE');
  });
  it('#7 Leads WhatsApp Ad Set, click-to-chat 30% → PERBAIKI FOLLOW-UP CHAT DULU', () => {
    const r = diagnose({
      pathId: 'leads_whatsapp', level: 'adset', days: 7,
      metrics: { spend: 800000, impressions: 20000, reach: 15000, linkClicks: 300, conversations: 90 },
      economics: { dealValue: 5_000_000, dealCost: 3_000_000 },
    }, P);
    expect(r.label).toBe('PERBAIKI FOLLOW-UP CHAT DULU');
    expect(r.bottleneck?.key).toBe('click_to_chat');
  });
  it('#8 Awareness Ad Set, frequency 5,5 dan CPM 45rb → PERBAIKI DELIVERY DULU', () => {
    const r = diagnose({
      pathId: 'awareness_reach', level: 'adset', days: 5,
      metrics: { spend: 900000, impressions: 20000, reach: 3636 },
    }, P);
    expect(r.label).toBe('PERBAIKI DELIVERY DULU');
    expect(r.flags).not.toContain(FLAG.ECONOMICS_MISSING);
  });
  it('#9 LPV melebihi Link Clicks → DATA BELUM VALID', () => {
    const r = diagnose({
      pathId: 'traffic_lp', level: 'campaign', days: 5,
      metrics: { spend: 500000, impressions: 40000, reach: 30000, linkClicks: 200, lpv: 240 },
    }, P);
    expect(r.label).toBe('DATA BELUM VALID');
    expect(r.errors).toContain('LPV tidak mungkin melebihi Link Clicks lebih dari 10%.');
  });
  it('#10 Instant Form tanpa economics → OPTIMASI & PANTAU + flag', () => {
    const r = diagnose({
      pathId: 'leads_instant', level: 'campaign', days: 5,
      metrics: { spend: 200000, impressions: 6000, reach: 5000, linkClicks: 80, leads: 13 },
    }, P);
    expect(r.label).toBe('OPTIMASI & PANTAU');
    expect(r.flags).toContain(FLAG.ECONOMICS_MISSING);
  });
});

describe('aturan penutup celah (Spec §4.1)', () => {
  it('1. economics kosong: tidak ada kill check, tidak pernah SCALE, maturity hanya dari hari', () => {
    const healthy = run({ metrics: s5, economics: undefined });
    expect(healthy.label).toBe('OPTIMASI & PANTAU');
    expect(healthy.flags).toContain(FLAG.ECONOMICS_MISSING);
    expect(healthy.kpis.find((k) => k.label === 'ROAS')?.needsEconomics).toBe(true);
    const noResult = run({ metrics: { ...s1, purchases: 0, initiateCheckout: 3, spend: 2_000_000 }, economics: undefined });
    expect(noResult.label).not.toBe('PAUSE & ITERASI');
    expect(run({ metrics: { ...s5, spend: 100 }, economics: undefined, days: 3 }).label).not.toBe('TERLALU DINI');
    expect(run({ metrics: s5, economics: undefined, days: 2 }).label).toBe('TERLALU DINI');
  });
  it('2. path tanpa economics: semua sehat → SCALE BERTAHAP; Awareness tidak pernah SCALE AGRESIF', () => {
    const aware = diagnose({ pathId: 'awareness_reach', level: 'campaign', days: 5, metrics: { spend: 400000, impressions: 20000, reach: 10000 } }, P);
    expect(aware.label).toBe('SCALE BERTAHAP');
    const traffic = diagnose({
      pathId: 'traffic_lp', level: 'campaign', days: 5,
      metrics: { spend: 300000, impressions: 30000, reach: 25000, linkClicks: 400, lpv: 320 },
    }, P);
    expect(traffic.label).toBe('SCALE BERTAHAP');
    expect(traffic.flags).toContain(FLAG.OBJECTIVE);
    const lowConf = diagnose({ pathId: 'awareness_reach', level: 'campaign', days: 5, metrics: { spend: 100000, impressions: 5000, reach: 3000 } }, P);
    expect(lowConf.label).toBe('LANJUT TES');
  });
  it('3. urutan matriks: Kritis + Rugi → PAUSE; Tipis + Rendah → PERBAIKI tahap terlemah', () => {
    const kritisRugi = run({ metrics: { spend: 600000, impressions: 30000, reach: 22000, linkClicks: 300, lpv: 200, initiateCheckout: 20, purchases: 5 } });
    expect(kritisRugi.bottleneck?.key).toBe('lp_conversion');
    expect(kritisRugi.tier).toBe('rugi');
    expect(kritisRugi.label).toBe('PAUSE & ITERASI');
    const tipisRendah = run({ metrics: { spend: 240000, impressions: 10000, reach: 8000, linkClicks: 130, lpv: 100, initiateCheckout: 20, purchases: 3 } });
    expect(tipisRendah.tier).toBe('tipis');
    expect(tipisRendah.confidence).toBe('rendah');
    expect(tipisRendah.bottleneck).toBeUndefined();
    expect(tipisRendah.label).toBe('PERBAIKI CHECKOUT DULU');
  });
  it('3b. Rugi + confidence rendah → LANJUT TES TERBATAS', () => {
    const r = run({ metrics: { spend: 500000, impressions: 30000, reach: 22000, linkClicks: 300, lpv: 240, initiateCheckout: 20, purchases: 3 } });
    expect(r.tier).toBe('rugi');
    expect(r.label).toBe('LANJUT TES TERBATAS');
  });
  it('4. level Ad + rugi + purchase > 0: Tinggi → MATIKAN CREATIVE, selain itu LANJUT TES', () => {
    const base = { impressions: 60000, reach: 40000, linkClicks: 900, lpv: 700, initiateCheckout: 60 };
    expect(run({ level: 'ad', metrics: { ...base, spend: 1_800_000, purchases: 15 } }).label).toBe('MATIKAN CREATIVE');
    expect(run({ level: 'ad', metrics: { ...base, spend: 600_000, purchases: 5 } }).label).toBe('LANJUT TES');
  });
  it('5. level Ad: spend < 1× target → LANJUT TES; level lain → TERLALU DINI; hari < 3 tetap TERLALU DINI', () => {
    const tiny: Metrics = { spend: 20000, impressions: 2000, reach: 1800, linkClicks: 30, lpv: 25, initiateCheckout: 2, purchases: 1 };
    expect(run({ level: 'ad', metrics: tiny }).label).toBe('LANJUT TES');
    expect(run({ level: 'campaign', metrics: tiny }).label).toBe('TERLALU DINI');
    expect(run({ level: 'ad', metrics: tiny, days: 2 }).label).toBe('TERLALU DINI');
  });
  it('6. CPC tanpa GP → na dan tidak ikut bottleneck', () => {
    const r = diagnose({
      pathId: 'traffic_lp', level: 'campaign', days: 5,
      metrics: { spend: 300000, impressions: 30000, reach: 25000, linkClicks: 400, lpv: 320 },
    }, P);
    expect(r.stages.find((s) => s.key === 'cpc')?.status).toBe('na');
  });
});

describe('aturan level dan objective', () => {
  it('Ad Set dengan frequency waspada tidak pernah SCALE AGRESIF', () => {
    const r = run({ level: 'adset', metrics: { ...s5, reach: 5000 } }); // frequency 3,0 → waspada
    expect(r.stages.find((s) => s.key === 'frequency')?.status).toBe('waspada');
    expect(r.label).not.toBe('SCALE AGRESIF');
  });
  it('Ad: masalah creative → ITERASI CREATIVE; masalah LP → PERTAHANKAN CREATIVE + catatan level Campaign', () => {
    const lowCtr = run({ level: 'ad', metrics: { ...s5, impressions: 60000, reach: 30000 } }); // CTR 0,4%
    expect(lowCtr.label).toBe('ITERASI CREATIVE');
    const lp = run({ level: 'ad', metrics: s1 });
    expect(lp.label).toBe('PERTAHANKAN CREATIVE');
    expect(lp.flags).toContain(FLAG.AD_CHECK_CAMPAIGN);
  });
  it('Profit ada tetapi purchase < 5 tidak pernah SCALE → LANJUT TES + kandidat winner', () => {
    const r = run({ metrics: { spend: 100000, impressions: 8000, reach: 6000, linkClicks: 120, lpv: 100, initiateCheckout: 20, purchases: 4 } });
    expect(r.tier).toBe('winning');
    expect(r.label).toBe('LANJUT TES');
    expect(r.flags).toContain(FLAG.WINNER_TIPIS);
  });
  it('Ad dengan data video menambah hook/hold rate', () => {
    const r = run({ level: 'ad', metrics: { ...s5, plays3s: 6000, thruPlays: 2000 } });
    expect(r.stages.map((s) => s.key)).toEqual(expect.arrayContaining(['hook_rate', 'hold_rate']));
    expect(run({ level: 'campaign', metrics: { ...s5, plays3s: 6000 } }).stages.some((s) => s.key === 'hook_rate')).toBe(false);
  });
  it('preset & override threshold mengubah diagnosis', () => {
    const strict = resolvePreset('ecommerce', { lp_conversion: { sehat: 30, kritis: 26 } });
    const r = diagnose({ pathId: 'sales_website', level: 'campaign', days: 5, economics: eco, metrics: s5 }, strict);
    expect(r.bottleneck?.key).toBe('lp_conversion');
  });
  it('path tidak dikenal → DATA BELUM VALID', () => {
    expect(diagnose({ pathId: 'x', level: 'ad', days: 5, metrics: {} }, P).label).toBe('DATA BELUM VALID');
  });
  it('angka 0 valid dan tidak crash (semua hasil nol)', () => {
    const r = run({ metrics: { spend: 1000, impressions: 1000, linkClicks: 0, lpv: 0, initiateCheckout: 0, purchases: 0 } });
    expect(r.code).not.toBe('invalid');
    expect(r.narrative.length).toBeGreaterThan(0);
  });
});

describe('smoke: setiap result path × level menghasilkan diagnosis utuh', () => {
  const all: Metrics = {
    spend: 500000, impressions: 40000, reach: 30000, linkClicks: 600, lpv: 480, initiateCheckout: 60, addToCart: 90,
    purchases: 15, leads: 40, conversations: 300, calls: 20, installs: 100, appEvents: 30, engagements: 1500,
    sharesSaves: 200, plays3s: 12000, thruPlays: 4000,
  };
  const allEco: Economics = {
    price: 149000, cost: 45000, dealValue: 5_000_000, dealCost: 3_000_000, valuePerResult: 20000,
  };
  for (const cfg of PATH_LIST) {
    for (const level of ['campaign', 'adset', 'ad'] as const) {
      it(`${cfg.id} · ${level}`, () => {
        const { required, optional } = fieldsFor(cfg, level);
        const metrics = Object.fromEntries([...required, ...optional].map((k) => [k, all[k]])) as Metrics;
        const r = diagnose({ pathId: cfg.id, level, days: 7, metrics, economics: allEco }, P);
        expect(r.errors).toEqual([]);
        expect(r.label).toBeTruthy();
        expect(r.kpis).toHaveLength(5);
        expect(r.stages.length).toBeGreaterThanOrEqual(cfg.stages.length);
        expect(r.narrative.length).toBeGreaterThanOrEqual(3);
        expect(r.checkpoints).toHaveLength(3);
        for (const a of Object.values(r.actions)) expect(a.length).toBeGreaterThan(5);
      });
    }
  }
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/engine/diagnose.test.ts`
Expected: FAIL (`./diagnose` tidak ditemukan).

- [ ] **Step 3: Matriks keputusan dan filter level**

`src/engine/decide.ts`

```ts
import { weakestStage } from './funnel';
import type { Ctx, Decision } from './types';

/** Tahap funnel yang dinilai untuk bottleneck; stage "cost" dinilai lewat tier, bukan di sini. */
export const funnelOf = (c: Pick<Ctx, 'stages'>) => c.stages.filter((s) => s.key !== 'cost' && s.status !== 'na');

/**
 * Matriks keputusan (Spec §4.1, aturan 1-3). Baris pertama yang cocok menang:
 * Rugi → Tipis → Kritis → confidence Rendah → Waspada → scale.
 */
export function decideBase(c: Ctx): Decision {
  const f = funnelOf(c);
  const kritis = f.find((s) => s.status === 'kritis');
  const { tier, confidence, cfg } = c;

  if (tier === 'rugi') return { code: confidence === 'rendah' ? 'test_limited' : 'pause' };
  if (tier === 'tipis') {
    const stage = kritis ?? weakestStage(f);
    return { code: 'fix', tag: stage?.tag ?? 'OFFER & HARGA', stage };
  }
  if (kritis) return { code: 'fix', tag: kritis.tag, stage: kritis };
  if (confidence === 'rendah' || f.length === 0) return { code: 'test' };
  if (f.some((s) => s.status === 'waspada')) return { code: 'optimize' };
  if (cfg.economics === 'none') return { code: 'scale_step' };
  if (!tier) return { code: 'optimize' }; // economics belum diisi: tidak pernah scale
  return { code: tier === 'winning' && confidence === 'tinggi' ? 'scale_aggr' : 'scale_step' };
}

/** Wewenang level Ad: hanya menilai creative (Spec §4.1 aturan 4). Level lain tidak difilter. */
export function applyLevel(d: Decision, c: Ctx): Decision {
  if (c.level !== 'ad') return d;
  switch (d.code) {
    case 'fix':
      return d.tag === 'CREATIVE' || d.tag === 'DELIVERY'
        ? { ...d, code: 'iterate_creative' }
        : { ...d, code: 'keep_creative' };
    case 'pause':
      return { code: c.confidence === 'tinggi' ? 'kill_creative' : 'test' };
    case 'test_limited':
      return { code: 'test' };
    case 'scale_aggr':
    case 'scale_step':
    case 'optimize':
      return { code: 'keep_creative' };
    default:
      return d;
  }
}
```

- [ ] **Step 4: Pustaka aksi**

`src/config/meta/actions.ts`

```ts
import type { StatusCode } from '../../engine/types';

export interface Actions { sekarang: string; jangan: string; tahan: string; berikutnya: string }

/** Pustaka bottleneck (Dok Planning): [Sekarang, Jangan] per tahap funnel. */
export const STAGE_FIX: Record<string, [string, string]> = {
  cpm: ['Buka ke broad targeting dan tambah variasi creative (Andromeda).', 'Jangan menyempitkan interest lagi.'],
  frequency: ['Tambah 3–5 creative baru dengan hook berbeda.', 'Jangan menaikkan budget pada ad set yang sama.'],
  frequency_aware: ['Refresh creative dan perluas audience agar frequency turun.', 'Jangan menambah budget pada audience yang sama.'],
  ctr: ['Uji 3 angle (Hardselling, Pain, Gain) × 3 hook baru.', 'Jangan mengganti landing page dulu.'],
  cpc: ['Perbaiki hook dan CTA agar klik lebih murah.', 'Jangan menaikkan bid atau budget dulu.'],
  hook_rate: ['Buat 10 hook berbeda untuk 1 body ("10 Hook = 1 Body").', 'Jangan mengubah body/script sekaligus.'],
  hold_rate: ['Pakai struktur P.A.S atau Hasil-Hasil-Hasil dan potong durasi sebelum inti.', 'Jangan menyalahkan targeting.'],
  lpv_rate: ['Tes kecepatan halaman di HP (target < 3 detik) dan cek Pixel Helper.', 'Jangan menambah budget.'],
  lp_conversion: ['Samakan pesan iklan dengan headline; pakai struktur LP1 P.A.S atau LP2 PROOF.', 'Jangan mengganti creative yang CTR-nya sudah sehat.'],
  checkout_completion: ['Tes checkout sampai bayar di HP, tampilkan total harga lebih awal, dan cek event Purchase.', 'Jangan merombak struktur campaign.'],
  click_to_chat: ['Tes tombol WhatsApp di iOS dan Android, lalu perbaiki pesan pembuka (pre-filled message).', 'Jangan menyimpulkan creative gagal.'],
  click_to_call: ['Tes tombol telepon di HP dan pastikan nomor aktif selama jam tayang iklan.', 'Jangan mengganti creative dulu.'],
  form_cvr: ['Kurangi field form dan perjelas benefit di intro form.', 'Jangan memakai higher intent sebelum volume cukup.'],
  lead_cvr: ['Samakan headline dengan iklan, perkuat bukti, dan pendekkan form.', 'Jangan mengganti creative yang CTR-nya sehat.'],
  click_to_atc: ['Perbaiki halaman produk: foto, harga, dan bukti sosial di layar pertama.', 'Jangan menaikkan budget katalog.'],
  atc_to_purchase: ['Tes checkout di HP, tampilkan ongkir lebih awal, dan tambah metode bayar.', 'Jangan merombak struktur campaign.'],
  click_to_install: ['Perbaiki halaman toko app: ikon, screenshot, rating, dan deskripsi.', 'Jangan menaikkan budget.'],
  install_to_event: ['Perbaiki onboarding sampai event pertama dan cek pengiriman event.', 'Jangan mengganti creative dulu.'],
  engagement_rate: ['Uji hook/visual baru yang memancing komentar dan reaksi.', 'Jangan menaikkan budget.'],
  share_save_rate: ['Buat konten yang layak disimpan/dibagikan (tips, checklist, bukti).', 'Jangan menyimpulkan audience salah.'],
  cost: ['Perbaiki tahap terlemah lebih dulu; tinjau offer dan harga.', 'Jangan scale untuk "mengejar volume".'],
};

export const STATUS_ACTIONS: Partial<Record<StatusCode, Actions>> = {
  invalid: {
    sekarang: 'Cocokkan ulang angka dengan Ads Manager (rentang tanggal dan level yang sama).',
    jangan: 'Jangan mengambil keputusan dari angka yang belum konsisten.',
    tahan: 'Tahan semua perubahan sampai angka valid.',
    berikutnya: 'Isi ulang setelah setiap pesan error di atas hilang.',
  },
  tracking: {
    sekarang: 'Validasi pixel/event dengan Pixel Helper dan Test Events, lalu tes alur sampai event terakhir di HP.',
    jangan: 'Jangan mengganti creative atau menaikkan budget; masalahnya ada di pengukuran.',
    tahan: 'Jangan menilai performa sebelum event tervalidasi.',
    berikutnya: 'Diagnosis ulang setelah tracking diperbaiki dan ada minimal 24 jam data baru.',
  },
  early: {
    sekarang: 'Biarkan berjalan tanpa perubahan.',
    jangan: 'Jangan pause, edit, atau scale; iklan masih dalam fase belajar.',
    tahan: 'Tahan sampai minimal 3 hari penuh dan spend ≥ 1× target biaya per hasil.',
    berikutnya: 'Diagnosis ulang setelah 3 hari berjalan.',
  },
  pause: {
    sekarang: 'Pause, lalu buat iterasi dengan satu variabel berbeda (hook, offer, atau audience).',
    jangan: 'Jangan menaikkan budget atau menunggu "siapa tahu membaik".',
    tahan: 'Jangan aktifkan kembali sebelum ada perubahan yang jelas.',
    berikutnya: 'Setelah iterasi, beri spend minimal 1× target biaya dan 3 hari sebelum dinilai ulang.',
  },
  scale_aggr: {
    sekarang: 'Naikkan budget 20–30% per hari selama CPA masih di bawah target.',
    jangan: 'Jangan mengubah budget, audience, dan creative bersamaan.',
    tahan: 'Turunkan kembali ke budget sebelumnya bila CPA melewati target 2 hari berturut-turut.',
    berikutnya: 'Cek 24 jam setelah tiap kenaikan; lanjut selama semua tahap tetap sehat.',
  },
  scale_step: {
    sekarang: 'Naikkan budget 10–20% per hari sambil memantau tahap yang paling dekat ke batas.',
    jangan: 'Jangan mengubah budget, audience, dan creative bersamaan.',
    tahan: 'Berhenti menaikkan budget bila ada tahap yang berubah menjadi kritis.',
    berikutnya: 'Cek 24 jam setelah tiap kenaikan.',
  },
  optimize: {
    sekarang: 'Pertahankan budget; perbaiki tahap yang berstatus waspada satu per satu.',
    jangan: 'Jangan scale sebelum economics terisi dan semua tahap sehat.',
    tahan: 'Tahan budget di level sekarang.',
    berikutnya: 'Diagnosis ulang setelah 3 hari atau saat hasil bertambah signifikan.',
  },
  test_limited: {
    sekarang: 'Lanjutkan dengan budget yang sama; data masih terlalu tipis untuk vonis.',
    jangan: 'Jangan menambah budget dan jangan pause dini.',
    tahan: 'Tahan keputusan sampai hasil mencapai tingkat keyakinan sedang.',
    berikutnya: 'Diagnosis ulang setelah 2–3 hari; pause bila tetap di atas batas impas.',
  },
  test: {
    sekarang: 'Lanjutkan tes tanpa perubahan besar.',
    jangan: 'Jangan scale dan jangan mengubah beberapa variabel sekaligus.',
    tahan: 'Tahan keputusan sampai hasil mencapai tingkat keyakinan sedang.',
    berikutnya: 'Diagnosis ulang setelah 2–3 hari atau saat hasil bertambah.',
  },
  keep_creative: {
    sekarang: 'Pertahankan creative ini berjalan; jadikan kandidat untuk fase optimasi.',
    jangan: 'Jangan mengedit creative yang sedang bekerja (reset learning).',
    tahan: 'Tahan sampai ada data pembanding dari creative lain di ad set yang sama.',
    berikutnya: 'Bandingkan dengan creative lain setelah 3 hari.',
  },
  iterate_creative: {
    sekarang: 'Ganti hook (3 detik pertama) dulu; body tetap.',
    jangan: 'Jangan mengubah hook dan body sekaligus.',
    tahan: 'Pertahankan ad lama sampai versi baru mengumpulkan data.',
    berikutnya: 'Nilai ulang setelah versi baru mencapai spend ≥ 1× target biaya.',
  },
  kill_creative: {
    sekarang: 'Matikan creative ini dan ganti dengan hook/angle baru.',
    jangan: 'Jangan menambah budget ke creative ini.',
    tahan: 'Simpan sebagai pelajaran angle yang gagal.',
    berikutnya: 'Uji 3 creative pengganti dengan hook berbeda.',
  },
};
```

- [ ] **Step 5: Narasi dan pemilih aksi**

`src/engine/narrate.ts`

```ts
import { STAGE_FIX, STATUS_ACTIONS, type Actions } from '../config/meta/actions';
import { fmtNum, fmtRp, fmtUnit } from '../lib/format';
import { CHECK_VOLUME, weakestStage } from './funnel';
import { funnelOf } from './decide';
import type { Ctx, Decision, StageResult, StatusCode, Tier } from './types';

const OPEN: Record<StatusCode, string> = {
  invalid: 'Angka yang diisi belum konsisten, jadi diagnosis belum bisa dibuat.',
  tracking: 'Ada sinyal tracking yang tidak wajar; jangan menilai creative atau audience sebelum ini beres.',
  early: 'Data belum cukup umur untuk disimpulkan.',
  pause: 'Biaya sudah keluar tanpa hasil yang sepadan; hentikan dan iterasi.',
  kill_creative: 'Creative ini tidak menghasilkan sepadan dengan biayanya; matikan dan ganti.',
  scale_aggr: 'Semua sinyal kuat: aman scale agresif, dengan kenaikan bertahap harian.',
  scale_step: 'Sinyal cukup baik untuk scale bertahap; jangan terburu-buru.',
  optimize: 'Belum ada titik yang patah, tetapi masih ada yang perlu dipantau atau dilengkapi.',
  fix: 'Belum aman untuk scale; ada satu titik yang perlu dibereskan dulu.',
  test_limited: 'Biaya per hasil di atas batas impas, tetapi datanya masih tipis; lanjutkan tes terbatas.',
  test: 'Data belum cukup untuk memutuskan; lanjutkan tes tanpa perubahan besar.',
  keep_creative: 'Creative ini bekerja; pertahankan.',
  iterate_creative: 'Creative ini perlu iterasi; ganti hook dulu, body tetap.',
};

const LEVEL_TEXT = {
  campaign: 'Di level Campaign, angka ini gabungan semua ad set, jadi belum menunjuk satu creative.',
  adset: 'Di level Ad Set, yang dinilai adalah audience dan delivery; kejenuhan audience dibaca dari frequency.',
  ad: 'Di level Ad, yang dinilai hanya creative; masalah landing page atau checkout tidak disimpulkan dari satu ad.',
};

const CONF_TEXT = {
  rendah: 'masih noise: cukup untuk mengamati, belum untuk memutuskan',
  sedang: 'cukup untuk arah, belum cukup untuk memastikan winner',
  tinggi: 'cukup kuat untuk dijadikan dasar keputusan',
};

const TIER_TEXT: Record<Tier, string> = {
  winning: 'di bawah target akuisisi (33%)',
  profitable: 'untung, tetapi di atas target 33%',
  tipis: 'mendekati impas, perlu perbaikan',
  rugi: 'di atas impas: tiap hasil merugi setelah iklan',
};

const limit = (s: StageResult) =>
  s.status === 'na' ? '' : `(sehat ${s.dir === 'higher' ? '≥' : '≤'} ${fmtUnit(s.sehat, s.unit)}, kritis ${s.dir === 'higher' ? '<' : '>'} ${fmtUnit(s.kritis, s.unit)})`;

export function narrate(c: Ctx, d: Decision, issues: string[] = []): { narrative: string[]; checkpoints: string[] } {
  const f = funnelOf(c);
  const kritis = f.find((s) => s.status === 'kritis');
  const waspada = f.filter((s) => s.status === 'waspada');
  const open = d.code === 'fix' ? `Belum aman untuk scale; ${d.tag?.toLowerCase()} perlu dibereskan dulu.` : OPEN[d.code];

  const narrative = [open, ...issues];
  if (kritis) {
    narrative.push(`${kritis.label} ${fmtUnit(kritis.value, kritis.unit)} melewati batas kritis ${fmtUnit(kritis.kritis, kritis.unit)}: ini titik pertama yang patah di funnel.`);
    if (waspada.length) narrative.push(`Tahap lain yang perlu dipantau: ${waspada.map((s) => s.label).join(', ')}.`);
  } else if (waspada.length) {
    narrative.push(`Tidak ada tahap kritis; yang perlu dipantau: ${waspada.map((s) => s.label).join(', ')}.`);
  } else if (f.length) {
    narrative.push('Semua tahap funnel yang bisa dinilai berada di zona sehat.');
  }
  if (c.eco && c.tier && c.costValue != null) {
    narrative.push(`${c.cfg.costLabel} ${fmtRp(c.costValue)} berada di ${fmtNum((c.costValue / c.eco.ref) * 100)}% dari batas impas (${fmtRp(c.eco.ref)}): ${TIER_TEXT[c.tier]}.`);
  } else if (c.cfg.economics !== 'none') {
    narrative.push('Economics belum diisi, jadi biaya per hasil belum bisa dinilai untung atau rugi.');
  }
  narrative.push(LEVEL_TEXT[c.level]);
  narrative.push(`Keyakinan ${c.confidence}: ${fmtNum(c.primary)} ${c.cfg.primaryLabel.toLowerCase()} ${CONF_TEXT[c.confidence]}.`);

  const focus = kritis ?? weakestStage(f) ?? f[0];
  const checkpoints = [
    `Spend ${fmtRp(c.m.spend ?? 0)} · ${c.days} hari · ${fmtNum(c.primary)} ${c.cfg.primaryLabel.toLowerCase()}`,
    focus ? `${focus.label} ${fmtUnit(focus.value, focus.unit)} ${limit(focus)}` : 'Belum ada tahap funnel yang bisa dinilai.',
    c.eco && c.costValue != null
      ? `${c.cfg.costLabel} ${fmtRp(c.costValue)} vs batas impas ${fmtRp(c.eco.ref)} (${c.tier ? c.tier.toUpperCase() : '-'})`
      : c.cfg.economics === 'none' ? `CPM ${fmtUnit(c.stages.find((s) => s.key === 'cpm')?.value, 'rp')}` : 'Economics belum diisi.',
  ];
  return { narrative, checkpoints };
}

/** Aksi: status tetap dari STATUS_ACTIONS; "fix" dirakit dari pustaka bottleneck + batas tahap. */
export function pickActions(c: Ctx, d: Decision): Actions {
  if (d.code !== 'fix') return STATUS_ACTIONS[d.code] as Actions;
  const [sekarang, jangan] = STAGE_FIX[d.stage?.key ?? 'cost'];
  const s = d.stage;
  const vol = `${fmtNum(CHECK_VOLUME[c.cfg.confidenceScale])} ${c.cfg.primaryLabel.toLowerCase()}`;
  return {
    sekarang,
    jangan,
    tahan: s ? `Jangan naikkan budget sampai ${s.label} ${s.dir === 'higher' ? '≥' : '≤'} ${fmtUnit(s.sehat, s.unit)}.` : 'Jangan naikkan budget sampai biaya per hasil di bawah batas impas.',
    berikutnya: s
      ? `Setelah ±${vol} tambahan atau 3 hari, ${s.label} keluar dari zona kritis (${s.dir === 'higher' ? 'minimal' : 'maksimal'} ${fmtUnit(s.kritis, s.unit)}).`
      : `Setelah ±${vol} tambahan atau 3 hari, cek ulang ${c.cfg.costLabel}.`,
  };
}
```

- [ ] **Step 6: Orkestrator `diagnose()`**

`src/engine/diagnose.ts`

```ts
import { PATHS, stagesFor } from '../config/meta/paths';
import { STATUS_ACTIONS } from '../config/meta/actions';
import { per } from '../lib/math';
import { applyLevel, decideBase, funnelOf } from './decide';
import { resolveEconomics, sanitizeEconomics, tierOf } from './economics';
import { scoreConfidence, scoreStage } from './funnel';
import { MIN_DAYS, checkTracking, sanitize, validate } from './gates';
import { narrate, pickActions } from './narrate';
import {
  FLAG, type Ctx, type Decision, type DiagnosisInput, type DiagnosisResult, type Kondisi, type Kpi, type ResolvedPreset,
  type StatusCode, type Tier,
} from './types';

function kondisiOf(code: StatusCode, tier?: Tier): Kondisi {
  switch (code) {
    case 'scale_aggr': return 'KUAT';
    case 'scale_step': return tier === 'winning' ? 'KUAT' : 'STABIL';
    case 'optimize': case 'test': case 'keep_creative': return 'STABIL';
    case 'fix': case 'test_limited': case 'tracking': case 'iterate_creative': return 'PERLU PERHATIAN';
    case 'pause': case 'kill_creative': return 'KRITIS';
    default: return 'NETRAL';
  }
}

const LABEL: Record<StatusCode, string> = {
  invalid: 'DATA BELUM VALID', tracking: 'CEK TRACKING DULU', early: 'TERLALU DINI', pause: 'PAUSE & ITERASI',
  kill_creative: 'MATIKAN CREATIVE', scale_aggr: 'SCALE AGRESIF', scale_step: 'SCALE BERTAHAP', optimize: 'OPTIMASI & PANTAU',
  fix: 'PERBAIKI', test_limited: 'LANJUT TES TERBATAS', test: 'LANJUT TES', keep_creative: 'PERTAHANKAN CREATIVE',
  iterate_creative: 'ITERASI CREATIVE',
};

function buildKpis(c: Ctx): Kpi[] {
  const { cfg, eco, primary, costValue, stages } = c;
  const head: Kpi[] = [
    { label: cfg.primaryLabel, value: primary, unit: 'num' },
    { label: cfg.costLabel, value: costValue, unit: 'rp' },
  ];
  const sv = (k: string) => stages.find((s) => s.key === k)?.value ?? null;
  if (cfg.economics === 'none') {
    const extra = stages.filter((s) => !['cpm', 'frequency', 'frequency_aware'].includes(s.key)).find((s) => s.value != null);
    return [
      ...head,
      { label: 'CPM', value: sv('cpm'), unit: 'rp' },
      { label: 'Frequency', value: sv('frequency') ?? sv('frequency_aware'), unit: 'x' },
      { label: extra?.label ?? 'CTR link', value: extra?.value ?? null, unit: extra?.unit ?? 'pct' },
    ];
  }
  const est = cfg.economics === 'sales' ? '' : 'Estimasi ';
  return [
    ...head,
    { label: `Break-even ${cfg.costLabel}`, value: eco?.ref ?? null, unit: 'rp', needsEconomics: !eco },
    { label: `${est}ROAS`, value: eco?.roas ?? null, unit: 'x', needsEconomics: !eco },
    { label: `${est}Profit setelah iklan`, value: eco?.profit ?? null, unit: 'rp', needsEconomics: !eco },
  ];
}

function invalid(errors: string[]): DiagnosisResult {
  return {
    code: 'invalid', label: LABEL.invalid, kondisi: 'NETRAL', confidence: null, kpis: [], stages: [],
    narrative: [], checkpoints: [], actions: STATUS_ACTIONS.invalid!, flags: [], errors,
  };
}

/** Diagnosis murni: input + preset → hasil. Tanpa side effect. */
export function diagnose(input: DiagnosisInput, preset: ResolvedPreset): DiagnosisResult {
  const cfg = PATHS[input.pathId];
  if (!cfg) return invalid(['Result path tidak dikenal.']);

  const m = sanitize(input.metrics, cfg, input.level);
  const economics = sanitizeEconomics(cfg, input.economics);
  const errors = validate(m, cfg, input.level, input.days, economics);
  if (errors.length) return invalid(errors);

  const eco = resolveEconomics(cfg, economics, m, preset);
  const primary = m[cfg.primary] ?? 0;
  const spend = m.spend as number;
  const costValue = per(spend, primary, cfg.costPer ?? 1);
  const c: Ctx = {
    cfg, level: input.level, days: input.days, m, eco, primary, costValue,
    stages: stagesFor(cfg, input.level, m).map((s) => scoreStage(s, m, preset.th, eco?.ref)),
    confidence: scoreConfidence(primary, cfg.confidenceScale),
    tier: eco && costValue != null ? tierOf(costValue, eco.ref) : undefined,
  };

  const flags: string[] = [];
  if (cfg.economics !== 'none' && !eco) flags.push(FLAG.ECONOMICS_MISSING);
  if (cfg.economics === 'lead' && eco?.defaultsUsed) flags.push(FLAG.LEAD_DEFAULTS);
  if (cfg.objective === 'traffic' || cfg.objective === 'engagement') flags.push(FLAG.OBJECTIVE);
  if (funnelOf(c).length === 0) flags.push(FLAG.NO_STAGE);

  const finish = (d: Decision, issues: string[] = []): DiagnosisResult => {
    if (d.code === 'keep_creative' && c.stages.some((s) => s.tag !== 'CREATIVE' && s.tag !== 'DELIVERY' && s.status === 'kritis')) {
      flags.push(FLAG.AD_CHECK_CAMPAIGN);
    }
    if (d.code === 'test' && c.tier && c.tier !== 'tipis' && c.tier !== 'rugi' && c.confidence === 'rendah') {
      flags.push(FLAG.WINNER_TIPIS);
    }
    const { narrative, checkpoints } = narrate(c, d, issues);
    return {
      code: d.code,
      label: d.code === 'fix' ? `PERBAIKI ${d.tag} DULU` : LABEL[d.code],
      kondisi: kondisiOf(d.code, c.tier),
      confidence: c.confidence,
      kpis: buildKpis(c), stages: c.stages,
      bottleneck: funnelOf(c).find((s) => s.status === 'kritis'),
      tier: c.tier, narrative, checkpoints, actions: pickActions(c, d), flags, errors: [],
    };
  };

  const tracking = checkTracking(m, cfg);
  if (tracking.length) return finish({ code: 'tracking' }, tracking);

  const target = eco?.targetCost;
  if (input.days < MIN_DAYS) return finish({ code: 'early' });
  if (target != null && spend < target) {
    // Level Ad: spend < 1× target berarti LANJUT TES, bukan TERLALU DINI (Spec §4.1 aturan 5).
    return finish({ code: input.level === 'ad' ? 'test' : 'early' });
  }
  if (target != null && primary === 0 && spend >= 3 * target) {
    return finish({ code: input.level === 'ad' ? 'kill_creative' : 'pause' });
  }
  return finish(applyLevel(decideBase(c), c));
}
```

- [ ] **Step 7: Jalankan seluruh suite engine**

Run: `npm test`
Expected: semua file lulus (funnel, economics, gates, diagnose, format). Bila satu test case Dok Planning gagal, jangan ubah angka test; periksa threshold/logika dulu.

- [ ] **Step 8: Commit**

```bash
git add src/engine src/config/meta/actions.ts
git commit -m "feat: decision matrix, narrative, actions, diagnose()"
```

---

### Task 8: Lib UI (form, share URL, localStorage, skenario contoh)

**Files:**
- Create: `src/lib/form.ts`, `src/lib/share.ts`, `src/lib/storage.ts`, `src/config/meta/samples.ts`
- Test: `src/lib/lib.test.ts`

- [ ] **Step 1: Tulis test**

`src/lib/lib.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { SAMPLES } from '../config/meta/samples';
import { resolvePreset } from '../config/meta/thresholds';
import { diagnose } from '../engine/diagnose';
import { emptyForm, fromInput, missingRequired, parseForm } from './form';
import { decodeState, encodeState } from './share';
import { MAX_HISTORY, addHistory, clearHistory, loadHistory, loadSettings, removeHistory, saveSettings } from './storage';

describe('form', () => {
  it('parseForm membaca format Indonesia dan menandai teks rusak', () => {
    const f = { ...emptyForm(), days: '5', metrics: { spend: 'Rp1.250.000', impressions: '30.000', linkClicks: 'abc' }, eco: { price: '149.000' } };
    const { input, bad } = parseForm(f);
    expect(input.metrics).toEqual({ spend: 1250000, impressions: 30000 });
    expect(input.economics).toEqual({ price: 149000 });
    expect(input.days).toBe(5);
    expect(bad).toEqual(['linkClicks']);
  });
  it('field kosong bukan error parse, tetapi terdeteksi sebagai wajib kosong', () => {
    const f = emptyForm();
    expect(parseForm(f).bad).toEqual([]);
    expect(missingRequired(f)).toEqual(expect.arrayContaining(['days', 'spend', 'impressions', 'linkClicks', 'lpv', 'initiateCheckout', 'purchases']));
    expect(missingRequired({ ...f, level: 'adset' })).toContain('reach');
  });
  it('fromInput ↔ parseForm bolak-balik tanpa kehilangan angka (termasuk desimal)', () => {
    const input = { ...SAMPLES[1].input, metrics: { ...SAMPLES[1].input.metrics, spend: 350000.5 } };
    expect(parseForm(fromInput(input, 'ecommerce', {})).input).toEqual(input);
  });
});

describe('share', () => {
  it('encode → decode identik dan aman di URL', () => {
    const state = { input: SAMPLES[0].input, presetId: 'b2b', overrides: { ctr: { sehat: 1.5 } } };
    const s = encodeState(state);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeState(s)).toEqual(state);
  });
  it('link rusak atau isi tidak valid → null', () => {
    expect(decodeState('bukan-base64!!')).toBeNull();
    expect(decodeState(encodeState({ input: { ...SAMPLES[0].input, pathId: 'ngawur' }, presetId: 'x', overrides: {} }))).toBeNull();
    expect(decodeState('')).toBeNull();
  });
  it('days kosong (NaN) selamat melewati JSON', () => {
    const s = decodeState(encodeState({ input: { ...SAMPLES[0].input, days: NaN }, presetId: 'ecommerce', overrides: {} }));
    expect(Number.isNaN(s?.input.days)).toBe(true);
  });
});

describe('storage', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
    };
  });
  const entry = (n: number) => ({ label: `L${n}`, kondisi: 'STABIL', pathLabel: 'p', level: 'campaign' as const, state: 's' });

  it('riwayat terbaru di depan, maksimal 50, bisa hapus satu dan semua', () => {
    for (let i = 0; i < MAX_HISTORY + 5; i++) addHistory(entry(i));
    const list = loadHistory();
    expect(list).toHaveLength(MAX_HISTORY);
    expect(list[0].label).toBe(`L${MAX_HISTORY + 4}`);
    removeHistory(list[0].id);
    expect(loadHistory()).toHaveLength(MAX_HISTORY - 1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it('settings tersimpan; storage rusak → default', () => {
    expect(loadSettings().presetId).toBe('ecommerce');
    saveSettings({ presetId: 'b2b', overrides: { ctr: { sehat: 1 } } });
    expect(loadSettings().presetId).toBe('b2b');
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadSettings().presetId).toBe('ecommerce');
    expect(loadHistory()).toEqual([]);
    expect(() => addHistory(entry(1))).not.toThrow();
  });
});

describe('samples', () => {
  const want = ['SCALE AGRESIF', 'PERBAIKI LANDING PAGE DULU', 'PERBAIKI CHECKOUT DULU', 'PAUSE & ITERASI'];
  it.each(SAMPLES.map((s, i) => [s.id, s, want[i]] as const))('%s → %s', (_id, sample, label) => {
    expect(diagnose(sample.input, resolvePreset('ecommerce')).label).toBe(label);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run src/lib/lib.test.ts`
Expected: FAIL (modul `./form` dst. tidak ditemukan).

- [ ] **Step 3: Implementasi**

`src/lib/form.ts`

```ts
import { fieldsFor, PATHS } from '../config/meta/paths';
import type { ThOverrides } from '../config/meta/thresholds';
import type { DiagnosisInput, Economics, Level, MetricKey } from '../engine/types';
import { parseID } from './format';

/** State form = string mentah dari input, supaya "1.250" atau "12," tidak rusak saat diketik. */
export interface FormState {
  pathId: string;
  level: Level;
  days: string;
  metrics: Partial<Record<MetricKey, string>>;
  eco: Partial<Record<keyof Economics, string>>;
  presetId: string;
  overrides: ThOverrides;
}

export const emptyForm = (): FormState => ({
  pathId: 'sales_website', level: 'campaign', days: '', metrics: {}, eco: {}, presetId: 'ecommerce', overrides: {},
});

const toStr = (n: number) => String(n).replace('.', ',');

export function fromInput(input: DiagnosisInput, presetId: string, overrides: ThOverrides): FormState {
  const strs = <T extends string>(o: Partial<Record<T, number>> | undefined) =>
    Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, toStr(v as number)])) as Partial<Record<T, string>>;
  return {
    pathId: input.pathId, level: input.level, days: toStr(input.days),
    metrics: strs<MetricKey>(input.metrics), eco: strs<keyof Economics>(input.economics), presetId, overrides,
  };
}

/** bad = id field yang isinya tidak bisa dibaca sebagai angka (kosong bukan bad). */
export function parseForm(f: FormState): { input: DiagnosisInput; bad: string[] } {
  const bad: string[] = [];
  const num = (s: string | undefined, id: string): number | undefined => {
    if (s == null || s.trim() === '') return undefined;
    const n = parseID(s);
    if (n == null) bad.push(id);
    return n ?? undefined;
  };
  const metrics: DiagnosisInput['metrics'] = {};
  for (const [k, v] of Object.entries(f.metrics) as [MetricKey, string][]) {
    const n = num(v, k);
    if (n != null) metrics[k] = n;
  }
  const economics: Economics = {};
  for (const [k, v] of Object.entries(f.eco) as [keyof Economics, string][]) {
    const n = num(v, k);
    if (n != null) economics[k] = n;
  }
  const days = num(f.days, 'days');
  return {
    input: { pathId: f.pathId, level: f.level, days: days ?? NaN, metrics, economics: Object.keys(economics).length ? economics : undefined },
    bad,
  };
}

/** Field wajib (termasuk hari berjalan) yang masih kosong. */
export function missingRequired(f: FormState): string[] {
  const cfg = PATHS[f.pathId];
  if (!cfg) return ['pathId'];
  const empty = (s?: string) => s == null || s.trim() === '';
  const missing = fieldsFor(cfg, f.level).required.filter((k) => empty(f.metrics[k]));
  return empty(f.days) ? ['days', ...missing] : missing;
}
```

`src/lib/share.ts`

```ts
import { PATHS } from '../config/meta/paths';
import type { ThOverrides } from '../config/meta/thresholds';
import type { DiagnosisInput } from '../engine/types';

export interface SharedState { input: DiagnosisInput; presetId: string; overrides: ThOverrides }

/** State → base64url (aman untuk query string, mendukung karakter non-ASCII). */
export function encodeState(s: SharedState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const isNumRecord = (o: unknown): o is Record<string, number> =>
  typeof o === 'object' && o !== null && Object.values(o).every((v) => typeof v === 'number');

function isState(s: unknown): s is SharedState {
  const x = s as SharedState;
  const i = x?.input;
  return (
    !!i && typeof i.pathId === 'string' && i.pathId in PATHS &&
    ['campaign', 'adset', 'ad'].includes(i.level) &&
    (i.days === null || typeof i.days === 'number') && isNumRecord(i.metrics) &&
    (i.economics === undefined || isNumRecord(i.economics)) &&
    typeof x.presetId === 'string' && typeof x.overrides === 'object' && x.overrides !== null
  );
}

/** Kembalikan null untuk link rusak atau hasil edit manual yang tidak valid. */
export function decodeState(raw: string): SharedState | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const s = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (s?.input && s.input.days === null) s.input.days = NaN; // NaN → null saat JSON
    return isState(s) ? s : null;
  } catch {
    return null;
  }
}
```

`src/lib/storage.ts`

```ts
import type { Level } from '../engine/types';
import type { ThOverrides } from '../config/meta/thresholds';

const HISTORY_KEY = 'ads-diag:history:v1';
const SETTINGS_KEY = 'ads-diag:settings:v1';
export const MAX_HISTORY = 50;

export interface HistoryEntry {
  id: string;
  at: string;
  label: string;
  kondisi: string;
  pathLabel: string;
  level: Level;
  /** encodeState(...) — dibuka lewat /diagnosis?s=<state>. */
  state: string;
}

export interface Settings { presetId: string; overrides: ThOverrides }

// localStorage bisa melempar error (mode privat, data situs diblokir); semuanya dianggap "kosong".
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* abaikan */ }
}

export function loadHistory(): HistoryEntry[] {
  const list = read<unknown>(HISTORY_KEY, []);
  return Array.isArray(list) ? (list as HistoryEntry[]) : [];
}

export function addHistory(e: Omit<HistoryEntry, 'id' | 'at'>): void {
  const entry: HistoryEntry = { ...e, id: crypto.randomUUID(), at: new Date().toISOString() };
  write(HISTORY_KEY, [entry, ...loadHistory()].slice(0, MAX_HISTORY));
}

export const removeHistory = (id: string) => write(HISTORY_KEY, loadHistory().filter((h) => h.id !== id));
export const clearHistory = () => write(HISTORY_KEY, []);

export const loadSettings = (): Settings => read<Settings>(SETTINGS_KEY, { presetId: 'ecommerce', overrides: {} });
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);
```

`src/config/meta/samples.ts`

```ts
import type { DiagnosisInput } from '../../engine/types';

export interface Sample { id: string; label: string; input: DiagnosisInput }

const economics = { price: 149000, cost: 45000 };
const base = { pathId: 'sales_website', level: 'campaign', days: 5, economics } as const;

/** Skenario Website Purchase untuk tombol "Coba Skenario". Urutan = urutan putar. */
export const SAMPLES: Sample[] = [
  {
    id: 'sehat', label: 'Semua sehat',
    input: { ...base, days: 6, metrics: { spend: 520000, impressions: 15000, reach: 8333, linkClicks: 250, lpv: 200, initiateCheckout: 50, purchases: 20 } },
  },
  {
    id: 'lp', label: 'Bottleneck landing page',
    input: { ...base, metrics: { spend: 350000, impressions: 30000, reach: 22000, linkClicks: 400, lpv: 260, initiateCheckout: 24, purchases: 6 } },
  },
  {
    id: 'checkout', label: 'Bottleneck checkout',
    input: { ...base, metrics: { spend: 400000, impressions: 20000, reach: 15000, linkClicks: 300, lpv: 240, initiateCheckout: 60, purchases: 5 } },
  },
  {
    id: 'rugi', label: 'Rugi',
    input: { ...base, metrics: { spend: 600000, impressions: 30000, reach: 22000, linkClicks: 300, lpv: 240, initiateCheckout: 20, purchases: 5 } },
  },
];
```

- [ ] **Step 4: Jalankan seluruh test**

Run: `npm test`
Expected: PASS, **139 test** di 6 file.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/config/meta/samples.ts
git commit -m "feat: form parsing, share URL, localStorage history, sample scenarios"
```

---

### Task 9: Tema global dan layout

Sebelum menulis komponen visual, jalankan skill `ui-ux-pro-max:ui-ux-pro-max` untuk meninjau token warna/tipografi di bawah (dark navy, teal/amber/merah, Plus Jakarta Sans). Bila skill menyarankan perubahan token, ubah di `globals.css` saja; komponen memakai nama token (`bg-navy`, `text-teal`, dst.).

**Files:**
- Create: `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Step 1: `globals.css`** (token, fokus, reduced-motion, gaya cetak)

`src/app/globals.css`

```css
@import "tailwindcss";

@theme {
  --color-navy: #0b1220;
  --color-panel: #111a2e;
  --color-panel2: #172440;
  --color-line: #263654;
  --color-fg: #e8eef8;
  --color-dim: #9fb0cc;
  --color-teal: #2dd4bf;
  --color-amber: #fbbf24;
  --color-rose: #fb7185;
  --color-slate: #94a3b8;
  --font-sans: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
}

html { scroll-behavior: smooth; }
body { background: var(--color-navy); color: var(--color-fg); font-family: var(--font-sans); }

:focus-visible { outline: 2px solid var(--color-teal); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { transition: none !important; animation: none !important; }
}

/* Cetak / PDF: paksa terang, sembunyikan form dan navigasi, sisakan hasil. */
@media print {
  :root {
    --color-navy: #fff; --color-panel: #fff; --color-panel2: #f3f5f9; --color-line: #cbd5e1;
    --color-fg: #0f172a; --color-dim: #475569; --color-teal: #0f766e; --color-amber: #b45309; --color-rose: #b91c1c;
  }
  .no-print { display: none !important; }
  body { background: #fff; }
}
```

- [ ] **Step 2: `layout.tsx`** (font, metadata, navigasi)

`src/app/layout.tsx`

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: theme tokens, layout, navigation"
```

---

### Task 10: Komponen form (konteks, metrik, economics, pengaturan lanjutan)

**Files:**
- Create: `src/components/NumberField.tsx`, `src/components/ContextPicker.tsx`, `src/components/MetricForm.tsx`, `src/components/AdvancedSettings.tsx`

- [ ] **Step 1: `NumberField.tsx`**

`src/components/NumberField.tsx`

```tsx
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
```

- [ ] **Step 2: `ContextPicker.tsx`**

`src/components/ContextPicker.tsx`

```tsx
'use client';

import { LEVELS, OBJECTIVES, PATHS, PATH_LIST } from '@/config/meta/paths';
import type { Level } from '@/engine/types';

interface Props {
  pathId: string;
  level: Level;
  onPath: (id: string) => void;
  onLevel: (l: Level) => void;
}

const pill = (on: boolean) =>
  `rounded-full border px-3.5 py-2 text-sm transition-colors ${
    on ? 'border-teal bg-teal/15 text-teal' : 'border-line text-dim hover:border-dim hover:text-fg'
  }`;

export function ContextPicker({ pathId, level, onPath, onLevel }: Props) {
  const cfg = PATHS[pathId];
  const paths = PATH_LIST.filter((p) => p.objective === cfg.objective);
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">1. Objective kampanye</legend>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={cfg.objective === o.id}
              className={pill(cfg.objective === o.id)}
              onClick={() => onPath(PATH_LIST.find((p) => p.objective === o.id)!.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">2. Hasil yang dikejar</legend>
        <div className="flex flex-wrap gap-2">
          {paths.map((p) => (
            <button key={p.id} type="button" aria-pressed={pathId === p.id} className={pill(pathId === p.id)} onClick={() => onPath(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">3. Level yang dibaca</legend>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l.id} type="button" aria-pressed={level === l.id} className={pill(level === l.id)} onClick={() => onLevel(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 3: `MetricForm.tsx`** (juga memuat `EconomicsForm`)

`src/components/MetricForm.tsx`

```tsx
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
```

- [ ] **Step 4: `AdvancedSettings.tsx`**

`src/components/AdvancedSettings.tsx`

```tsx
'use client';

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
  const setOne = (key: string, side: 'sehat' | 'kritis', raw: string) => {
    const n = parseID(raw);
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
                      value={form.overrides[key]?.sehat != null ? String(form.overrides[key]!.sehat).replace('.', ',') : ''}
                      onChange={(e) => setOne(key, 'sehat', e.target.value)} />
                  </label>
                  <label className="flex items-center gap-1 text-dim">Kritis
                    <input aria-label={`${label} batas kritis`} className={input} inputMode="decimal" placeholder={fmtNum(t.kritis, 2)}
                      value={form.overrides[key]?.kritis != null ? String(form.overrides[key]!.kritis).replace('.', ',') : ''}
                      onChange={(e) => setOne(key, 'kritis', e.target.value)} />
                  </label>
                </div>
              );
            })}
          </div>
          {Object.keys(form.overrides).length > 0 && (
            <button type="button" onClick={() => onOverrides({})} className="mt-3 text-sm text-teal underline underline-offset-2">Reset semua override</button>
          )}
        </div>
      </div>
    </details>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/NumberField.tsx src/components/ContextPicker.tsx src/components/MetricForm.tsx src/components/AdvancedSettings.tsx
git commit -m "feat: form components"
```

---

### Task 11: Komponen hasil dan share/export

**Files:**
- Create: `src/components/ResultView.tsx`, `src/components/ShareExport.tsx`

- [ ] **Step 1: `ResultView.tsx`** (header status, KPI, funnel bar, narasi, aksi; tanpa hook agar bisa dirender di landing)

`src/components/ResultView.tsx`

```tsx
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
```

- [ ] **Step 2: `ShareExport.tsx`** (salin link, PNG lewat html-to-image, cetak/PDF)

`src/components/ShareExport.tsx`

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultView.tsx src/components/ShareExport.tsx
git commit -m "feat: result view and share/export"
```

---

### Task 12: Halaman `/diagnosis`

**Files:**
- Create: `src/components/DiagnosisApp.tsx`, `src/app/diagnosis/page.tsx`

- [ ] **Step 1: `DiagnosisApp.tsx`** (state form, validasi langsung, Analyze, Coba Skenario, riwayat, URL share)

`src/components/DiagnosisApp.tsx`

```tsx
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
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [notice, setNotice] = useState('');
  const [sampleIdx, setSampleIdx] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const run = (f: FormState, save: boolean) => {
    const { input } = parseForm(f);
    const r = diagnose(input, resolvePreset(f.presetId, f.overrides));
    setResult(r);
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
      {notice && <p role="status" className="no-print rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-dim">{notice}</p>}

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

      <div id="hasil" ref={resultRef} className="scroll-mt-4 space-y-4">
        {result && (
          <>
            <div className="space-y-4 bg-navy">
              <p className="text-sm text-dim">
                {PATHS[form.pathId].label} · {LEVELS.find((l) => l.id === form.level)?.label} · {input.days} hari
              </p>
              <ResultView r={result} levelLabel={LEVELS.find((l) => l.id === form.level)?.label} />
            </div>
            {result.code !== 'invalid' && <ShareExport target={resultRef} fileName={`diagnosis-${form.pathId}-${form.level}`} />}
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: `page.tsx`**

`src/app/diagnosis/page.tsx`

```tsx
import type { Metadata } from 'next';
import { DiagnosisApp } from '@/components/DiagnosisApp';

export const metadata: Metadata = { title: 'Diagnosis — Meta Ads Diagnostic' };

export default function Page() {
  return <DiagnosisApp />;
}
```

- [ ] **Step 3: Cek di browser**

Run: `npm run dev`
Expected: server jalan di `http://localhost:3000`. Buka `http://localhost:3000/diagnosis/`, klik **Coba Skenario**: hasil `SCALE AGRESIF` muncul, URL berubah menjadi `?s=...`. Ganti Objective ke Awareness: field berubah dan Analyze nonaktif sampai wajib terisi.

- [ ] **Step 4: Commit**

```bash
git add src/components/DiagnosisApp.tsx src/app/diagnosis
git commit -m "feat: /diagnosis page"
```

---

### Task 13: Halaman `/riwayat`

**Files:**
- Create: `src/components/HistoryList.tsx`, `src/app/riwayat/page.tsx`

- [ ] **Step 1: `HistoryList.tsx`**

`src/components/HistoryList.tsx`

```tsx
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
```

- [ ] **Step 2: `page.tsx`**

`src/app/riwayat/page.tsx`

```tsx
import type { Metadata } from 'next';
import { HistoryList } from '@/components/HistoryList';

export const metadata: Metadata = { title: 'Riwayat — Meta Ads Diagnostic' };

export default function Page() {
  return <HistoryList />;
}
```

- [ ] **Step 3: Cek di browser**

Di `/diagnosis/` isi angka manual, klik Analyze, lalu buka `/riwayat/`. Expected: satu entri muncul, klik membuka ulang hasil identik, tombol Hapus dan Hapus semua bekerja, dan entri bertahan setelah refresh. (Coba Skenario tidak menyimpan riwayat, memang disengaja.)

- [ ] **Step 4: Commit**

```bash
git add src/components/HistoryList.tsx src/app/riwayat
git commit -m "feat: /riwayat page"
```

---

### Task 14: Landing `/` dan `/panduan`

**Files:**
- Create: `src/app/page.tsx`, `src/app/panduan/page.tsx`

- [ ] **Step 1: `page.tsx`** (hook, contoh hasil nyata dari engine, 3 langkah, CTA)

`src/app/page.tsx`

```tsx
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
```

- [ ] **Step 2: `panduan/page.tsx`** (cara ambil angka, arti status, tabel threshold dari config)

`src/app/panduan/page.tsx`

```tsx
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
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sukses, 7 halaman statis (`/`, `/_not-found`, `/diagnosis`, `/panduan`, `/riwayat`).

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/panduan
git commit -m "feat: landing and guide pages"
```

---

### Task 15: Polish UI/UX dan QA

- [ ] **Step 1: Tinjauan desain**

Jalankan skill `ui-ux-pro-max:ui-ux-pro-max` pada `/`, `/diagnosis`, dan hasil. Fokus: hierarki visual status, kontras, target sentuh ≥ 44 px, jarak di 360 px. Terapkan perbaikan yang relevan lewat token/kelas Tailwind (tanpa mengubah engine).

- [ ] **Step 2: QA checklist (Spec §7)**

Cek satu per satu di browser (Chrome, `npx serve out`):
- [ ] Setiap kombinasi Objective × Hasil × Level merender field yang benar (Ad Set mewajibkan Reach; Ad menampilkan 3-sec plays/ThruPlays opsional).
- [ ] Angka 0, kosong, dan koma desimal diproses benar; paste `Rp1.250.000` diterima.
- [ ] Link share (`Salin link`) dibuka di jendela penyamaran menghasilkan hasil identik; link dengan `?s=ngawur` menampilkan pesan dan form kosong.
- [ ] Riwayat bertahan setelah refresh dan bisa dihapus; `localStorage` diblokir tidak membuat halaman error.
- [ ] Layar 360 px: form satu kolom, KPI dua kolom, tidak ada scroll horizontal. Desktop juga rapi.
- [ ] Unduh PNG menghasilkan gambar hasil; Cetak/PDF hanya berisi hasil (form dan nav tersembunyi, latar terang).
- [ ] Tab Network di DevTools: tidak ada request yang membawa angka input.
- [ ] Semua teks status dan aksi berbahasa Indonesia yang konsisten.

- [ ] **Step 3: Lighthouse**

DevTools → Lighthouse (Mobile) pada `/` dan `/diagnosis/`. Target ≥ 90. Bila di bawah, perbaiki temuan yang jelas (biasanya kontras atau label), lalu ulang.

- [ ] **Step 4: Verifikasi akhir**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 139 test lulus, typecheck bersih, build sukses.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: UI polish and QA fixes"
```

---

### Task 16: Deploy (butuh aksi pemilik akun)

Langkah ini mempublikasikan ke internet, jadi lakukan bersama pemilik proyek, bukan otomatis.

- [ ] **Step 1:** Buat repo GitHub dan `git remote add origin <url>` lalu `git push -u origin main`.
- [ ] **Step 2:** Di Vercel: Import Project dari repo itu. Framework Next.js terdeteksi otomatis; `output: 'export'` menghasilkan situs statis.
- [ ] **Step 3:** (Opsional) Hubungkan domain sendiri dan aktifkan Vercel Analytics atau Plausible. Analytics tidak boleh membawa angka input.
- [ ] **Step 4:** Buka URL produksi dan ulangi cek Coba Skenario + link share.

---

## Setelah MVP (di luar rencana ini)

Beta tertutup 5–10 advertiser untuk kalibrasi threshold bertanda Default dan `[baru]`; lalu Fase 2 di spec §8 (pembanding 2 periode, license key, platform lain).
