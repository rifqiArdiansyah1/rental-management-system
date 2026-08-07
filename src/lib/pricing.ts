import { RentalType } from '@prisma/client'
import { calculateDaysDifference } from './utils/date'

// Fixed flat rate for driver estimation before actual driver assignment
export const STANDARD_DRIVER_FEE = 150000

/**
 * Pure function to calculate the estimated price of a booking.
 * This function can be safely used both on the client (for UI breakdown)
 * and on the server (as the source of truth before saving to the DB).
 */
export function calculateEstimatedPrice(
  dailyRate: number,
  startDate: Date | string,
  endDate: Date | string,
  rentalType: RentalType
): { days: number; vehicleTotal: number; driverTotal: number; grandTotal: number } {
  const days = calculateDaysDifference(startDate, endDate)
  
  const vehicleTotal = dailyRate * days
  const driverTotal = rentalType === 'with_driver' ? STANDARD_DRIVER_FEE * days : 0
  const grandTotal = vehicleTotal + driverTotal

  return {
    days,
    vehicleTotal,
    driverTotal,
    grandTotal,
  }
}
