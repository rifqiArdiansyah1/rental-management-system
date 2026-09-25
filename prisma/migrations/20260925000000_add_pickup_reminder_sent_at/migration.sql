-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "pickupReminderSentAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_status_startDate_pickupReminderSentAt_idx" ON "Booking"("status", "startDate", "pickupReminderSentAt");
