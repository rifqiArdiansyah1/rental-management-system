# Dokumen Arsitektur Sistem — Platform Rental Mobil Multi-Cabang

**Versi:** 1.2
**Tanggal:** 2 Agustus 2026
**Status:** Draft untuk tahap perencanaan MVP
**Perubahan v1.1:** Menambahkan dukungan opsi rental dengan sopir (entitas Driver, alur penugasan sopir, penyesuaian harga)
**Perubahan v1.2:** Penyesuaian stack untuk eksekusi solo developer dalam 29 hari (lihat bagian 12)

---

## 1. Ringkasan Eksekutif

Sistem ini dirancang untuk CV rental mobil dengan rencana operasional multi-cabang, melayani dua sisi pengguna utama:

1. **Customer** — mencari, membandingkan, dan memesan mobil secara online lengkap dengan pembayaran digital.
2. **Internal perusahaan** — staf cabang dan admin pusat mengelola armada, jadwal, booking, dan laporan lintas cabang.

Prioritas tahap MVP: **booking dan pembayaran online untuk customer**, dengan fondasi data yang sudah siap untuk skala multi-cabang sejak awal, sehingga fase internal ops (fase 2) bisa dibangun di atas struktur yang sama tanpa migrasi besar.

---

## 2. Prinsip Desain

- **Branch-aware dari hari pertama.** Setiap entitas operasional (mobil, booking, staf) terikat ke `branch_id`. Ini mencegah refactor besar saat cabang baru dibuka.
- **Konsistensi ketersediaan mobil adalah prioritas tertinggi.** Race condition (dua customer booking mobil yang sama secara bersamaan) ditangani dengan distributed lock, bukan hanya validasi database biasa.
- **Pemisahan tanggung jawab yang jelas** antara aplikasi customer (public, dioptimalkan SEO) dan dashboard internal (protected, role-based).
- **Minim ketergantungan infrastruktur di awal.** Semua komponen dipilih agar bisa jalan dengan biaya rendah saat MVP, tapi tidak perlu diganti total saat scale-up.

---

## 3. Arsitektur Tingkat Tinggi

```
┌─────────────────────┐      ┌─────────────────────┐
│  Customer Web App    │      │   Admin Dashboard    │
│  (Next.js, public)   │      │  (Next.js, protected)│
└──────────┬───────────┘      └───────────┬──────────┘
           │                              │
           └──────────────┬───────────────┘
                           ▼
                ┌─────────────────────┐
                │  API & Backend Layer │
                │  (Next.js API/tRPC)  │
                └──────────┬───────────┘
        ┌──────────┬───────┼───────────┬────────────┐
        ▼          ▼       ▼           ▼            ▼
   PostgreSQL   Redis   Payment      File        WhatsApp/
   (Neon)     (Upstash) Gateway    Storage (R2)  Email API
                        (Midtrans/
                         Xendit)
```

---

## 4. Tech Stack & Rasionalisasi

| Layer | Teknologi | Alasan Pemilihan |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript | Satu codebase untuk customer & admin, SSR baik untuk SEO katalog mobil |
| Styling | Tailwind CSS | Development cepat, mudah dipelihara |
| Database | PostgreSQL (Neon, serverless) | Relasional, kuat untuk transaksi booking & laporan lintas cabang |
| ORM | Prisma | Type-safe query, migrasi terkelola dengan baik |
| Cache & Locking | Redis (Upstash) | Distributed lock untuk mencegah double booking |
| Payment Gateway | Midtrans / Xendit | Dukung VA, e-wallet, QRIS, kartu kredit; dokumentasi matang untuk Next.js |
| File Storage | Cloudflare R2 | S3-compatible, murah, cocok untuk foto mobil, dokumen KTP/SIM, kontrak |
| Notifikasi | WhatsApp API (Fonnte/Wablas) + Resend (email) | WA adalah channel dominan untuk konfirmasi booking di Indonesia |
| Auth | NextAuth / Clerk, role-based access control | Role: customer, staff cabang, admin cabang, admin pusat |
| Hosting | Vercel (app), Neon (DB) | Auto-scaling, deployment cepat, cocok untuk tim kecil |

---

## 5. Model Data Inti (ERD Ringkas)

