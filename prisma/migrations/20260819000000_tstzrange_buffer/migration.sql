-- Drop the existing constraint
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_vehicle_no_overlap;
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_driver_no_overlap;

-- Alter column types to timestamptz
ALTER TABLE "Booking" ALTER COLUMN "startDate" TYPE timestamptz USING "startDate" AT TIME ZONE 'UTC';
ALTER TABLE "Booking" ALTER COLUMN "endDate" TYPE timestamptz USING "endDate" AT TIME ZONE 'UTC';

-- Re-create the constraint for vehicle with tstzrange and 3-hour buffer
-- A new booking's start time cannot overlap with an existing booking's (end time + 3 hours)
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_vehicle_no_overlap
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tstzrange("startDate", "endDate" + interval '3 hours', '[)') WITH &&
  )
  WHERE (status IN ('pending_payment', 'confirmed', 'ongoing'));

-- Re-create the constraint for driver with tstzrange and 3-hour buffer
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_driver_no_overlap
  EXCLUDE USING gist (
    "driverId" WITH =,
    tstzrange("startDate", "endDate" + interval '3 hours', '[)') WITH &&
  )
  WHERE ("driverId" IS NOT NULL AND status IN ('pending_payment', 'confirmed', 'ongoing'));
