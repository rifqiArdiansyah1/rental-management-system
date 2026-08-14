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
    
    console.log('Adding new vehicle constraint...');
    await pool.query(`
      ALTER TABLE "Booking"
      ADD CONSTRAINT booking_vehicle_no_overlap
      EXCLUDE USING gist (
        "vehicleId" WITH =,
        daterange("startDate"::date, "endDate"::date, '[)') WITH &&
      )
      WHERE (status IN ('pending_payment', 'confirmed', 'ongoing'));
    `);

    console.log('Adding new driver constraint...');
    await pool.query(`
      ALTER TABLE "Booking"
      ADD CONSTRAINT booking_driver_no_overlap
      EXCLUDE USING gist (
        "driverId" WITH =,
        daterange("startDate"::date, "endDate"::date, '[)') WITH &&
      )
      WHERE ("driverId" IS NOT NULL AND status IN ('pending_payment', 'confirmed', 'ongoing'));
    `);

    console.log('Done!');
  } catch (e) {
    console.error('Error executing SQL:', e);
  } finally {
    await pool.end();
  }
}

main();
