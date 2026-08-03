# GitHub Issues Plan - Rental Mobil (29 Hari)

Dokumen ini berisi daftar issue yang siap disalin (copy-paste) ke GitHub Issues atau platform manajemen proyek (Jira/Trello). Issue ini disusun berdasarkan roadmap 29 hari dan dokumen arsitektur v1.2.

---

## 🎯 Label yang Disarankan
Buat label-label berikut di repositori sebelum membuat issue:
- `sprint-0` (Fondasi Teknis)
- `sprint-1` (Data, Auth, Katalog)
- `sprint-2` (Booking & Pembayaran)
- `sprint-3` (Dokumen, Email, Admin)
- `sprint-4` (QA, Deploy, Launch)
- `frontend`
- `backend`
- `integration`
- `qa`

---

## 📦 SPRINT 0 (Hari 1-2): Fondasi Teknis

### Issue #1: Setup Repository, Framework & Infrastruktur Dasar
**Labels:** `sprint-0`, `backend`, `frontend`
**Assignee:** Solo Developer

**Deskripsi:**
Melakukan inisialisasi proyek Next.js 15, konfigurasi awal Supabase, dan setup deployment pipeline ke Vercel agar CI/CD siap sejak awal. Selain itu, mendaftarkan akun Midtrans untuk persiapan payment gateway.

**Task List:**
- [ ] Inisialisasi Next.js 15 (App Router) + TypeScript + Tailwind CSS.
- [ ] Setup linting (ESLint, Prettier).
- [ ] Buat project baru di Supabase.
- [ ] Koneksikan repository ke Vercel dan pastikan deployment awal sukses.
- [ ] Daftar akun merchant Midtrans (Environment Sandbox & Production).
- [ ] Setup environment variables (`.env.local`) untuk Supabase, Midtrans, dan URL aplikasi.

**Acceptance Criteria:**
- Website skeleton bisa diakses melalui URL Vercel.
- Koneksi ke database Supabase berhasil (tes query sederhana).

---

## 📦 SPRINT 1 (Hari 3-8): Data, Auth, & Katalog

### Issue #2: Desain Skema Database & Migrasi Prisma/Supabase
**Labels:** `sprint-1`, `backend`
**Assignee:** Solo Developer

**Deskripsi:**
Membuat skema database untuk entitas operasional rental mobil. Kunci utama di tahap ini adalah menerapkan constraint anti-double-booking.

**Task List:**
- [ ] Setup Prisma ORM atau Supabase SQL.
- [ ] Buat tabel: `Branch`, `Vehicle`, `VehicleCategory`, `Driver`, `Customer`, `Booking`, `Payment`, `Document`.
- [ ] Buat relasi antar tabel sesuai ERD di dokumen arsitektur.
- [ ] Buat PostgreSQL `EXCLUDE` constraint (dengan `btree_gist`) pada kombinasi `(vehicle_id, daterange)` di tabel `Booking` untuk mencegah double booking.

**Acceptance Criteria:**
- Skema ter-deploy ke Supabase.
- Constraint overlap berjalan (percobaan insert jadwal bentrok akan error).

### Issue #3: Setup Autentikasi (Customer & Admin)
**Labels:** `sprint-1`, `backend`, `frontend`
**Assignee:** Solo Developer

**Deskripsi:**
Mengimplementasikan fitur login/register menggunakan Supabase Auth dan menyiapkan dummy data untuk testing.

**Task List:**
- [ ] Setup Supabase Auth untuk Customer (Register & Login dengan Email/Password).
- [ ] Setup login untuk Admin (Satu role admin generik dengan filter cabang).
- [ ] Buat halaman Login & Register untuk Customer.
- [ ] Buat halaman Login khusus Admin.
- [ ] Buat seed script untuk memasukkan data dummy (Cabang, Kategori, Mobil, Sopir, dan akun Admin).

**Acceptance Criteria:**
- Customer bisa mendaftar dan login.
- Sesi user tersimpan dengan aman (cookies/session).
- Data dummy berhasil masuk ke database.

### Issue #4: Pembuatan Halaman Katalog & Detail Mobil
**Labels:** `sprint-1`, `frontend`, `backend`
**Assignee:** Solo Developer

**Deskripsi:**
Membuat UI untuk customer agar dapat melihat daftar mobil, melakukan filter, dan melihat spesifikasi detail mobil.

