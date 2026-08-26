-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_pickupBranchId_status_idx" ON "Booking"("pickupBranchId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_status_startDate_idx" ON "Booking"("status", "startDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt");