```
Branch (1) ──< (N) Vehicle
Branch (1) ──< (N) Driver
Branch (1) ──< (N) User (staff, nullable untuk admin pusat)
VehicleCategory (1) ──< (N) Vehicle
Customer (1) ──< (N) Booking
Vehicle (1) ──< (N) Booking
Driver (1) ──< (N) Booking (nullable, hanya terisi jika rental_type = with_driver)
Branch (1) ──< (N) Booking (sebagai pickup_branch & return_branch)
Booking (1) ──< (N) Payment
Customer (1) ──< (N) Document (KTP, SIM)
Booking (1) ──< (N) Document (kontrak)
```

### Detail Entitas

**Branch**
- `id`, `name`, `city`, `address`, `phone`, `is_active`

**Vehicle**
- `id`, `branch_id`, `category_id`, `plate_number`, `daily_rate`
- `status`: `available` | `rented` | `maintenance` | `moved`

**VehicleCategory**
- `id`, `name`, `capacity`, `transmission`, `features` (JSON: AC, GPS bawaan, dll.)

**Customer**
- `id`, `name`, `email`, `phone`, `ktp_number`, `sim_number`
- `verification_status`: `pending` | `verified` | `rejected`

**Booking**
- `id`, `customer_id`, `vehicle_id`
- `pickup_branch_id`, `return_branch_id` (mendukung rental one-way ke depannya)
- `start_date`, `end_date`
- `rental_type`: `self_drive` | `with_driver`
- `driver_id` (nullable — terisi setelah admin menugaskan sopir; null jika `self_drive`)
- `driver_assignment_status` (nullable): `unassigned` | `assigned` | `confirmed` — hanya relevan jika `rental_type = with_driver`
- `status`: `pending_payment` | `confirmed` | `ongoing` | `completed` | `cancelled`
- `total_price` (mencakup `vehicle_price` + `driver_fee` jika dengan sopir)

**Driver**
- `id`, `branch_id`, `name`, `phone`, `license_number` (SIM A/B sesuai kategori kendaraan)
- `status`: `available` | `on_trip` | `off_duty`
- `daily_fee` (bisa override tarif default cabang jika sopir senior/khusus)

**Payment**
- `id`, `booking_id`, `method`, `amount`
- `status`: `pending` | `success` | `failed` | `refunded`
- `gateway_reference`

**Document**
- `id`, `owner_type` (customer/booking), `owner_id`, `type` (ktp/sim/kontrak), `file_url`, `verified_at`

**User (staff internal)**
- `id`, `name`, `email`, `role` (`staff_cabang` | `admin_cabang` | `admin_pusat`)
- `branch_id` (null jika admin pusat — bisa akses semua cabang)

---

## 6. Alur Booking & Penanganan Concurrency

Ini adalah bagian paling kritis dari sistem — mencegah dua customer memesan mobil yang sama di waktu yang sama.

1. Customer memilih mobil, tanggal, dan cabang pickup/return.
2. Sistem membuat **lock sementara** di Redis untuk kombinasi `vehicle_id + date_range` (TTL misalnya 10 menit).
3. Customer melanjutkan ke pembayaran (redirect ke Midtrans/Xendit).
4. Jika pembayaran **berhasil** (via webhook dari payment gateway):
   - Booking status diubah menjadi `confirmed` di PostgreSQL.
   - Lock Redis dihapus (sudah tidak diperlukan, status sudah permanen di DB).
5. Jika pembayaran **gagal atau timeout**:
   - Lock otomatis expired di Redis.
   - Mobil kembali tersedia untuk customer lain.

Validasi ketersediaan **selalu double-check** ke PostgreSQL sebagai source of truth final sebelum konfirmasi, Redis hanya sebagai lapisan pencegahan race condition saat proses berlangsung.

### 6.1 Alur Penugasan Sopir (untuk `rental_type = with_driver`)

Berbeda dari mobil, sopir **tidak dipilih langsung oleh customer** — customer hanya memilih opsi "dengan sopir" saat booking, lalu admin cabang yang menugaskan sopir yang tersedia. Ini pola umum di bisnis rental sekelas CV dan menghindari kompleksitas *matching* otomatis di tahap awal.

