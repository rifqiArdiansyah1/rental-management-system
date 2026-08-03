-- =================================================================
-- Migration: 002_add_constraints
-- =================================================================
-- Jalankan SETELAH migration awal (hasil `npx prisma migrate dev --name init`)
-- yang membuat semua tabel, enum, foreign key, index, dan extension
-- btree_gist dari schema.prisma.
--
-- Prisma schema DSL tidak punya sintaks deklaratif untuk EXCLUDE constraint
-- maupun CHECK constraint kompleks, jadi keduanya harus ditambahkan lewat
-- migration SQL manual. Cara pakai:
--
--   1) npx prisma migrate dev --create-only --name add_constraints
--   2) Timpa isi file migration.sql yang di-generate dengan isi file ini
--   3) npx prisma migrate dev
--
-- Setelah ini berjalan sekali di production, JANGAN edit ulang file ini —
-- perubahan constraint berikutnya harus lewat migration baru.
-- =================================================================

-- -----------------------------------------------------------------
-- 1) Cegah double booking mobil di level database.
--    Dua booking untuk vehicle yang sama tidak boleh punya rentang
--    tanggal yang overlap, selama status booking masih aktif.
--    Booking yang sudah 'cancelled' TIDAK ikut dihitung — kalau tidak
--    dibatasi WHERE ini, mobil yang bookingnya dibatalkan tidak akan
--    pernah bisa dibooking ulang di tanggal yang sama.
-- -----------------------------------------------------------------
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_vehicle_no_overlap
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[]') WITH &&
  )
  WHERE (status IN ('pending_payment', 'confirmed', 'ongoing'));

-- -----------------------------------------------------------------
-- 2) Cegah sopir yang sama ditugaskan ke 2 booking dengan tanggal
--    yang overlap. NULL (belum ditugaskan / self_drive) otomatis
--    tidak ikut dicek exclusion (perilaku default Postgres: NULL
--    tidak pernah dianggap "sama" dengan NULL lain).
-- -----------------------------------------------------------------
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_driver_no_overlap
  EXCLUDE USING gist (
    "driverId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[]') WITH &&
  )
  WHERE ("driverId" IS NOT NULL AND status IN ('pending_payment', 'confirmed', 'ongoing'));

-- -----------------------------------------------------------------
-- 3) Tanggal selesai sewa harus setelah tanggal mulai.
-- -----------------------------------------------------------------
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_end_after_start
  CHECK ("endDate" > "startDate");

-- -----------------------------------------------------------------
-- 4) Document wajib punya TEPAT SATU owner — customer ATAU booking,
--    tidak boleh dua-duanya, tidak boleh kosong dua-duanya.
--    (Ini yang menggantikan kolom ownerId polymorphic di rancangan
--    lama yang secara struktural tidak valid.)
-- -----------------------------------------------------------------
ALTER TABLE "Document"
  ADD CONSTRAINT document_exactly_one_owner
  CHECK (
    ((("customerId" IS NOT NULL))::int + (("bookingId" IS NOT NULL))::int) = 1
  );
