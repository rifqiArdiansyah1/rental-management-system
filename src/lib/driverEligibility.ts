import { prisma } from '@/utils/prisma'

export interface EligibleDriver {
  id: string
  name: string
  licenseNumber: string
  phone: string
  dailyFee: number
  status: string
  branchId: string
}

export interface EligibleDriverOptions {
  excludeBookingId?: string
  effectiveStartDate?: Date
  requireCurrentlyAvailable?: boolean
}

/**
 * Single source of truth for driver availability across a date range.
 * 
 * Rules:
 * 1. Driver must belong to the specified branchId.
 * 2. Driver must be active (isActive: true).
 * 3. Driver must NOT have overlapping active bookings (status: pending_payment, confirmed, ongoing) with 3h buffer.
 * 4. Driver must NOT have overlapping DriverLeave periods relative to effectiveStartDate.
 * 5. If requireCurrentlyAvailable is true, driver must have status 'available' right now.
 */
export async function getEligibleDrivers(
  branchId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingIdOrOptions?: string | EligibleDriverOptions,
  extraOptions?: EligibleDriverOptions
): Promise<EligibleDriver[]> {
  const options: EligibleDriverOptions = typeof excludeBookingIdOrOptions === 'string'
    ? { excludeBookingId: excludeBookingIdOrOptions, ...extraOptions }
    : (excludeBookingIdOrOptions || {})

  const effectiveStart = options.effectiveStartDate || startDate
  const bufferEnd = new Date(endDate.getTime() + 3 * 60 * 60 * 1000)
  const bufferStart = new Date(effectiveStart.getTime() - 3 * 60 * 60 * 1000)

  // Query all active drivers in the branch with their active bookings and leaves
  const drivers = await prisma.driver.findMany({
    where: {
      branchId,
      isActive: true,
      ...(options.requireCurrentlyAvailable ? { status: 'available' } : {})
    },
    include: {
      bookings: {
        where: {
          id: options.excludeBookingId ? { not: options.excludeBookingId } : undefined,
          status: { in: ['pending_payment', 'confirmed', 'ongoing'] },
          startDate: { lt: bufferEnd },
          endDate: { gt: bufferStart }
        },
        select: { id: true }
      },
      leaves: {
        where: {
          startDate: { lt: endDate },
          endDate: { gt: effectiveStart }
        },
        select: { id: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  // Filter out drivers who have overlapping bookings or leaves
  const eligible = drivers.filter(driver => {
    const hasBookingConflict = driver.bookings.length > 0
    const hasLeaveConflict = driver.leaves.length > 0
    return !hasBookingConflict && !hasLeaveConflict
  })

  return eligible.map(d => ({
    id: d.id,
    name: d.name,
    licenseNumber: d.licenseNumber,
    phone: d.phone,
    dailyFee: Number(d.dailyFee),
    status: d.status,
    branchId: d.branchId
  }))
}
