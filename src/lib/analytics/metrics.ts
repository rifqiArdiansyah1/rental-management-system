import { PrismaClient, BookingStatus, PaymentStatus, RentalType, BookingChannel } from '@prisma/client'
import { parseWibDateBoundary } from '@/lib/bookingFilters'

export interface AnalyticsDateRange {
  dateFrom: string // 'YYYY-MM-DD'
  dateTo: string   // 'YYYY-MM-DD'
  startBoundary: Date // UTC Date for 00:00:00 WIB
  endBoundary: Date   // UTC Date for 23:59:59.999 WIB
}

export interface KpiMetrics {
  netCashInflow: number
  grossRentalValue: number
  totalBookings: number
  completedBookings: number
  averageOrderValue: number
  overallUtilizationRate: number // 0 - 100%
  onlineBookings: number
  walkInBookings: number
  onlinePercentage: number
  lateFeeRevenue: number
}

export interface DailyTrendItem {
  date: string // 'YYYY-MM-DD'
  formattedDate: string // e.g. "12 Okt"
  cashInflow: number
  rentalValue: number
  bookingsCount: number
}

export interface FleetPerformanceItem {
  plateNumber: string
  vehicleName: string
  categoryName: string
  branchName: string
  totalRentalHours: number
  totalRentalDays: number
  revenueGenerated: number
  utilizationRate: number // 0 - 100%
  currentOdometerKm: number | null
}

export interface ConversionFunnelData {
  created: number
  paid: number
  kycVerified: number
  ongoingOrCompleted: number
  completed: number
  cancelledExpired: number
  cancelledManual: number
}

export interface BranchComparisonItem {
  branchId: string
  branchName: string
  city: string
  cashInflow: number
  totalBookings: number
  activeVehicles: number
  utilizationRate: number
}

export interface AnalyticsSummaryResult {
  dateRange: AnalyticsDateRange
  kpi: KpiMetrics
  dailyTrends: DailyTrendItem[]
  fleetPerformance: FleetPerformanceItem[]
  funnel: ConversionFunnelData
  branchComparisons: BranchComparisonItem[]
}

/**
 * Menghasilkan rentang tanggal default 20 hari terakhir (WIB).
 */
export function getDefaultAnalyticsDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const todayWibStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now) // YYYY-MM-DD
  const [year, month, day] = todayWibStr.split('-').map(Number)

  // 20 hari terakhir inklusif hari ini: mundur 19 hari
  const startDateObj = new Date(Date.UTC(year, month - 1, day - 19))
  const dateFrom = startDateObj.toISOString().split('T')[0]

  return { dateFrom, dateTo: todayWibStr }
}

/**
 * Menghitung irisan durasi dalam jam antara dua rentang waktu.
 * Mencegah overcounting durasi sewa yang melewati batas tanggal filter (boundary clipping).
 */
export function calculateIntervalOverlapHours(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): number {
  const overlapStart = Math.max(startA.getTime(), startB.getTime())
  const overlapEnd = Math.min(endA.getTime(), endB.getTime())
  if (overlapEnd <= overlapStart) return 0
  return (overlapEnd - overlapStart) / (1000 * 60 * 60)
}

/**
 * Mengonversi tanggal ke format singkat WIB (misal: "12 Okt").
 */
export function formatDayMonthWib(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d)
}
