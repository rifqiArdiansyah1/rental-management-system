import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });
  try {
    await pool.query('TRUNCATE TABLE "Booking" CASCADE');
    console.log("Truncated Booking table");
  } finally {
    await pool.end();
  }
}
main();
