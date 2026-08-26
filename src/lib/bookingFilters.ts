import { Prisma, BookingStatus, RentalType } from '@prisma/client'
import { StaffScope } from '@/lib/auth/scope'

export interface BookingFilterParams {
  tab?: string // 'action_required' | 'handover_today' | 'ongoing' | 'all'
  q?: string
  status?: string // 'all' | 'active' | BookingStatus
  rentalType?: string // 'all' | 'self_drive' | 'with_driver'
  driverId?: string // 'all' | 'unassigned' | string
  branchId?: string // 'all' | string
  dateType?: 'pickup' | 'created'
  dateFrom?: string // 'YYYY-MM-DD'
  dateTo?: string // 'YYYY-MM-DD'
}

/**
 * Mengonversi tanggal kalender 'YYYY-MM-DD' ke zona waktu WIB (Asia/Jakarta, UTC+7).
 * - Start of day (00:00:00.000 WIB) = (day - 1) 17:00:00.000 UTC
 * - End of day (23:59:59.999 WIB) = day 16:59:59.999 UTC
 */
export function parseWibDateBoundary(dateStr: string, isEndOfDay: boolean = false): Date {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    return new Date()
  }
  const [year, month, day] = parts

  if (isEndOfDay) {
    return new Date(Date.UTC(year, month - 1, day, 16, 59, 59, 999))
  } else {
    return new Date(Date.UTC(year, month - 1, day - 1, 17, 0, 0, 0))
  }
}

/**
 * Format tanggal UTC ke string representasi lokal WIB (Asia/Jakarta)
 */
export function formatWibDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d) + ' WIB'
}

/**
 * Format tanggal saja dalam WIB
 */
export function formatWibDateOnly(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/**
 * Membangun Prisma Where Clause secara konsisten untuk UI Table & Export CSV
 */
export function buildBookingWhereClause(
  params: BookingFilterParams,
  scope: StaffScope
): Prisma.BookingWhereInput {
  const andConditions: Prisma.BookingWhereInput[] = []

  // 1. Branch Scoping
  if (scope.scope === 'branch') {
    andConditions.push({ pickupBranchId: scope.branchId })
  } else if (scope.scope === 'all' && params.branchId && params.branchId !== 'all') {
    andConditions.push({ pickupBranchId: params.branchId })
  }

  const now = new Date()
  const todayWibStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now)
  const endOfTodayWib = parseWibDateBoundary(todayWibStr, true)

  // 2. Preset Action Tabs
  const currentTab = params.tab || 'action_required'

  if (currentTab === 'action_required') {
    andConditions.push({
      OR: [
        // a. KYC pending atau rejected pada booking confirmed
        {
          status: BookingStatus.confirmed,
          customer: { verificationStatus: { in: ['pending', 'rejected'] } }
        },
        // b. Rental with_driver yang belum ditugaskan sopir
        {
          rentalType: RentalType.with_driver,
          status: { in: [BookingStatus.pending_payment, BookingStatus.confirmed] },
          driverId: null
        },
        // c. Booking cancelled yang pembayarannya telah sukses (perlu refund follow-up)
        {
          status: BookingStatus.cancelled,
          payments: { some: { status: 'success' } }
        },
        // d. Booking confirmed yang jadwal serah-terima hari ini atau terlewat
        {
          status: BookingStatus.confirmed,
          startDate: { lte: endOfTodayWib }
        },
        // e. Booking ongoing yang tanggal kembalinya sudah lewat (terlambat kembali)
        {
          status: BookingStatus.ongoing,
          endDate: { lt: now }
        }
      ]
    })
  } else if (currentTab === 'handover_today') {
    // Serah-terima siap hari ini atau terlambat serah-terima
    andConditions.push({
      status: BookingStatus.confirmed,
      startDate: { lte: endOfTodayWib }
    })
  } else if (currentTab === 'ongoing') {
    andConditions.push({
      status: BookingStatus.ongoing
    })
  }

  // 3. Status Filter (jika pada tab 'all' atau override status)
  if (params.status && params.status !== 'all') {
    if (params.status === 'active') {
      andConditions.push({
        status: { in: [BookingStatus.pending_payment, BookingStatus.confirmed, BookingStatus.ongoing] }
      })
    } else if (Object.values(BookingStatus).includes(params.status as BookingStatus)) {
      andConditions.push({
        status: params.status as BookingStatus
      })
    }
  }

  // 4. Rental Type Filter
  if (params.rentalType && params.rentalType !== 'all') {
    if (params.rentalType === 'self_drive' || params.rentalType === 'with_driver') {
      andConditions.push({ rentalType: params.rentalType as RentalType })
    }
  }

  // 5. Driver Filter
  if (params.driverId && params.driverId !== 'all') {
    if (params.driverId === 'unassigned') {
      andConditions.push({
        rentalType: RentalType.with_driver,
        driverId: null
      })
    } else {
      andConditions.push({ driverId: params.driverId })
    }
  }

  // 6. Date Range Filtering dengan Konversi WIB
  const dateType = params.dateType || 'pickup'
  if (params.dateFrom || params.dateTo) {
    const fromUtc = params.dateFrom ? parseWibDateBoundary(params.dateFrom, false) : undefined
    const toUtc = params.dateTo ? parseWibDateBoundary(params.dateTo, true) : undefined

    if (dateType === 'created') {
      andConditions.push({
        createdAt: {
          gte: fromUtc,
          lte: toUtc
        }
      })
    } else {
      // Pickup / Rental Date
      if (fromUtc && toUtc) {
        andConditions.push({
          startDate: { lte: toUtc },
          endDate: { gte: fromUtc }
        })
      } else if (fromUtc) {
        andConditions.push({
          endDate: { gte: fromUtc }
        })
      } else if (toUtc) {
        andConditions.push({
          startDate: { lte: toUtc }
        })
      }
    }
  }

  // 7. Multi-column Text Search (q)
  if (params.q && params.q.trim() !== '') {
    const rawQ = params.q.trim()
    andConditions.push({
      OR: [
        { id: { contains: rawQ, mode: 'insensitive' } },
        { customer: { name: { contains: rawQ, mode: 'insensitive' } } },
        { customer: { email: { contains: rawQ, mode: 'insensitive' } } },
        { customer: { phone: { contains: rawQ } } },
        { vehicle: { plateNumber: { contains: rawQ, mode: 'insensitive' } } },
        { vehicle: { name: { contains: rawQ, mode: 'insensitive' } } }
      ]
    })
  }

  return andConditions.length > 0 ? { AND: andConditions } : {}
}
