-- 1. Drop constraints relying on tsrange and startDate/endDate
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_vehicle_no_overlap;
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_driver_no_overlap;

-- 2. Alter column types to timestamptz
ALTER TABLE "Booking" ALTER COLUMN "startDate" TYPE timestamptz USING "startDate" AT TIME ZONE 'UTC';
ALTER TABLE "Booking" ALTER COLUMN "endDate" TYPE timestamptz USING "endDate" AT TIME ZONE 'UTC';

-- 3. Re-add constraints using tstzrange
ALTER TABLE "Booking"
ADD CONSTRAINT booking_vehicle_no_overlap
EXCLUDE USING gist (
  "vehicleId" WITH =,
  tstzrange("startDate", ("endDate" AT TIME ZONE 'UTC' + interval '3 hours') AT TIME ZONE 'UTC', '[)') WITH &&
)
WHERE (status IN ('pending_payment', 'confirmed', 'ongoing'));

ALTER TABLE "Booking"
ADD CONSTRAINT booking_driver_no_overlap
EXCLUDE USING gist (
  "driverId" WITH =,
  tstzrange("startDate", ("endDate" AT TIME ZONE 'UTC' + interval '3 hours') AT TIME ZONE 'UTC', '[)') WITH &&
)
WHERE ("driverId" IS NOT NULL AND status IN ('pending_payment', 'confirmed', 'ongoing'));
