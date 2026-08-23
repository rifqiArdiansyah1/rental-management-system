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

/**
 * Single source of truth for driver availability across a date range.
 * 
 * Rules:
 * 1. Driver must belong to the specified branchId.
 * 2. Driver must be active (isActive: true).
 * 3. Driver must NOT have overlapping active bookings (status: pending_payment, confirmed, ongoing).
 * 4. Driver must NOT have overlapping DriverLeave periods.
 * 
 * Note: Driver.status (e.g. off_duty) is an operational real-time indicator for "today",
 * so it is NOT used to exclude drivers from future bookings. DriverLeave is the single source of truth for dates.
 */
export async function getEligibleDrivers(
  branchId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string
): Promise<EligibleDriver[]> {
  // Query all active drivers in the branch with their active bookings and leaves
  const drivers = await prisma.driver.findMany({
    where: {
      branchId,
      isActive: true
    },
    include: {
      bookings: {
        where: {
          id: excludeBookingId ? { not: excludeBookingId } : undefined,
          status: { in: ['pending_payment', 'confirmed', 'ongoing'] },
          startDate: { lt: endDate },
          endDate: { gt: startDate }
        },
        select: { id: true }
      },
      leaves: {
        where: {
          startDate: { lt: endDate },
          endDate: { gt: startDate }
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
