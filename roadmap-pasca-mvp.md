# Roadmap Pasca-MVP — CV Rental Mobil

**Status:** Sprint 4 (testing, deploy, go-live) selesai — MVP live di production.
**Dokumen terkait:** `arsitektur-sistem-cv-rental-mobil.md` v1.2, `roadmap-29-hari-rental-mobil.md`

---

## 1. Prioritas Hardening (kerjakan duluan, sebelum fitur baru)

Ini bukan fitur baru — ini keputusan/gap yang sempat digantung selama review issue #5–#14 karena nggak blocking buat ship MVP, tapi sekarang berisiko nyata karena sistemnya udah pegang uang dan data pribadi customer sungguhan.

| # | Item | Kenapa mendesak sekarang |
|---|---|---|
| 1 | **Finalisasi same-day turnover** (`'[]'` vs `'[)'` di exclusion constraint mobil & sopir) | Ini pertanyaan yang muncul berulang dari Issue #5 sampai #11 dan belum pernah dapat jawaban final. Begitu ada customer nyata yang coba booking mobil di tanggal pengembalian mobil lain, perilakunya harus sudah pasti — bukan ketahuan pas komplain masuk. |
| 2 | **Putuskan & implementasikan branch scoping secara konsisten** | Sempat digantung di Issue #10 dan #11: staf cabang saat ini berpotensi lihat/operasikan booking & armada cabang lain. Kalau memang sudah beroperasi multi-cabang, ini bukan lagi "nice to have fase 2" — ini gap akses data antar cabang yang aktif. |
| 3 | **Audit jalur akses dokumen KTP/SIM oleh admin** | Konfirmasi ulang: RLS policy berbasis `app_metadata.role`, atau signed URL lewat service role? Pastikan yang jalan di production benar-benar salah satu dari itu, bukan default Supabase yang longgar. |
| 4 | **SOP manual-cancel untuk booking yang "nyangkut"** | Booking `confirmed` dengan dokumen `rejected` berkali-kali dan nggak pernah diupload ulang akan mengunci mobil selamanya (exclusion constraint menganggap `confirmed` aktif). Perlu proses (bisa manual dulu) buat admin membatalkan + refund kasus begini. |
| 5 | **Observability cron cleanup** | Sejak dipindah ke external scheduler (cron-job.org), belum ada alert kalau scheduler-nya berhenti jalan diam-diam. Tambahkan minimal: tampilkan umur booking `pending_payment` tertua di dashboard admin sebagai sinyal peringatan dini. |
| 6 | **Audit `Vehicle.status` di seluruh alur** | Statusnya cuma dijamin konsisten di jalur `startRental`/`endRental` (Issue #10). Cek apakah ada jalur lain (edit manual mobil, maintenance) yang bisa bikin status ini nggak sinkron dengan booking aktif. |
| 7 | **Reassignment sopir** | Belum ada jalur resmi ganti sopir kalau yang sudah di-assign berhalangan mendadak (sakit, dll). Ini akan kejadian cepat atau lambat begitu volume booking-dengan-sopir naik. |

---

## 2. Fase 2 — Operasional Internal

Sesuai rencana awal, plus beberapa penajaman dari hal-hal yang kita temukan selama review teknis.

- **Notifikasi WhatsApp otomatis** — gantikan/lengkapi email (Resend) sebagai channel utama, mengingat WA yang paling dicek customer Indonesia. Approval nomor bisnis WA butuh waktu, mulai proses ini di awal fase, jangan mepet.
- **RBAC granular penuh** (kalau belum kelar di hardening #2) — role `staff_cabang` vs `admin_cabang` vs `admin_pusat` benar-benar dibedakan wewenangnya, bukan cuma gerbang login.
- **Laporan lintas cabang untuk admin pusat** — okupansi, revenue, mobil & sopir paling laku, per cabang dan gabungan.
- **Kontrak & invoice otomatis (PDF)** — generate begitu booking `confirmed`, sekalian jadi dokumen resmi buat customer & arsip internal.
- **Manajemen maintenance armada** — jadwal servis, riwayat perbaikan, otomatis set `Vehicle.status = maintenance` dan otomatis balik `available` setelah selesai.
- **Aturan harga dinamis** — musiman, per cabang, atau per hari (weekday vs weekend).
- **Dashboard performa sopir** — turnaround time assignment, jumlah trip, dasar buat evaluasi kalau perlu nambah sopir di cabang tertentu.

## 3. Fase 3 — Scale & Ekspansi

- **Rental one-way antar cabang** — `pickupBranchId` ≠ `returnBranchId` sudah didukung skema sejak awal, tinggal desain logistik "siapa mindahin mobil balik" dan UI-nya.
- **Portal sederhana untuk sopir** — lihat jadwal trip sendiri, tanpa perlu telepon/tanya admin.
- **GPS tracking armada real-time.**
- **Program loyalitas customer.**
- **Aplikasi mobile** — reuse API/Server Actions yang sama, cuma lapisan presentasi baru.

---

## 4. Rekomendasi Urutan

1. **Hardening dulu, semuanya**, sebelum sentuh fitur fase 2 apa pun — ini fondasi kepercayaan (uang & data pribadi), bukan polish kosmetik.
2. Dari fase 2, mulai dari **WA notification** dan **laporan lintas cabang** — dua ini yang paling langsung kerasa dampaknya ke operasional harian begitu ada lebih dari satu cabang aktif.
3. Kontrak/invoice PDF dan manajemen maintenance menyusul — penting, tapi nggak seurgent dua di atas kalau volume booking masih kecil.
4. Fase 3 nunggu sampai ada sinyal bisnis nyata yang butuh (misal permintaan one-way baru masuk kalau customer beneran sering minta, bukan diasumsikan dari awal).

---

## 5. Metrik untuk Dipantau di Minggu-Minggu Pertama Live

- Insiden double-booking → target tetap **nol**, ini jaminan dari constraint database, worth dipantau untuk konfirmasi jaminan itu benar-benar berlaku di traffic nyata.
- Booking `pending_payment` yang stuck lebih dari threshold expiry → indikasi cron cleanup berhenti jalan.
- Waktu rata-rata dari booking `confirmed` sampai dokumen `verified` → kalau kelamaan, bottleneck di sisi admin, bukan customer.
- Waktu rata-rata penugasan sopir setelah booking masuk.
- Tingkat sukses webhook Midtrans (berapa persen yang perlu retry vs langsung sukses).
