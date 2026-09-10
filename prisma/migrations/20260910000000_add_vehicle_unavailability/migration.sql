-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "VehicleUnavailabilityReason" AS ENUM ('maintenance', 'moved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleUnavailability" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "reason" "VehicleUnavailabilityReason" NOT NULL,
    "startAt" TIMESTAMPTZ(6) NOT NULL,
    "estimatedEndAt" TIMESTAMPTZ(6),
    "actualEndAt" TIMESTAMPTZ(6),
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleUnavailability_vehicleId_actualEndAt_idx" ON "VehicleUnavailability"("vehicleId", "actualEndAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleUnavailability_vehicleId_startAt_estimatedEndAt_idx" ON "VehicleUnavailability"("vehicleId", "startAt", "estimatedEndAt");

-- Partial Unique Index (Enforce at most one active unavailability per vehicle)
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleUnavailability_single_active_per_vehicle" 
ON "VehicleUnavailability" ("vehicleId") 
WHERE "actualEndAt" IS NULL;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "VehicleUnavailability" ADD CONSTRAINT "VehicleUnavailability_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Backfill existing vehicles with status 'maintenance' or 'moved'
INSERT INTO "VehicleUnavailability" ("id", "vehicleId", "reason", "startAt", "estimatedEndAt", "actualEndAt", "note", "createdBy", "createdAt")
SELECT 
  gen_random_uuid()::text,
  v."id",
  v."status"::text::"VehicleUnavailabilityReason",
  CURRENT_TIMESTAMP,
  NULL,
  NULL,
  'Backfill data existing pra-migrasi VehicleUnavailability',
  'system',
  CURRENT_TIMESTAMP
FROM "Vehicle" v
WHERE v."status" IN ('maintenance', 'moved')
AND NOT EXISTS (
  SELECT 1 FROM "VehicleUnavailability" vu WHERE vu."vehicleId" = v."id" AND vu."actualEndAt" IS NULL
);
