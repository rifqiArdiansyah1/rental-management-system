-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingChannel') THEN
        CREATE TYPE "BookingChannel" AS ENUM ('online', 'walk_in');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalkInReviewStatus') THEN
        CREATE TYPE "WalkInReviewStatus" AS ENUM ('pending_review', 'confirmed', 'flagged');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "bookingChannel" "BookingChannel" NOT NULL DEFAULT 'online';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "createdByStaffId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "walkInReviewStatus" "WalkInReviewStatus";
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "walkInReviewedBy" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "walkInReviewedAt" TIMESTAMPTZ(6);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "walkInReviewNote" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(12,2);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "discountReason" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "discountAppliedBy" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_bookingChannel_walkInReviewStatus_idx" ON "Booking"("bookingChannel", "walkInReviewStatus");
CREATE INDEX IF NOT EXISTS "Booking_bookingChannel_createdAt_idx" ON "Booking"("bookingChannel", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_createdByStaffId_idx" ON "Booking"("createdByStaffId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Booking_createdByStaffId_fkey'
    ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Booking_walkInReviewedBy_fkey'
    ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT "Booking_walkInReviewedBy_fkey" FOREIGN KEY ("walkInReviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Booking_discountAppliedBy_fkey'
    ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT "Booking_discountAppliedBy_fkey" FOREIGN KEY ("discountAppliedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
