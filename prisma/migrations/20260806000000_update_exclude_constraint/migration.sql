-- Drop the existing constraint
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_vehicle_no_overlap;
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_driver_no_overlap;

-- Re-create the constraint for vehicle with [) bounds to allow same-day turnover
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_vehicle_no_overlap
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[)') WITH &&
  )
  WHERE (status IN ('pending_payment', 'confirmed', 'ongoing'));

-- Re-create the constraint for driver with [) bounds
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_driver_no_overlap
  EXCLUDE USING gist (
    "driverId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[)') WITH &&
  )
  WHERE ("driverId" IS NOT NULL AND status IN ('pending_payment', 'confirmed', 'ongoing'));
