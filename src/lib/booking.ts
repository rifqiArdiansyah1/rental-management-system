import { prisma } from '@/utils/prisma'
import { calculateDaysDifference } from './utils/date'
import { RentalType, BookingStatus } from '@prisma/client'

import { calculateEstimatedPrice } from './pricing'
export async function checkVehicleAvailability(vehicleId: string, startDate: Date, endDate: Date): Promise<boolean> {
  // 1. Precondition: Vehicle must be available
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { status: true, isActive: true }
  })

  if (!vehicle || vehicle.status !== 'available' || !vehicle.isActive) {
    return false
  }

  // 2. Overlap Check: Half-open range [startDate, endDate + 3 hours)
  // Interval overlap condition for [A, B+3) and [X, Y+3): A < Y+3 AND B+3 > X
  // Which translates to: existingStartDate < newEndDate + 3h AND existingEndDate > newStartDate - 3h
  const BUFFER_MS = 3 * 60 * 60 * 1000;
  const newEndWithBuffer = new Date(endDate.getTime() + BUFFER_MS);
  const newStartWithBuffer = new Date(startDate.getTime() - BUFFER_MS);

  const overlappingBookings = await prisma.booking.count({
    where: {
      vehicleId,
      status: {
        in: ['pending_payment', 'confirmed', 'ongoing']
      },
      startDate: {
        lt: newEndWithBuffer
      },
      endDate: {
        gt: newStartWithBuffer
      }
    }
  })

  return overlappingBookings === 0
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
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: payload.vehicleId },
    select: { dailyRate: true, isActive: true }
  })

  if (!vehicle || !vehicle.isActive) {
    throw new Error('Vehicle not found or inactive')
  }

  // Calculate price purely on the server
  const pricing = calculateEstimatedPrice(
    Number(vehicle.dailyRate),
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
        totalPrice: pricing.grandTotal,
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
