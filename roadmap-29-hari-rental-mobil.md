# Roadmap 29 Hari — Website Rental Mobil (Multi-Cabang)

**Konteks eksekusi:** Solo developer (full-stack), desain UI/UX dibantu Google Stitch
**Referensi teknis:** `arsitektur-sistem-cv-rental-mobil.md` v1.2
**Tanggal mulai asumsi:** Hari 1 = hari kamu mulai kerja penuh pada proyek ini

---

## 1. Visi Produk (Product Manager)

**Visi:** Menjadikan website ini kanal booking online utama CV, menggantikan proses manual (telepon/WA cek ketersediaan satu-satu) dengan pengalaman self-service 24 jam — customer bisa cari, bandingkan, dan booking mobil (self-drive atau dengan sopir) kapan saja, sementara admin cabang punya satu dashboard untuk approve booking dan atur armada tanpa risiko bentrok jadwal.

**Target pengguna:**
- Customer individu/korporat yang butuh sewa mobil di kota tempat CV beroperasi
- Admin/staf cabang yang selama ini mengelola booking manual lewat telepon, WA pribadi, atau buku catatan

**Kenapa ini penting sekarang:** proses manual tidak scale ke multi-cabang — makin banyak cabang, makin besar risiko dua staf cabang berbeda menjanjikan mobil yang sama ke dua customer. Sistem ini menghilangkan risiko itu sejak hari pertama sekaligus membuka jam operasional booking jadi 24/7.

**Metrik keberhasilan MVP (di akhir hari ke-29):**
1. Customer bisa menyelesaikan booking end-to-end (cari → pilih → bayar → dapat konfirmasi) tanpa kontak CS sama sekali.
2. **Nol** insiden double booking di production.
3. Admin bisa approve booking & assign sopir dalam < 2 menit per transaksi.
4. Sistem live dan siap menerima booking sungguhan pada hari ke-29.

**Secara eksplisit di luar cakupan 29 hari** (masuk fase 2/3 sesuai dokumen arsitektur): notifikasi WA otomatis, RBAC granular per role, GPS tracking, rental one-way antar cabang, program loyalitas, aplikasi mobile, harga dinamis musiman.

---

## 2. Product Backlog (Product Owner)

Diurutkan berdasarkan prioritas MoSCoW untuk window 29 hari. Setiap epic dipecah jadi user story siap-kerja.

### Epic A — Fondasi (Must)
- Sebagai developer, saya butuh skema database (Branch, Vehicle, VehicleCategory, Driver, Customer, Booking, Payment, Document) sudah termigrasi di Supabase, termasuk exclusion constraint anti-double-booking.
- Sebagai developer, saya butuh auth customer (register/login) dan auth admin terpisah.

### Epic B — Katalog mobil (Must)
- Sebagai customer, saya bisa melihat daftar mobil per cabang/kota.
- Sebagai customer, saya bisa filter berdasarkan tanggal, kategori, dan transmisi.
- Sebagai customer, saya bisa melihat detail mobil (foto, spesifikasi, harga).

### Epic C — Alur booking inti (Must)
- Sebagai customer, saya bisa memilih tanggal sewa dan sistem menampilkan ketersediaan real-time.
- Sebagai customer, saya bisa memilih **self-drive** atau **dengan sopir**, dan harga menyesuaikan otomatis.
- Sebagai customer, booking saya ditolak sistem dengan pesan jelas jika mobil ternyata sudah terisi (race condition tertangani constraint database).

### Epic D — Pembayaran (Must)
- Sebagai customer, saya diarahkan ke halaman pembayaran Midtrans Snap setelah konfirmasi booking.
- Sebagai sistem, saya menerima webhook Midtrans dan mengubah status booking otomatis (confirmed/failed).

### Epic E — Dokumen & verifikasi (Must)
- Sebagai customer, saya bisa upload foto KTP dan SIM saat proses booking.
- Sebagai admin, saya bisa melihat dan menandai dokumen sebagai terverifikasi.

### Epic F — Notifikasi (Should)
- Sebagai customer, saya menerima email konfirmasi booking beserta ringkasan invoice.

### Epic G — Dashboard admin (Must)
- Sebagai admin, saya bisa melihat daftar booking masuk dan meng-approve/reject.
- Sebagai admin, saya bisa mengelola data mobil (CRUD) dan status ketersediaannya.
- Sebagai admin, saya bisa mengelola data sopir dan menugaskan sopir ke booking `with_driver`.

### Epic H — Polish & rilis (Must)
- Sebagai customer, saya melihat UI yang konsisten dengan desain Stitch di semua halaman utama.
- Sebagai tim, kami butuh sistem sudah lolos uji end-to-end sebelum go-live.

### Won't-have di 29 hari ini
Notifikasi WA otomatis, laporan lintas cabang untuk admin pusat, manajemen maintenance armada, kontrak PDF otomatis, harga dinamis, portal khusus sopir.

---

## 3. Jadwal Rilis & Deadline (Project Manager)

29 hari dibagi 5 sprint. Setiap sprint ditutup dengan *Definition of Done* yang jelas supaya kamu tahu kapan boleh lanjut, bukan lanjut karena waktu habis.

