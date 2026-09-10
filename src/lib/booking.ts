import { prisma } from '@/utils/prisma'
import { calculateDaysDifference } from './utils/date'
import { RentalType, BookingStatus } from '@prisma/client'
import { TURNOVER_BUFFER_MS } from '@/lib/constants'

import { calculateEstimatedPrice } from './pricing'

export function checkIntervalOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart
}

export async function checkVehicleAvailability(
  vehicleId: string,
  startDate: Date,
  endDate: Date,
  client: any = prisma
): Promise<boolean> {
  // 1. Precondition: Vehicle must exist and be active
  const vehicle = await client.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      status: true,
      isActive: true,
      unavailabilities: {
        where: { actualEndAt: null },
        take: 1,
      }
    }
  })

  if (!vehicle || !vehicle.isActive) {
    return false
  }

  const activeUnavail = vehicle.unavailabilities?.[0]

  // Defensive fallback: if vehicle is in maintenance or moved without active unavail record, reject
  if ((vehicle.status === 'maintenance' || vehicle.status === 'moved') && !activeUnavail) {
    return false
  }

  // Active unavailability checks
  if (activeUnavail) {
    // If unit is moved or has indefinite maintenance (no estimated end), completely unavailable
    if (activeUnavail.reason === 'moved' || !activeUnavail.estimatedEndAt) {
      return false
    }

    // Windowed maintenance check:
    // Leaving workshop requires 3 hours buffer before next rental handover
    const unavailEndWithBuffer = new Date(activeUnavail.estimatedEndAt.getTime() + TURNOVER_BUFFER_MS)
    const bookingEndWithBuffer = new Date(endDate.getTime() + TURNOVER_BUFFER_MS)

    if (checkIntervalOverlap(startDate, bookingEndWithBuffer, activeUnavail.startAt, unavailEndWithBuffer)) {
      return false
    }
  }

  // 2. Overlap Check with Active Bookings: Half-open range [startDate, endDate + 3 hours)
  // Interval overlap condition for [A, B+3) and [X, Y+3): A < Y+3 AND B+3 > X
  // Which translates to: existingStartDate < newEndDate + 3h AND existingEndDate > newStartDate - 3h
  const newEndWithBuffer = new Date(endDate.getTime() + TURNOVER_BUFFER_MS)
  const newStartWithBuffer = new Date(startDate.getTime() - TURNOVER_BUFFER_MS)

  const overlappingBookings = await client.booking.count({
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
  try {
    return await prisma.$transaction(async (tx) => {
      // Row lock on Vehicle to eliminate TOCTOU race with maintenance transition or concurrent bookings
      await tx.$queryRawUnsafe('SELECT id FROM "Vehicle" WHERE id = $1 FOR UPDATE', payload.vehicleId)

      const vehicle = await tx.vehicle.findUnique({
        where: { id: payload.vehicleId },
        select: {
          dailyRate: true,
          isActive: true,
          branchId: true,
          branch: {
            select: { name: true }
          }
        }
      })

      if (!vehicle || !vehicle.isActive) {
        throw new Error('Vehicle not found or inactive')
      }

      if (vehicle.branchId !== payload.pickupBranchId) {
        throw new Error(`Armada hanya tersedia di cabang ${vehicle.branch?.name || 'asalnya'}.`)
      }

      // Check availability inside the locked transaction
      const isAvailable = await checkVehicleAvailability(payload.vehicleId, payload.startDate, payload.endDate, tx)
      if (!isAvailable) {
        throw new Error('Mobil tidak tersedia pada rentang tanggal tersebut.')
      }

      // Calculate price purely on the server
      const pricing = calculateEstimatedPrice(
        Number(vehicle.dailyRate),
        payload.startDate,
        payload.endDate,
        payload.rentalType
      )

      const booking = await tx.booking.create({
        data: {
          customerId: payload.customerId,
          vehicleId: payload.vehicleId,
          pickupBranchId: payload.pickupBranchId,
          returnBranchId: payload.returnBranchId,
          startDate: payload.startDate,
          endDate: payload.endDate,
          rentalType: payload.rentalType,
          totalPrice: pricing.grandTotal,
          agreedDailyRate: vehicle.dailyRate,
          status: BookingStatus.pending_payment,
        }
      })

      return booking
    })
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
