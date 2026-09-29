-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "returnReminderSentAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_status_endDate_returnReminderSentAt_idx" ON "Booking"("status", "endDate", "returnReminderSentAt");