**Task List:**
- [ ] Buat API endpoint/Server Action untuk fetch daftar mobil beserta filternya.
- [ ] Buat halaman Home/Katalog dengan komponen Filter (berdasarkan Cabang/Kota, Tanggal, Kategori, Transmisi).
- [ ] Buat halaman Detail Mobil (menampilkan foto, harga, fitur, opsi sewa).

**Acceptance Criteria:**
- Customer bisa mencari mobil berdasarkan lokasi cabang dan kriteria lainnya.
- Data yang ditampilkan berasal dari database Supabase (bukan hardcoded).

---

## 📦 SPRINT 2 (Hari 9-16): Booking & Pembayaran

### Issue #5: API Ketersediaan & Draft Booking
**Labels:** `sprint-2`, `backend`
**Assignee:** Solo Developer

**Deskripsi:**
Backend logic untuk mengecek apakah mobil tersedia di tanggal yang dipilih dan membuat draft booking sebelum pembayaran.

**Task List:**
- [ ] Buat fungsi pengecekan ketersediaan (Availability Check API) yang query langsung ke constraint DB.
- [ ] Buat fungsi perhitungan harga otomatis (termasuk `driver_fee` jika memilih opsi sopir).
- [ ] Buat fungsi untuk create Booking dengan status awal `pending_payment`.

**Acceptance Criteria:**
- API menolak request jika mobil sudah di-booking pada tanggal tersebut.
- Total harga dihitung dengan benar antara `self-drive` dan `with_driver`.

### Issue #6: UI Alur Booking (Customer)
**Labels:** `sprint-2`, `frontend`
**Assignee:** Solo Developer

**Deskripsi:**
Menghubungkan API dengan UI form pemesanan pelanggan.

**Task List:**
- [ ] Buat halaman Booking Form (Input tanggal sewa, pickup & return branch).
- [ ] Tambahkan toggle/opsi "Self-Drive" atau "Dengan Sopir".
- [ ] Buat ringkasan harga (Price Breakdown) yang dinamis.
- [ ] Hubungkan form submit ke API Create Booking.

**Acceptance Criteria:**
- State UI ter-update jika pengguna mengubah opsi sewa.
- Saat di-submit, booking masuk ke database dengan status `pending_payment`.

### Issue #7: Integrasi Midtrans Snap & Webhook
**Labels:** `sprint-2`, `integration`, `backend`
**Assignee:** Solo Developer

**Deskripsi:**
Menghubungkan Midtrans Snap agar pelanggan bisa membayar secara online.

**Task List:**
- [ ] Buat fungsi backend untuk request Snap Token ke API Midtrans saat booking dibuat.
- [ ] Tampilkan pop-up Midtrans Snap / Redirect page saat pelanggan klik "Bayar".
- [ ] Buat API Endpoint Webhook untuk menerima callback dari Midtrans.
- [ ] Update status booking menjadi `confirmed` atau `failed` berdasarkan data webhook.

**Acceptance Criteria:**
- Transaksi simulasi sukses di Midtrans Sandbox.
- Status booking di database otomatis berubah setelah pembayaran sukses.

---

## 📦 SPRINT 3 (Hari 17-24): Dokumen, Notifikasi, Admin

### Issue #8: Upload Dokumen KTP/SIM
**Labels:** `sprint-3`, `frontend`, `backend`
**Assignee:** Solo Developer

**Deskripsi:**
Fitur bagi customer untuk melengkapi data sebelum atau saat melakukan penyewaan.

**Task List:**
- [ ] Setup Supabase Storage bucket untuk KTP & SIM (private/restricted).
- [ ] Buat UI Form Upload di dashboard customer / alur booking.
- [ ] Buat fungsi backend untuk menerima upload dan mengaitkannya ke `Customer` / `Booking`.

**Acceptance Criteria:**
- File berhasil masuk ke Supabase Storage.
- URL file terhubung ke tabel `Document`.

### Issue #9: Setup Resend & Email Konfirmasi
**Labels:** `sprint-3`, `integration`
**Assignee:** Solo Developer

**Deskripsi:**
Sistem notifikasi otomatis untuk customer saat booking terkonfirmasi.

**Task List:**
- [ ] Daftar dan konfigurasi API key Resend.
- [ ] Buat template HTML email konfirmasi (Invoice ringkas, data mobil, tgl sewa).
- [ ] Trigger pengiriman email pada endpoint Midtrans Webhook jika transaksi sukses.

