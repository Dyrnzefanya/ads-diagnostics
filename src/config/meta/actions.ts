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
