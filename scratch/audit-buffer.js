const { Client } = require('pg');
require('dotenv').config();

async function checkOverlap() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing in .env");
  }

  const client = new Client({ connectionString });
  
  const overlapQuery = `
    SELECT b1.id as b1_id, b2.id as b2_id, b1."vehicleId", b1."endDate" as b1_end, b2."startDate" as b2_start
    FROM "Booking" b1
    JOIN "Booking" b2 ON b1."vehicleId" = b2."vehicleId" AND b1.id != b2.id
    WHERE b1.status != 'cancelled' AND b2.status != 'cancelled'
    AND b2."startDate" >= b1."startDate" 
    AND b2."startDate" < b1."endDate" + interval '3 hours';
  `;

  console.log("Connecting to DB via pg to run audit...");
  try {
    await client.connect();
    const results = await client.query(overlapQuery);
    console.log("Audit Results:", results.rows);
    if (results.rows.length > 0) {
      console.log("WARNING: Overlap found! Cannot apply migration cleanly.");
    } else {
      console.log("SUCCESS: No overlap found. Safe to migrate.");
    }
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

checkOverlap();
