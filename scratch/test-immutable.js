const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS test_booking;`);
    await client.query(`
      CREATE TABLE test_booking (
        id SERIAL PRIMARY KEY,
        start_date timestamptz,
        end_date timestamptz
      );
    `);
    
    await client.query(`
      ALTER TABLE test_booking ADD CONSTRAINT no_overlap 
      EXCLUDE USING gist (
        tstzrange(start_date, (end_date AT TIME ZONE 'UTC' + interval '3 hours') AT TIME ZONE 'UTC', '[)') WITH &&
      );
    `);
    console.log('Success with AT TIME ZONE UTC');
  } catch (e) {
    console.error(e.message);
  } finally {
    await client.query('DROP TABLE IF EXISTS test_booking;');
    await client.end();
  }
})();
