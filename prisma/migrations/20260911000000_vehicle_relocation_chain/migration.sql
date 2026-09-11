-- 1. Drop existing global unique constraint on plateNumber
ALTER TABLE "Vehicle" DROP CONSTRAINT IF EXISTS "Vehicle_plateNumber_key";
DROP INDEX IF EXISTS "Vehicle_plateNumber_key";

-- 2. Add previousVehicleId column and unique constraint for 1-to-1 relation
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "previousVehicleId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_previousVehicleId_key" ON "Vehicle"("previousVehicleId");

-- 3. Add Foreign Key for self-relation
DO $$ BEGIN
  ALTER TABLE "Vehicle" 
  ADD CONSTRAINT "Vehicle_previousVehicleId_fkey" 
  FOREIGN KEY ("previousVehicleId") REFERENCES "Vehicle"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create Partial Unique Index for active plate numbers
CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_plateNumber_active_unique" 
ON "Vehicle" ("plateNumber") 
WHERE "isActive" = true;

-- 5. Create general lookup index on plateNumber
CREATE INDEX IF NOT EXISTS "Vehicle_plateNumber_idx" ON "Vehicle"("plateNumber");

-- 6. Preserve historical note for records with reason 'moved' and convert to 'maintenance'
UPDATE "VehicleUnavailability" 
SET 
  "note" = CASE 
    WHEN "note" IS NULL OR "note" = '' THEN '[Catatan migrasi: dulunya alasan moved]'
    ELSE "note" || ' [Catatan migrasi: dulunya alasan moved]'
  END,
  "reason" = 'maintenance' 
WHERE "reason"::text = 'moved';

-- 7. Reconstruct VehicleUnavailabilityReason enum to strictly 'maintenance'
DO $$ BEGIN
  CREATE TYPE "VehicleUnavailabilityReason_new" AS ENUM ('maintenance');
  ALTER TABLE "VehicleUnavailability" ALTER COLUMN "reason" TYPE "VehicleUnavailabilityReason_new" USING ("reason"::text::"VehicleUnavailabilityReason_new");
  DROP TYPE IF EXISTS "VehicleUnavailabilityReason";
  ALTER TYPE "VehicleUnavailabilityReason_new" RENAME TO "VehicleUnavailabilityReason";
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
