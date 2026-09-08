import { Pool } from 'pg';
import * as dotenv from 'dotenv';

if (!process.env.DIRECT_URL) {
  dotenv.config({ path: '.env.local' });
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL }); // use DIRECT_URL for migrations
  try {
    console.log('Connecting to DB via pg...');
    
    console.log('Dropping existing constraints...');
    await pool.query(`ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_vehicle_no_overlap;`);
    await pool.query(`ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_driver_no_overlap;`);
    
    console.log('Altering column types to timestamptz...');
    await pool.query(`ALTER TABLE "Booking" ALTER COLUMN "startDate" TYPE timestamptz USING "startDate" AT TIME ZONE 'UTC';`);
    await pool.query(`ALTER TABLE "Booking" ALTER COLUMN "endDate" TYPE timestamptz USING "endDate" AT TIME ZONE 'UTC';`);
    
    console.log('Adding new vehicle constraint...');
    await pool.query(`
      ALTER TABLE "Booking"
      ADD CONSTRAINT booking_vehicle_no_overlap
      EXCLUDE USING gist (
        "vehicleId" WITH =,
        tstzrange("startDate", ("endDate" AT TIME ZONE 'UTC' + interval '3 hours') AT TIME ZONE 'UTC', '[)') WITH &&
      )
      WHERE (status IN ('pending_payment', 'confirmed', 'ongoing'));
    `);

    console.log('Adding new driver constraint...');
    await pool.query(`
      ALTER TABLE "Booking"
      ADD CONSTRAINT booking_driver_no_overlap
      EXCLUDE USING gist (
        "driverId" WITH =,
        tstzrange("startDate", ("endDate" AT TIME ZONE 'UTC' + interval '3 hours') AT TIME ZONE 'UTC', '[)') WITH &&
      )
      WHERE ("driverId" IS NOT NULL AND status IN ('pending_payment', 'confirmed', 'ongoing'));
    `);

    console.log('Ensuring Document.rejectionReason column exists...');
    await pool.query(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;`);

    console.log('Ensuring Booking late fee & agreedDailyRate columns exist...');
    await pool.query(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "agreedDailyRate" DECIMAL(12, 2);`);
    await pool.query(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "actualReturnAt" TIMESTAMPTZ(6);`);
    await pool.query(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "lateMinutes" INTEGER;`);
    await pool.query(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "lateFeeAmount" DECIMAL(12, 2);`);
    await pool.query(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "lateFeeWaived" BOOLEAN NOT NULL DEFAULT false;`);
    await pool.query(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "lateFeeNote" TEXT;`);

    console.log('Ensuring Booking odometer & Vehicle fuel columns exist...');
    await pool.query(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "odometerStart" INTEGER;`);
    await pool.query(`ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "odometerEnd" INTEGER;`);
    await pool.query(`DO $$ BEGIN
      CREATE TYPE "FuelType" AS ENUM ('pertalite', 'pertamax', 'pertamax_turbo', 'solar', 'dexlite');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);
    await pool.query(`ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "fuelType" "FuelType" NOT NULL DEFAULT 'pertalite';`);
    await pool.query(`ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "fuelEfficiencyKmL" DECIMAL(5, 2);`);

    console.log('Ensuring FuelPrice table exists...');
    await pool.query(`CREATE TABLE IF NOT EXISTS "FuelPrice" (
      "fuelType" "FuelType" NOT NULL,
      "pricePerLiter" DECIMAL(10, 2) NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedBy" TEXT,
      CONSTRAINT "FuelPrice_pkey" PRIMARY KEY ("fuelType")
    );`);
    await pool.query(`INSERT INTO "FuelPrice" ("fuelType", "pricePerLiter", "updatedAt") VALUES
      ('pertalite', 10000, CURRENT_TIMESTAMP),
      ('pertamax', 12950, CURRENT_TIMESTAMP),
      ('pertamax_turbo', 14400, CURRENT_TIMESTAMP),
      ('solar', 6800, CURRENT_TIMESTAMP),
      ('dexlite', 13050, CURRENT_TIMESTAMP)
      ON CONFLICT ("fuelType") DO NOTHING;`);

    console.log('Done!');
  } catch (e) {
    console.error('Error executing SQL:', e);
  } finally {
    await pool.end();
  }
}

main();
