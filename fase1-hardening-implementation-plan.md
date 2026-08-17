# Fase 1: Hardening & Stabilisasi Pasca-Launch (Issue #15–#21)

**Konteks:** MVP (Issue #3–#14) sudah live di production. Ketujuh issue di bawah ini adalah item yang sengaja digantung selama review teknis karena tidak blocking untuk ship MVP, tapi sekarang jadi prioritas karena sistem sudah memegang data pribadi dan uang customer sungguhan.

**Urutan eksekusi yang disarankan:** #16 → #17 → #15 → #18 → #20 → #21 → #19
(Alasan: #17 butuh helper scope dari #16; sisanya independen dan bisa disisipkan kapan saja, #19 paling ringan jadi cocok jadi penutup.)

---

## Issue #15: Finalisasi Kebijakan Same-Day Turnover

**Tujuan:** Menutup keputusan yang tertunda sejak Issue #5 — apakah mobil boleh langsung disewa lagi di hari yang sama setelah dikembalikan.

> [!IMPORTANT]
> **Keputusan bisnis diperlukan sebelum eksekusi.** Ini bukan keputusan teknis, jadi saya sajikan tiga opsi:
>
> **A — Tetap `'[]'` (inklusif, ada jeda 1 hari).** Paling aman secara operasional (mobil sempat dicek kondisinya), tapi utilisasi armada paling rendah.
>
> **B — Ubah ke `'[)'` (half-open, turnover instan).** Mobil bisa langsung dipesan lagi di hari pengembalian, tanpa jeda sama sekali. Maksimal utilisasi, tapi berisiko kalau mobil kembali kotor/rusak dan customer berikutnya sudah menunggu.
>
> **C — Rentang berbasis timestamp + buffer tetap (mis. 3 jam).** Paling realistis secara operasional — kasih waktu untuk cek kondisi mobil tanpa mengunci seharian penuh. Ini butuh perubahan lebih besar: constraint pindah dari `daterange(start::date, end::date)` ke `tstzrange` penuh dengan buffer ditambahkan di query, dan UI booking perlu mulai menangkap jam pickup/return, bukan cuma tanggal.
>
> Rekomendasi saya: **opsi C** kalau ada waktu untuk mengerjakannya sekarang — ini yang paling mendekati operasional rental mobil sungguhan. Kalau ingin cepat selesai, **opsi B** cukup masuk akal untuk skala saat ini, dengan catatan SOP internal staf tetap mengecek kondisi mobil sebelum serah-terima berikutnya.

### Proposed Changes (opsi B — contoh, sesuaikan kalau A/C dipilih)

**[NEW] `prisma/migrations/003_same_day_turnover/migration.sql`**
```sql
ALTER TABLE "Booking" DROP CONSTRAINT booking_vehicle_no_overlap;
ALTER TABLE "Booking" DROP CONSTRAINT booking_driver_no_overlap;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_vehicle_no_overlap
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[)') WITH &&
  )
  WHERE (status IN ('pending_payment', 'confirmed', 'ongoing'));

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_driver_no_overlap
  EXCLUDE USING gist (
    "driverId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[)') WITH &&
  )
  WHERE ("driverId" IS NOT NULL AND status IN ('pending_payment', 'confirmed', 'ongoing'));
```

**[MODIFY] `src/lib/booking.ts`**
- `checkVehicleAvailability`: ubah kondisi overlap dari `gte`/`lte` jadi kombinasi yang meniru batas half-open (`existingStart < newEnd AND existingEnd > newStart`, tanpa `=`), supaya persis sama dengan constraint database.

### Verification Plan
- [ ] Booking [10–12 Agustus] lalu [12–14 Agustus] untuk mobil yang sama → diterima (sesuai opsi B).
- [ ] Booking [10–12 Agustus] lalu [11–13 Agustus] (overlap sungguhan) → tetap ditolak.
- [ ] Pesan error di UI dan penolakan constraint database konsisten untuk kasus yang sama persis.

---

## Issue #16: Branch Scoping Penuh (RBAC Granular)

**Tujuan:** Menutup gap yang berulang kali disebut di review Issue #10 & #11 — staf cabang saat ini bisa lihat dan berpotensi mengoperasikan data cabang lain.

### Proposed Changes

**[NEW] `src/lib/auth/scope.ts`**
```ts
type StaffScope =
  | { scope: 'all' }
  | { scope: 'branch'; branchId: string };

export async function getStaffScope(): Promise<StaffScope> {
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  const branchId = user?.app_metadata?.branchId;
  if (role === 'admin_pusat') return { scope: 'all' };
  if (!branchId) throw new Error('Staf tidak punya cabang terdaftar');
  return { scope: 'branch', branchId };
}
```

**[MODIFY] `src/actions/admin.ts`**
- `startRental`, `endRental`: sebelum transaksi, ambil `getStaffScope()`. Kalau `scope === 'branch'`, validasi `booking.pickupBranchId === branchId` — kalau tidak cocok, tolak dengan pesan jelas, bukan silent fail.

**[MODIFY] `src/actions/document.ts`, driver actions di Issue #11**
- `verifyCustomerDocument`, `assignDriver`, `reassignDriver` (lihat Issue #21): guard yang sama — validasi entity yang diakses ada di cabang staf pemanggil.

**[MODIFY] `src/app/admin/(authenticated)/bookings/page.tsx`, `vehicles/page.tsx`, `drivers/page.tsx`**
- Tambah `where: scope.scope === 'branch' ? { branchId: scope.branchId } : {}` di semua query listing.

**[MODIFY] `src/app/admin/(authenticated)/dashboard/page.tsx`**
- Metrik ringkas: scoped ke cabang untuk staf/admin_cabang. Untuk admin_pusat, tampilkan breakdown per cabang (bukan cuma angka gabungan).

### Verification Plan
- [ ] Staf cabang A membuka `/admin/bookings` → hanya lihat booking cabang A.
- [ ] Staf cabang A memanggil `startRental(bookingId)` langsung dengan ID booking cabang B → ditolak dengan pesan jelas.
- [ ] Admin pusat (`branchId = null`) tetap bisa akses semua cabang tanpa filter.

---

## Issue #17: Audit & Perbaikan Akses Dokumen KTP/SIM oleh Admin

**Tujuan:** Menutup gap dari Issue #8 — policy RLS storage saat ini cuma mengizinkan customer baca folder miliknya sendiri, admin belum pernah benar-benar bisa buka dokumen. *Depends on Issue #16 (butuh `getStaffScope`).*

### Proposed Changes

**[NEW] `src/actions/document.ts` → `getDocumentSignedUrl(documentId: string)`**
- Guard: `getStaffScope()` + validasi dokumen ini milik customer yang punya booking di cabang staf (atau `scope === 'all'`).
- Generate signed URL lewat Supabase service role, umur pendek (5 menit).
- Return URL ke client, dipakai di panel verifikasi dokumen (Issue #11).

**[MODIFY] `002_add_constraints.sql` → migration baru `004_storage_policy_review.sql`**
- Audit policy `storage.objects`: pastikan tidak ada policy yang secara tidak sengaja mengizinkan baca lintas folder. Admin **tidak** dapat policy tambahan di level storage — semua akses admin lewat signed URL di atas, supaya otorisasi tetap satu tempat (application layer), bukan tersebar ke RLS juga.

**[MODIFY] `src/app/admin/(authenticated)/bookings/[id]/page.tsx`**
- Panel verifikasi dokumen manggil `getDocumentSignedUrl` per dokumen, bukan `fileUrl` mentah dari tabel `Document`.

### Verification Plan
- [ ] Staf cabang A buka `getDocumentSignedUrl` untuk dokumen customer di cabang B → ditolak.
- [ ] URL signed yang sudah lewat 5 menit tidak lagi bisa diakses.
- [ ] Percobaan akses langsung path storage tanpa lewat Server Action → ditolak oleh RLS default (bukan public).

---

## Issue #18: SOP & Fitur Manual-Cancel Booking Bermasalah

**Tujuan:** Booking `confirmed` dengan dokumen `rejected` berulang kali dan tak kunjung diperbaiki saat ini mengunci mobil selamanya (exclusion constraint menganggap `confirmed` aktif).

### Proposed Changes

**[NEW] `src/actions/admin.ts` → `adminCancelBooking(bookingId: string, reason: string)`**
- Guard: hanya `admin_cabang`/`admin_pusat` (bukan `staff_cabang` — pembatalan menyangkut keputusan refund, perlu wewenang lebih tinggi).
- Update `Booking.status = 'cancelled'` (melepas mobil otomatis lewat exclusion constraint yang sudah ada).
- Kalau ada `Payment` dengan status `success`, **tidak** auto-refund via API (di luar scope saat ini) — cukup catat `reason` di field baru `Booking.cancellationNote` dan tandai perlu proses refund manual, lalu kirim email ke customer via `sendDocumentStatusEmail`/template baru.

**[MODIFY] `prisma/schema.prisma`**
- Tambah `cancellationNote String?` dan `cancelledBy String?` (relasi ke `User.id`) di model `Booking` untuk audit trail siapa yang membatalkan dan kenapa.

**[NEW] UI di `src/app/admin/(authenticated)/bookings/[id]/page.tsx`**
- Tombol "Batalkan Booking" dengan modal alasan wajib diisi, hanya muncul untuk role yang berwenang.

### Verification Plan
- [ ] `staff_cabang` tidak melihat/tidak bisa memanggil `adminCancelBooking`.
- [ ] Booking dibatalkan → mobil & sopir (kalau ada) langsung tersedia untuk booking baru di tanggal yang sama.
- [ ] `cancellationNote` dan `cancelledBy` tersimpan dan terlihat di riwayat booking.

---

## Issue #19: Observability Cron Cleanup

**Tujuan:** Sejak dipindah ke external scheduler (cron-job.org), belum ada sinyal kalau scheduler berhenti trigger diam-diam.

### Proposed Changes

**[MODIFY] `src/app/api/cron/cancel-bookings/route.ts`**
- Setelah tiap run sukses, tulis timestamp ke tabel kecil baru `CronHeartbeat` (atau baris config sederhana) — `lastRunAt`, `bookingsCancelled`.

**[NEW] `prisma/schema.prisma` → model `CronHeartbeat`**
```prisma
model CronHeartbeat {
  id                String   @id @default(uuid())
  jobName           String   @unique
  lastRunAt         DateTime
  bookingsCancelled Int
}
```

**[NEW] Widget kecil di `src/app/admin/(authenticated)/dashboard/page.tsx`**
- Tampilkan "Cleanup terakhir jalan: X menit lalu" — warna merah/alert kalau lebih dari 2× interval yang diharapkan (indikasi scheduler berhenti).
- Sekaligus tampilkan umur booking `pending_payment` tertua saat ini, sebagai sinyal tambahan independen dari heartbeat.

### Verification Plan
- [ ] Matikan sementara scheduler eksternal → widget dashboard berubah jadi status alert setelah threshold terlewati.
- [ ] `CronHeartbeat` ter-update tiap kali endpoint dipanggil sukses.

---

## Issue #20: Audit Konsistensi `Vehicle.status`

**Tujuan:** `Vehicle.status` cuma dijamin konsisten lewat jalur `startRental`/`endRental` (Issue #10). Jalur lain (edit manual di `/admin/vehicles`) belum divalidasi terhadap booking aktif.

### Proposed Changes

**[MODIFY] `src/actions/admin.ts` (atau file CRUD vehicle terkait)**
- Sebelum mengizinkan admin mengubah `Vehicle.status` secara manual (misal ke `maintenance`), cek apakah ada `Booking` dengan status `ongoing` untuk vehicle itu. Kalau ada, tolak dengan pesan jelas ("Mobil sedang dalam masa sewa aktif, tidak bisa diubah statusnya").

### Verification Plan
- [ ] Coba ubah status mobil yang sedang `rented` (ada booking `ongoing`) jadi `maintenance` manual → ditolak.
- [ ] Mobil tanpa booking aktif tetap bisa diubah statusnya bebas.

---

## Issue #21: Reassignment Sopir

**Tujuan:** Saat ini belum ada jalur resmi mengganti sopir yang sudah di-assign kalau berhalangan mendadak.

### Proposed Changes

**[MODIFY] `src/actions/admin.ts` → generalisasi `assignDriver` jadi `assignDriver(bookingId, newDriverId)`**
- Hilangkan asumsi "hanya untuk `driverId` yang masih null" — izinkan overwrite `driverId` yang sudah terisi.
- Guard tambahan: kalau booking sedang `ongoing` (sopir lama sudah `on_trip`), set sopir lama balik ke `available`, sopir baru ke `on_trip`. Kalau booking masih `confirmed` (belum `startRental`), sopir baru cukup tetap `available` sampai serah-terima.
- Overlap check dan try-catch untuk exclusion constraint tetap sama seperti Issue #11.

### Verification Plan
- [ ] Reassign sopir pada booking `confirmed` (belum mulai) — sopir lama & baru status-nya benar.
- [ ] Reassign sopir pada booking `ongoing` (sudah berjalan) — sopir lama otomatis `available`, sopir baru `on_trip`.
- [ ] Reassign ke sopir yang jadwalnya bentrok → ditolak (constraint database).