| Sprint | Hari | Fokus | Definition of Done (deadline) |
|---|---|---|---|
| **Sprint 0 — Fondasi teknis** | 1–2 | Setup project, Supabase, deploy pipeline | Repo jalan di Vercel, koneksi Supabase aktif, skema awal ter-migrate |
| **Sprint 1 — Data, auth, katalog** | 3–8 | Schema penuh + exclusion constraint, auth customer/admin, halaman katalog & detail mobil | Customer bisa daftar/login dan browse+filter mobil dengan data asli dari DB |
| **Sprint 2 — Booking & pembayaran (inti nilai produk)** | 9–16 | Availability check, alur booking self-drive/sopir, integrasi Midtrans Snap + webhook | Booking end-to-end bisa selesai dari pilih mobil sampai status `confirmed` via pembayaran sungguhan (mode sandbox) |
| **Sprint 3 — Dokumen, notifikasi, dashboard admin** | 17–24 | Upload dokumen, email konfirmasi, dashboard admin penuh (mobil, booking, sopir), polish UI sesuai Stitch | Admin bisa approve booking & assign sopir dari dashboard; customer dapat email konfirmasi otomatis |
| **Sprint 4 — Testing, deploy, launch** | 25–29 | End-to-end testing, bug fixing, deploy production, soft launch | Sistem live di domain production, sudah lolos skenario uji di bagian 5 |

**Risiko & mitigasi:**
- **Approval akun merchant Midtrans bisa makan waktu beberapa hari** → daftar akun merchant di Hari 1, jangan tunggu sampai Sprint 2.
- **Desain Stitch belum final saat development mulai** → mulai bangun struktur komponen & layout dari wireframe yang ada di Sprint 1, sinkronkan visual detail di Sprint 3 (bukan blocking di awal).
- **Solo dev rawan scope creep** → semua item "Won't-have" di atas ditolak eksplisit sampai hari ke-29 selesai, dicatat sebagai backlog fase 2.

---

## 4. Pembagian Tugas Teknis (Technical Lead)

Karena eksekusinya solo, tidak ada tim untuk dibagi tugas — tapi memecah pekerjaan per "topi keahlian" tetap berguna supaya kamu tahu kapan mode context-switching terjadi (backend → frontend → integrasi → QA), dan supaya urutan dependency-nya jelas.

| Hari | Topi dominan | Task | Depends on |
|---|---|---|---|
| 1–2 | DevOps | Setup repo, Next.js + Tailwind, project Supabase, deploy skeleton ke Vercel, daftar akun merchant Midtrans | — |
| 3–4 | Backend | Prisma schema lengkap (Branch, Vehicle, Category, Driver, Customer, Booking, Payment, Document) + migration exclusion constraint | Sprint 0 selesai |
| 5–6 | Backend | Supabase Auth: register/login customer, login admin, seed data dummy (cabang, mobil, sopir) | Schema selesai |
| 7–8 | Frontend | Halaman katalog mobil + filter (cabang, tanggal, kategori) + halaman detail mobil | Data seed tersedia |
| 9–10 | Backend | API availability check (query terhadap exclusion constraint), API create booking (draft `pending_payment`) | Katalog & auth selesai |
| 11 | Frontend | UI alur booking: pilih tanggal, toggle self-drive/dengan sopir, kalkulasi harga | API booking siap |
| 12–14 | Integrasi | Integrasi Midtrans Snap (redirect checkout) + endpoint webhook + update status booking | Booking draft berfungsi |
| 15–16 | Backend + Frontend | Upload dokumen KTP/SIM ke Supabase Storage, form upload di alur booking | Booking flow selesai |
| 17–18 | Integrasi | Setup Resend, template email konfirmasi + invoice ringkas, trigger otomatis saat booking `confirmed` | Webhook payment selesai |
| 19–20 | Frontend + Backend | Dashboard admin: daftar booking + approve/reject, CRUD data mobil | Auth admin siap |
| 21–22 | Frontend + Backend | Dashboard admin: kelola data sopir + panel penugasan sopir ke booking `with_driver` | Dashboard booking selesai |
| 23–24 | Frontend | Polish seluruh halaman customer-facing sesuai desain Stitch, cek responsive mobile | Semua fitur inti selesai |
| 25–26 | QA | Uji end-to-end: booking sukses, booking gagal bayar, percobaan double booking (harus ditolak DB), upload dokumen invalid | Semua fitur selesai |
| 27 | QA + Backend | Bug fixing dari hasil testing, cek error handling & loading state | Testing selesai |
| 28 | DevOps | Deploy production, konfigurasi domain, smoke test di environment production | Bug fixing selesai |
| 29 | Semua | Soft launch, pantau log & webhook payment secara langsung, siapkan rencana rollback jika ada isu kritis | Production live |

---

## 5. Skenario Uji Wajib Sebelum Launch

Checklist minimum di Sprint 4 sebelum dinyatakan "Done":

- [ ] Dua tab browser mencoba booking mobil & tanggal yang sama secara bersamaan — hanya satu yang berhasil, satunya dapat pesan error yang jelas.
- [ ] Pembayaran sukses → status booking otomatis `confirmed`, email konfirmasi terkirim.
- [ ] Pembayaran gagal/timeout → booking tidak nyangkut di status `pending_payment` selamanya (ada batas waktu/expiry).
- [ ] Booking `with_driver` muncul di panel admin untuk ditugaskan sopir, dan sopir yang sudah ditugaskan di tanggal sama tidak muncul lagi sebagai opsi di booking lain yang overlap.
- [ ] Upload KTP/SIM dengan format salah (bukan gambar) ditolak dengan pesan yang jelas, bukan error mentah.
- [ ] Semua halaman customer-facing dicek di layar mobile (mayoritas trafik rental mobil Indonesia datang dari HP).
