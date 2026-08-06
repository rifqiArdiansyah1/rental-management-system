import { prisma } from '@/utils/prisma'
import { calculateDaysDifference } from './utils/date'
import { RentalType, BookingStatus } from '@prisma/client'

// Fixed flat rate for driver estimation before actual driver assignment
export const STANDARD_DRIVER_FEE = 150000

export async function checkVehicleAvailability(vehicleId: string, startDate: Date, endDate: Date): Promise<boolean> {
  // 1. Precondition: Vehicle must be available
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { status: true }
  })

  if (!vehicle || vehicle.status !== 'available') {
    return false
  }

  // 2. Overlap Check: Half-open range [startDate, endDate)
  // Two intervals [A, B) and [X, Y) overlap if: A < Y AND B > X
  // i.e., newStartDate < existingEndDate AND newEndDate > existingStartDate
  const overlappingBookings = await prisma.booking.count({
    where: {
      vehicleId,
      status: {
        in: ['pending_payment', 'confirmed', 'ongoing']
      },
      startDate: {
        lt: endDate
      },
      endDate: {
        gt: startDate
      }
    }
  })

  return overlappingBookings === 0
}

export async function calculateBookingPrice(
  vehicleId: string, 
  startDate: Date, 
  endDate: Date, 
  rentalType: RentalType
): Promise<number> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { dailyRate: true }
  })

  if (!vehicle) {
    throw new Error('Vehicle not found')
  }

  const days = calculateDaysDifference(startDate, endDate)
  const vehicleRate = Number(vehicle.dailyRate)
  
  let totalPrice = vehicleRate * days

  if (rentalType === 'with_driver') {
    totalPrice += (STANDARD_DRIVER_FEE * days)
  }

  return totalPrice
}

export type CreateDraftBookingPayload = {
  customerId: string
  vehicleId: string
  pickupBranchId: string
  returnBranchId: string
  startDate: Date
  endDate: Date
  rentalType: RentalType
}

export async function createDraftBookingCore(payload: CreateDraftBookingPayload) {
  // Calculate price purely on the server
  const totalPrice = await calculateBookingPrice(
    payload.vehicleId,
    payload.startDate,
    payload.endDate,
    payload.rentalType
  )

  try {
    const booking = await prisma.booking.create({
      data: {
        customerId: payload.customerId,
        vehicleId: payload.vehicleId,
        pickupBranchId: payload.pickupBranchId,
        returnBranchId: payload.returnBranchId,
        startDate: payload.startDate,
        endDate: payload.endDate,
        rentalType: payload.rentalType,
        totalPrice,
        status: BookingStatus.pending_payment,
        // driverId and driverAssignmentStatus are intentionally left null for 'with_driver' 
        // until a branch staff assigns a real driver.
      }
    })

    return booking
  } catch (error: any) {
    // Check for PostgreSQL exclusion violation via error message substring
    // "booking_vehicle_no_overlap"
    if (error?.message && typeof error.message === 'string' && error.message.includes('booking_vehicle_no_overlap')) {
      throw new Error('Mobil sudah dipesan di rentang tanggal tersebut. Silakan pilih tanggal lain.')
    }
    
    // Throw generic error if it's something else
    throw error
  }
}