1. Customer memilih `rental_type = with_driver` saat booking. Harga otomatis bertambah `driver_fee` per hari.
2. Setelah pembayaran berhasil dan booking `confirmed`, `driver_assignment_status` diset `unassigned`.
3. Admin cabang membuka daftar sopir yang tersedia di cabang tersebut untuk rentang tanggal booking (query sederhana: sopir dengan `status = available` dan tidak punya booking lain yang tanggalnya beririsan — cukup validasi di level database, tidak perlu lock Redis karena ini aksi staf, bukan aksi concurrent oleh banyak customer).
4. Admin menugaskan sopir → `driver_id` terisi, `driver_assignment_status = assigned`.
5. Sistem mengirim notifikasi ke customer (nama & kontak sopir) dan idealnya juga ke sopir (fase lanjutan, lihat catatan di bawah).

**Catatan untuk fase lanjutan:** MVP cukup dengan penugasan manual oleh admin. Jika volume booking-dengan-sopir sudah tinggi, baru pertimbangkan portal/app sederhana untuk sopir melihat jadwalnya sendiri (fase 3).

---

## 7. Modul Sistem

### 7.1 Sisi Customer (Prioritas MVP)
- Landing page & katalog mobil (filter: kota/cabang, tanggal, kategori, transmisi)
- Halaman detail mobil dengan galeri foto
- Pilihan **self-drive** atau **dengan sopir** saat booking (harga menyesuaikan otomatis)
- Alur booking: pilih tanggal → cek ketersediaan real-time → isi data & upload KTP/SIM → bayar
- Riwayat booking & status pemesanan (termasuk info sopir jika ditugaskan)
- Notifikasi WA/email otomatis (konfirmasi, info sopir, reminder H-1, invoice)

### 7.2 Sisi Internal
**Termasuk di MVP (karena opsi sopir sudah jadi bagian dari alur inti):**
- Manajemen data sopir per cabang (tambah/edit sopir, status ketersediaan)
- Panel penugasan sopir untuk booking `with_driver` (lihat 6.1)
- Dashboard admin cabang: kelola ketersediaan mobil, approve/reject booking manual, verifikasi dokumen customer

**Fase 2 (dibangun setelah MVP stabil):**
- Dashboard admin pusat: laporan lintas cabang (okupansi, revenue, mobil & sopir paling laku), manajemen staf & cabang
- Manajemen maintenance armada (jadwal servis, riwayat perbaikan)
- Generate kontrak & invoice otomatis (PDF)
- Aturan harga dinamis (musiman, per cabang)

---

## 8. Keamanan & Kepatuhan Data

- **Data KTP/SIM** disimpan di Cloudflare R2 dengan akses terbatas (signed URL, bukan public bucket), karena termasuk data pribadi sensitif.
- **Pembayaran** sepenuhnya diproses oleh payment gateway (Midtrans/Xendit) — sistem internal tidak pernah menyimpan data kartu kredit mentah, hanya referensi transaksi.
- **Role-based access control (RBAC)** memastikan staf cabang hanya bisa melihat/mengelola data cabangnya sendiri, sementara admin pusat punya akses lintas cabang.
- **Audit log** untuk aksi-aksi sensitif di dashboard internal (perubahan status booking, verifikasi dokumen, perubahan harga).

---

## 9. Roadmap Bertahap

### Fase 1 — MVP (Fokus Customer)
- Katalog mobil per cabang/kota dengan pencarian & filter
- Alur booking end-to-end + integrasi payment gateway
- Opsi self-drive vs dengan sopir, termasuk penugasan sopir manual oleh admin
- Verifikasi dokumen customer (upload KTP/SIM)
- Notifikasi otomatis via WA/email
- Dashboard admin dasar (per cabang): approve booking, atur ketersediaan mobil & sopir

### Fase 2 — Operasional Internal
- Manajemen maintenance & jadwal armada
- Generate kontrak/invoice otomatis
- Dashboard laporan lintas cabang untuk admin pusat
- Aturan harga dinamis

