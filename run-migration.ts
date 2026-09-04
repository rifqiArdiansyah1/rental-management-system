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

    console.log('Done!');
  } catch (e) {
    console.error('Error executing SQL:', e);
  } finally {
    await pool.end();
  }
}

main();
