-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "FuelType" AS ENUM ('pertalite', 'pertamax', 'pertamax_turbo', 'solar', 'dexlite');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "fuelType" "FuelType" NOT NULL DEFAULT 'pertalite';
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "fuelEfficiencyKmL" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "odometerStart" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "odometerEnd" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FuelPrice" (
    "fuelType" "FuelType" NOT NULL,
    "pricePerLiter" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "FuelPrice_pkey" PRIMARY KEY ("fuelType")
);

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Initial Seed Values for FuelPrice
INSERT INTO "FuelPrice" ("fuelType", "pricePerLiter", "updatedAt") VALUES
('pertalite', 10000, CURRENT_TIMESTAMP),
('pertamax', 12950, CURRENT_TIMESTAMP),
('pertamax_turbo', 14400, CURRENT_TIMESTAMP),
('solar', 6800, CURRENT_TIMESTAMP),
('dexlite', 13050, CURRENT_TIMESTAMP)
ON CONFLICT ("fuelType") DO NOTHING;