**Acceptance Criteria:**
- Email masuk ke inbox customer secara otomatis sesaat setelah bayar lunas.

### Issue #10: Dashboard Admin - Manajemen Booking & Armada
**Labels:** `sprint-3`, `frontend`, `backend`
**Assignee:** Solo Developer

**Deskripsi:**
Antarmuka untuk staf/admin untuk melihat transaksi masuk dan mengelola status armada.

**Task List:**
- [ ] Buat layout layout internal terproteksi (hanya admin yang bisa akses).
- [ ] Buat halaman Daftar Booking lengkap dengan filter (confirmed, pending, dll).
- [ ] Buat fitur verifikasi dokumen (Lihat KTP/SIM customer).
- [ ] Buat CRUD Data Mobil (Tambah/Edit Mobil, update status maintenance/available).

**Acceptance Criteria:**
- Admin yang tidak login tidak bisa akses halaman ini.
- Admin dapat memperbarui ketersediaan mobil.

### Issue #11: Dashboard Admin - Penugasan Sopir
**Labels:** `sprint-3`, `frontend`, `backend`
**Assignee:** Solo Developer

**Deskripsi:**
Mengelola data sopir dan melakukan *assign* sopir ke pemesanan dengan tipe `with_driver`.

**Task List:**
- [ ] Buat halaman Manajemen Sopir (CRUD data sopir).
- [ ] Di detail Booking, buat panel untuk assign sopir jika tipe `with_driver` dan `driver_assignment_status` = `unassigned`.
- [ ] Cek validasi sederhana agar sopir tidak di-assign ke dua booking yang overlap tanggalnya.

**Acceptance Criteria:**
- Staf cabang berhasil menugaskan sopir ke sebuah pesanan dan status berubah jadi `assigned`.

### Issue #12: UI/UX Polish & Mobile Responsiveness
**Labels:** `sprint-3`, `frontend`
**Assignee:** Solo Developer

**Deskripsi:**
Menyelaraskan seluruh desain komponen agar terlihat profesional dan siap pakai.

**Task List:**
- [ ] Sesuaikan style (warna, font, spacing) dengan referensi desain (Google Stitch).
- [ ] Cek dan perbaiki UI form & tabel di layar perangkat *mobile*.
- [ ] Tambahkan loading state (skeletons/spinners) untuk interaksi data.

**Acceptance Criteria:**
- Tidak ada elemen UI yang "pecah" saat dibuka di smartphone.
- Loading state terlihat jelas saat menunggu response server.

---

## 📦 SPRINT 4 (Hari 25-29): Testing, Deploy & Launch

### Issue #13: QA & End-to-End (E2E) Testing
**Labels:** `sprint-4`, `qa`
**Assignee:** Solo Developer

**Deskripsi:**
Melakukan pengujian ketat sebelum dilepas ke environment production.

**Task List:**
- [ ] Skenario 1: Tes race condition. Buka 2 tab/browser beda, coba booking mobil & tanggal yang sama. (Hanya 1 yang harusnya berhasil).
- [ ] Skenario 2: Alur self-drive berhasil (sampai email terkirim).
- [ ] Skenario 3: Alur dengan sopir berhasil (sampai admin assign sopir di dashboard).
- [ ] Skenario 4: Pembayaran gagal / cancel, pastikan lock mobil kembali terlepas (bisa dipesan orang lain).
- [ ] Skenario 5: Upload KTP/SIM dengan file invalid ditolak dengan error message yang baik.

**Acceptance Criteria:**
- Nol insiden double booking.
- Semua skenario uji di atas lulus.

### Issue #14: Deployment & Soft Launch
**Labels:** `sprint-4`, `backend`, `frontend`
**Assignee:** Solo Developer

**Deskripsi:**
Membawa aplikasi dari sandbox/development ke production.

**Task List:**
- [ ] Ubah kredensial Midtrans Sandbox ke Production.
- [ ] Setup Custom Domain di Vercel.
- [ ] Lakukan *smoke test* 1x transaksi nyata dengan nilai Rp 1,- atau transaksi pembatalan di server production.
- [ ] Hapus data testing di database Supabase Production (Kecuali admin/cabang/mobil asli).
- [ ] Siapkan plan rollback jika ada bug kritis.

**Acceptance Criteria:**
- Sistem LIVE dan siap menerima customer nyata pada hari ke-29.
