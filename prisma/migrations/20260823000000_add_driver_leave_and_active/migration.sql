-- AlterTable
ALTER TABLE "Driver" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DriverLeave" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ(6) NOT NULL,
    "endDate" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Driver_branchId_isActive_idx" ON "Driver"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "DriverLeave_driverId_startDate_endDate_idx" ON "DriverLeave"("driverId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "DriverLeave" ADD CONSTRAINT "DriverLeave_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
