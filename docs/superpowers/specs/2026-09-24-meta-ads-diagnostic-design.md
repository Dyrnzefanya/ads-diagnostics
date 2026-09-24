# Meta Ads Diagnostic Tool — Design Spec

Tanggal: 2026-09-24
Sumber utama: `Meta Ads Diagnostic Tool—Planning & Logika Keputusan.md` (selanjutnya "Dok Planning"). Spec ini **menang** atas Dok Planning bila keduanya berbeda.

## 1. Tujuan

Web app statis tanpa database. User memilih Objective × Hasil × Level, mengisi angka mentah dari Ads Manager, lalu mendapat satu keputusan tegas plus aksi (Sekarang / Jangan / Tahan / Checkpoint). Engine berupa fungsi murni berbasis config, deterministik, tanpa AI.

## 2. Keputusan stack (menyimpang dari Dok Planning)

| Area | Dok Planning | Spec ini | Alasan |
| --- | --- | --- | --- |
| Framework | Next.js 15 static export | sama | |
| UI | Tailwind + shadcn/ui | Tailwind v4 saja | Komponen sedikit, tidak perlu shadcn |
| Form | React Hook Form + Zod | `useState` + validasi di engine | Engine sudah punya gerbang validasi |
| State | Zustand persist | helper `localStorage` ±20 baris | Hanya riwayat dan override threshold |
| Export | html-to-image + jsPDF | html-to-image (PNG) + `window.print()` (PDF) | Hindari dependency PDF |
| Test | Vitest + Playwright | Vitest saja; alur UI dicek manual di browser | |

Dependency runtime tambahan: `html-to-image` saja.

## 3. Struktur kode

```
src/engine/   diagnose.ts (derive, validate, gates, funnel, economics, confidence, decide)
              narrate.ts  (narasi + pilih aksi)
              diagnose.test.ts
src/config/meta/  paths.ts (14 result path + stage), metrics.ts, thresholds.ts (+ preset), actions.ts
src/lib/      format.ts (parse "Rp1.250.000", koma desimal), share.ts (base64url ↔ state), history.ts
src/components/   ContextPicker, MetricForm, Result (header, KPI, funnel bar, narasi, aksi), ShareExport
src/app/      /  /diagnosis  /riwayat  /panduan
```

Setiap `ResultPathConfig` membawa `platform: 'meta'`; config di `config/meta/` agar multi-platform bisa ditambah tanpa mengubah engine. Selector platform tidak tampil di UI.

Alur: form (string) → `parseID()` → `diagnose(input, thresholds) → DiagnosisResult` (fungsi murni) → UI. Fungsi sama dipakai untuk riwayat dan link share.

## 4. Engine

Tipe, 14 result path, rumus turunan, rumus economics, threshold, preset, confidence, dan pustaka bottleneck mengikuti Dok Planning apa adanya. Gerbang berurutan: 0 Validasi → 1 Tracking → 2 Maturity → 3 Kill → 4 Funnel → 5 Economics tier → 6 Confidence + level filter.

### 4.1 Aturan penutup celah (baru, mengikat)

1. **Economics kosong** (path yang butuh economics): maturity hanya memakai hari berjalan (< 3 hari = TERLALU DINI); kill check dilewati; status maksimum OPTIMASI & PANTAU (tanpa SCALE); flag "economics belum diisi". Stage berbasis GP (CPC, CPA, CPL) berstatus `na`.
2. **Path tanpa economics** (Awareness, Traffic, Engagement, dan path lain bertanda "Tidak"): tidak ada tier. Ada stage Kritis → PERBAIKI [TAHAP] DULU. Tidak ada Kritis: ada Waspada → OPTIMASI & PANTAU; semua Sehat → SCALE BERTAHAP (Awareness tidak lebih tinggi dari SCALE BERTAHAP, Traffic/Engagement tetap memberi peringatan objective). Confidence Rendah → LANJUT TES.
3. **Matriks keputusan dievaluasi dari atas, baris pertama yang cocok menang.** Urutan prioritas: Rugi (Sedang/Tinggi → PAUSE & ITERASI; Rendah → LANJUT TES TERBATAS) → Tipis (PERBAIKI [TAHAP]) → Kritis (PERBAIKI [TAHAP]) → confidence Rendah non-Rugi (LANJUT TES) → Waspada saja (OPTIMASI & PANTAU) → Winning/Profitable tanpa bottleneck (SCALE sesuai tabel). Kritis + Rugi dan Tipis + Rendah karena itu tidak ambigu.
4. **Level Ad, tier Rugi dengan purchase > 0**: confidence Tinggi → MATIKAN CREATIVE; selain itu → LANJUT TES (2–3 hari). Pemetaan PAUSE & ITERASI → MATIKAN CREATIVE hanya berlaku untuk hasil 0 atau confidence Tinggi.
5. **Level Ad, maturity**: spend < 1× target keluar sebagai LANJUT TES, bukan TERLALU DINI. Hari < 3 tetap TERLALU DINI.
6. **CPC tanpa GP**: stage `na`, tidak ikut bottleneck maupun tier.

Profit ada tetapi hasil utama < 5 tidak pernah SCALE; statusnya LANJUT TES dengan catatan "kandidat winner, data masih tipis" (Dok Planning, aturan khusus Sales).

## 5. UI

4 route sesuai Dok Planning. `/diagnosis`: pilih konteks → metrik dinamis → economics opsional → hasil di bawah form (auto-scroll). Input format Indonesia, validasi langsung dengan pesan spesifik, tombol Coba Skenario (sehat / bottleneck LP / bottleneck checkout / rugi), Pengaturan lanjutan (preset + override threshold, tersimpan di localStorage), Salin link, Export PNG, Cetak/PDF. Hasil 6 blok tetap urutan. Catatan wajib di bawah hasil (Dok Planning bagian Struktur output).

Visual: dark navy, teal (sehat) / amber (waspada) / merah (kritis), abu-abu (data belum valid), Plus Jakarta Sans, mobile-first (360 px), funnel bar sebagai elemen pembeda. Detail visual disusun dengan skill ui-ux-pro-max saat implementasi. Semua teks UI berbahasa Indonesia.

## 6. Error handling & privasi

- Input salah → status DATA BELUM VALID + pesan per field, tanpa exception.
- Link share rusak/tidak valid → form kosong + pesan; tidak crash.
- `localStorage` tidak tersedia → riwayat nonaktif diam-diam (try/catch).
- Tidak ada request jaringan yang membawa angka user. Analytics (jika ada) tanpa data input.

## 7. Testing

Vitest pada engine:
- 10 test case Dok Planning (#5–#8 dilengkapi angka impresi/klik agar status yang diharapkan tercapai).
- 1 test per aturan penutup celah (6).
- Minimal 1 skenario per result path (14).
- Kasus batas: angka 0, semua stage `na`, threshold override, preset industri.
Target ≥ 40 test hijau sebelum UI dibangun.

Pengecekan manual di browser: QA checklist Dok Planning (kombinasi konteks, share link identik, riwayat setelah refresh, 360 px dan desktop, tidak ada request jaringan berisi angka).

## 8. Di luar scope (Fase 2)

Pembanding 2 periode, license key/paywall, Meta Marketing API, platform selain Meta, Playwright.

## 9. Batas produk

Tool tidak menebak data kosong, tidak menilai creative secara visual, tidak memberi keputusan scale di level Ad. Semua threshold bertanda "Default" adalah titik awal dan harus dikalibrasi dari data beta.
