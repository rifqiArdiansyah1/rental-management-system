-- CreateTable
CREATE TABLE IF NOT EXISTS "IncidentReport" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IncidentReport_bookingId_idx" ON "IncidentReport"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IncidentReport_branchId_status_idx" ON "IncidentReport"("branchId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IncidentReport_reportedAt_idx" ON "IncidentReport"("reportedAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'IncidentReport_bookingId_fkey'
    ) THEN
        ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'IncidentReport_customerId_fkey'
    ) THEN
        ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'IncidentReport_branchId_fkey'
    ) THEN
        ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
