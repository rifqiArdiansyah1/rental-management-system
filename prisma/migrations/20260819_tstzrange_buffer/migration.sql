-- 1. Create tstzrange columns
ALTER TABLE "Booking" ADD COLUMN "rental_period" tstzrange;

-- 2. Populate new column based on existing startDate and endDate
UPDATE "Booking" 
SET "rental_period" = tstzrange("startDate", "endDate" + interval '3 hours', '[)');

-- 3. Drop existing exclusion constraints (based on daterange)
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_vehicle_no_overlap;
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_driver_no_overlap;

-- 4. Re-add exclusions using tstzrange and excluding cancelled bookings
ALTER TABLE "Booking" ADD CONSTRAINT booking_vehicle_no_overlap 
EXCLUDE USING gist (
  "vehicleId" WITH =, 
  "rental_period" WITH &&
) WHERE (status != 'cancelled');

ALTER TABLE "Booking" ADD CONSTRAINT booking_driver_no_overlap 
EXCLUDE USING gist (
  "driverId" WITH =, 
  "rental_period" WITH &&
) WHERE (status != 'cancelled');
