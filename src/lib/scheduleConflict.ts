import { prisma } from '@/utils/prisma'
import { TURNOVER_BUFFER_MS } from './constants'
import { StaffScope } from './auth/scope'
import { BookingStatus, Prisma } from '@prisma/client'

export interface ScheduleConflictResult {
  hasConflict: boolean
  type?: 'ongoing_risk' | 'upcoming_threat'
  message?: string
  conflictedBooking?: {
    id: string
    startDate: Date
    endDate: Date
    status: BookingStatus
    customerName?: string
  }
}

/**
 * Mendeteksi apakah suatu pemesanan memiliki risiko bentrok jadwal:
 * 1. Jika pesanan sedang berjalan (`ongoing`):
 *    - Cek apakah waktu sekarang sudah dalam jendela peringatan (now >= endDate - 3 jam).
 *    - Cek apakah ada pesanan berikutnya untuk unit yang sama dalam jendela turnover buffer (endDate + 3 jam).
 * 2. Jika pesanan berikutnya (`confirmed` atau `pending_payment`):
 *    - Cek apakah unit masih dipakai oleh pesanan `ongoing` yang mendekati/melebihi jadwal selesai sewa.
 */
export async function detectScheduleConflict(bookingId: string): Promise<ScheduleConflictResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      vehicleId: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  })

  if (!booking) {
    return { hasConflict: false }
  }

  const now = new Date()

  if (booking.status === BookingStatus.ongoing) {
    // Peringatan aktif jika sekarang >= endDate - 3 jam
    const isWithinWarningWindow = now.getTime() >= booking.endDate.getTime() - TURNOVER_BUFFER_MS
    if (!isWithinWarningWindow) {
      return { hasConflict: false }
    }

    // Cari pesanan berikutnya pada unit yang sama dalam buffer 3 jam
    const maxNextStartDate = new Date(booking.endDate.getTime() + TURNOVER_BUFFER_MS)
    const upcoming = await prisma.booking.findFirst({
      where: {
        vehicleId: booking.vehicleId,
        id: { not: booking.id },
        status: { in: [BookingStatus.confirmed, BookingStatus.pending_payment] },
        startDate: {
          lte: maxNextStartDate,
          gte: booking.startDate,
        },
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    if (upcoming) {
      return {
        hasConflict: true,
        type: 'ongoing_risk',
        message: 'Unit memiliki jadwal sewa berikutnya dalam jendela turnover 3 jam.',
        conflictedBooking: {
          id: upcoming.id,
          startDate: upcoming.startDate,
          endDate: upcoming.endDate,
          status: upcoming.status,
          customerName: upcoming.customer?.name,
        },
      }
    }
  }

  if (
    booking.status === BookingStatus.confirmed ||
    booking.status === BookingStatus.pending_payment
  ) {
    // Cari pesanan ongoing sebelumnya pada unit yang sama
    const minOngoingEndDate = new Date(booking.startDate.getTime() - TURNOVER_BUFFER_MS)
    const ongoing = await prisma.booking.findFirst({
      where: {
        vehicleId: booking.vehicleId,
        id: { not: booking.id },
        status: BookingStatus.ongoing,
        endDate: {
          gte: minOngoingEndDate,
          lte: booking.endDate,
        },
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { endDate: 'desc' },
    })

    if (ongoing) {
      const isWithinWarningWindow = now.getTime() >= ongoing.endDate.getTime() - TURNOVER_BUFFER_MS
      if (isWithinWarningWindow) {
        return {
          hasConflict: true,
          type: 'upcoming_threat',
          message: 'Unit armada saat ini masih dalam sewa berjalan yang berisiko terlambat kembali.',
          conflictedBooking: {
            id: ongoing.id,
            startDate: ongoing.startDate,
            endDate: ongoing.endDate,
            status: ongoing.status,
            customerName: ongoing.customer?.name,
          },
        }
      }
    }
  }

  return { hasConflict: false }
}

/**
 * Mencari seluruh ID booking yang saat ini berisiko bentrok jadwal
 * (baik booking ongoing maupun booking berikutnya yang terancam).
 * Digunakan untuk menyaring ke dalam tab antrian kerja 'action_required'.
 */
export async function findConflictRiskBookingIds(scope?: StaffScope): Promise<string[]> {
  const now = new Date()
  const warningThreshold = new Date(now.getTime() + TURNOVER_BUFFER_MS)

  const ongoingWhere: Prisma.BookingWhereInput = {
    status: BookingStatus.ongoing,
    endDate: { lte: warningThreshold },
    ...(scope?.scope === 'branch' ? { pickupBranchId: scope.branchId } : {}),
  }

  const ongoingBookings = await prisma.booking.findMany({
    where: ongoingWhere,
    select: { id: true, vehicleId: true, endDate: true, startDate: true },
  })

  if (ongoingBookings.length === 0) return []

  const conflictIds = new Set<string>()

  for (const ob of ongoingBookings) {
    const upcoming = await prisma.booking.findFirst({
      where: {
        vehicleId: ob.vehicleId,
        id: { not: ob.id },
        status: { in: [BookingStatus.confirmed, BookingStatus.pending_payment] },
        startDate: {
          lte: new Date(ob.endDate.getTime() + TURNOVER_BUFFER_MS),
          gte: ob.startDate,
        },
      },
      select: { id: true },
    })

    if (upcoming) {
      conflictIds.add(ob.id)
      conflictIds.add(upcoming.id)
    }
  }

  return Array.from(conflictIds)
}

/**
 * Helper untuk mengambil conflict status sejumlah booking sekaligus (batch)
 */
export async function getConflictRiskMap(
  bookingIds: string[]
): Promise<Map<string, ScheduleConflictResult>> {
  const map = new Map<string, ScheduleConflictResult>()
  if (bookingIds.length === 0) return map

  const results = await Promise.all(
    bookingIds.map(async (id) => {
      const conflict = await detectScheduleConflict(id)
      return { id, conflict }
    })
  )

  for (const { id, conflict } of results) {
    if (conflict.hasConflict) {
      map.set(id, conflict)
    }
  }

  return map
}