### Fase 3 — Scale & Ekspansi
- Rental one-way antar cabang (pickup ≠ return branch, sudah didukung skema data sejak awal)
- Portal/app sederhana untuk sopir melihat jadwal & trip-nya sendiri
- GPS tracking armada real-time
- Program loyalitas customer
- Aplikasi mobile (React Native, reuse API yang sama)

---

## 10. Estimasi Struktur Tim & Effort (untuk MVP)

Mengingat ini kemungkinan dikerjakan dalam konteks agensi/freelance, berikut estimasi kasar area kerja untuk MVP:

| Area | Effort Relatif |
|---|---|
| Setup infrastruktur (DB, Redis, hosting, storage) | Kecil |
| Autentikasi & RBAC dasar | Kecil–Menengah |
| Katalog & pencarian mobil | Menengah |
| Alur booking + locking Redis | Menengah–Besar (bagian paling kritis) |
| Integrasi payment gateway + webhook | Menengah |
| Upload & verifikasi dokumen | Kecil–Menengah |
| Notifikasi WA/email | Kecil |
| Dashboard admin dasar | Menengah |

---

## 11. Catatan Lanjutan

Dokumen ini adalah fondasi arsitektur awal. Sebelum development dimulai, disarankan untuk memvalidasi beberapa poin berikut:
- Kebijakan **pembatalan & refund** (mempengaruhi state machine `Booking.status`)
- Apakah verifikasi dokumen customer perlu **manual review oleh staf** atau bisa semi-otomatis
- Struktur `driver_fee`: flat per hari, atau bervariasi per kategori mobil/jarak tempuh?
- Apakah satu sopir bisa ditugaskan lintas cabang (misal cabang kekurangan sopir), atau strict per cabang seperti mobil?

---

## 12. Penyesuaian Arsitektur untuk Eksekusi Solo (v1.2)

Karena proyek ini dikerjakan solo (full-stack) dalam window 29 hari, beberapa keputusan arsitektur di bagian 4 disederhanakan untuk mengurangi jumlah layanan eksternal yang harus di-setup, diintegrasikan, dan dipelihara sendiri — tanpa mengorbankan fondasi multi-cabang & dengan-sopir yang sudah dirancang di atas.

| Sebelumnya | Disederhanakan menjadi | Alasan |
|---|---|---|
| Redis (Upstash) untuk lock ketersediaan mobil | PostgreSQL `EXCLUDE` constraint (extension `btree_gist`) pada `(vehicle_id, daterange)` | Constraint di level database menjamin tidak ada booking yang overlap tanpa infra tambahan — satu request DB, bukan dua sistem yang harus disinkronkan |
| Neon (DB) + Cloudflare R2 (storage) + NextAuth (auth) — 3 layanan terpisah | **Supabase** (Postgres + Storage + Auth dalam satu platform) | Satu dashboard, satu SDK, satu kredensial — jauh lebih cepat untuk solo dev daripada wiring 3 layanan berbeda |
| UI pembayaran custom di atas API Midtrans/Xendit | **Midtrans Snap** (hosted checkout page) | Snap sudah punya halaman pembayaran siap pakai (VA, e-wallet, QRIS, kartu) — tinggal redirect & handle webhook, hemat beberapa hari kerja frontend |
| RBAC granular (`admin_cabang` vs `admin_pusat`) sejak MVP | 1 role admin generik + filter cabang di UI | Skema tetap branch-aware (`branch_id` tidak hilang), tapi logic akses disederhanakan. Role granular bisa masuk fase 2 tanpa migrasi skema |
| Notifikasi WA API + email sejak MVP | Email (**Resend**) dulu untuk MVP, WA API menyusul fase 2 | Integrasi WhatsApp Business API biasanya makan waktu approval nomor + template — tidak sepadan dikejar dalam 29 hari pertama |

**Stack akhir untuk 29 hari:** Vercel (hosting) + Supabase (DB, Auth, Storage) + Midtrans Snap (payment) + Resend (email). Empat layanan inti, bukan tujuh — realistis dikelola satu orang sambil ngoding fitur.

Catatan: exclusion constraint dan RBAC generik ini tetap kompatibel dengan rencana Redis/RBAC granular di fase 2+ (lihat bagian 9) — ini penyederhanaan urutan implementasi, bukan jalan buntu yang perlu dirombak nanti.
