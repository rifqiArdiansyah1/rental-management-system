import { PrismaClient, BookingStatus, PaymentStatus, RentalType, BookingChannel, VehicleExpenseCategory } from '@prisma/client'
import { parseWibDateBoundary } from '@/lib/bookingFilters'

export { COST_TRACKING_START_DATE, DEFICIT_MIN_PERIOD_DAYS, DEFICIT_MIN_FLEET_AGE_DAYS } from '@/lib/constants'

export interface AnalyticsDateRange {
  dateFrom: string // 'YYYY-MM-DD'
  dateTo: string   // 'YYYY-MM-DD'
  startBoundary: Date // UTC Date for 00:00:00 WIB
  endBoundary: Date   // UTC Date for 23:59:59.999 WIB
}

export interface KpiMetrics {
  // Pilar Akrual (Kinerja Operasional Armada)
  accruedRealizedRevenue: number       // Pendapatan sewa terealisasi (waktu berlalu <= now + denda)
  accruedScheduledRevenue: number      // Pipeline sewa terjadwal di masa depan (waktu > now)
  totalAccruedRevenue: number          // Total akrual (terealisasi + pipeline terjadwal)
  physicalMaintenanceExpenses: number  // Beban pemeliharaan fisik (servis, perbaikan, ban, cuci, lain-lain)
  operatingProfitMargin: number        // Margin Operasional Armada (accruedRealizedRevenue - physicalMaintenanceExpenses)
  ownershipExpenses: number            // Beban kepemilikan / legalitas (pajak STNK, asuransi armada)
  newBookingsValue: number             // Nilai pemesanan baru dibuat dalam periode (sinyal permintaan)
  lateFeeAccrued: number               // Akrual denda keterlambatan (pada actualReturnAt)

  // Pilar Kas (Likuiditas & Kas Masuk/Keluar Riil Cabang)
  cashInflow: number                   // Kas Masuk Murni (Σ Payment status: 'success')
  totalCashExpenses: number            // Kas Keluar Pemeliharaan Armada (Σ VehicleExpense non-voided)
  netCashFlow: number                  // Arus Kas Operasional Bersih (cashInflow - totalCashExpenses)

  // Operasional & Permintaan
  totalBookings: number
  completedBookings: number
  averageOrderValue: number
  overallUtilizationRate: number       // 0 - 100%
  onlineBookings: number
  walkInBookings: number
  onlinePercentage: number

  // Backwards-compatible aliases
  netCashInflow: number                // Alias for cashInflow
  totalMaintenanceExpenses: number     // Alias for physicalMaintenanceExpenses
  netOperatingCashFlow: number         // Alias for netCashFlow
  grossRentalValue: number             // Alias for newBookingsValue
  lateFeeRevenue: number               // Alias for lateFeeAccrued
}

export interface DailyTrendItem {
  date: string // 'YYYY-MM-DD'
  formattedDate: string // e.g. "12 Okt"
  cashInflow: number
  maintenanceExpense: number
  netCashFlow: number
  accruedRevenue: number
  rentalValue: number // Alias for accruedRevenue / newBookingsValue
  bookingsCount: number
}

export interface FleetPerformanceItem {
  plateNumber: string
  vehicleName: string
  categoryName: string
  branchName: string
  totalRentalHours: number
  totalRentalDays: number
  accruedRealizedRevenue: number
  accruedScheduledRevenue: number
  physicalMaintenanceExpenses: number
  ownershipExpenses: number
  operatingProfitMargin: number        // accruedRealizedRevenue - physicalMaintenanceExpenses
  utilizationRate: number              // 0 - 100%
  currentOdometerKm: number | null
  vehicleAgeDays: number
  isDeficitQualified: boolean          // window >= 90 hari & umur unit >= 90 hari
  isDeficit: boolean                   // operatingProfitMargin < 0
  largestExpenseCategory?: string
  largestExpenseAmount?: number

  // Backwards-compatible aliases
  revenueGenerated: number             // Alias for accruedRealizedRevenue
  maintenanceExpenses: number          // Alias for physicalMaintenanceExpenses
  unitProfitMargin: number             // Alias for operatingProfitMargin
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
  maintenanceExpenses: number
  netCashFlow: number
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
  hasPartialCostData: boolean          // true jika dateFrom < COST_TRACKING_START_DATE
  costTrackingStartDate: string
  windowDays: number
}

/**
 * Kategori pemeliharaan fisik vs kepemilikan/legalitas.
 */
export const PHYSICAL_MAINTENANCE_CATEGORIES: VehicleExpenseCategory[] = [
  VehicleExpenseCategory.routine_service,
  VehicleExpenseCategory.repair,
  VehicleExpenseCategory.tires,
  VehicleExpenseCategory.detailing,
  VehicleExpenseCategory.other,
]

export const OWNERSHIP_EXPENSE_CATEGORIES: VehicleExpenseCategory[] = [
  VehicleExpenseCategory.tax_registration,
  VehicleExpenseCategory.insurance,
]

export function isPhysicalMaintenanceCategory(cat: VehicleExpenseCategory): boolean {
  return PHYSICAL_MAINTENANCE_CATEGORIES.includes(cat)
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
 * Menghitung prorata pendapatan akrual: memisahkan pendapatan terealisasi (<= now) vs terjadwal (> now).
 * Jumlah prorata di seluruh segmen booking selalu sama persis dengan totalPrice.
 */
export function calculateAccrualRevenueProration(
  bookingStart: Date,
  bookingEnd: Date,
  totalPrice: number,
  windowStart: Date,
  windowEnd: Date,
  now: Date = new Date()
): {
  realizedHours: number
  scheduledHours: number
  totalOverlapHours: number
  realizedRevenue: number
  scheduledRevenue: number
} {
  const totalBookingMs = bookingEnd.getTime() - bookingStart.getTime()
  if (totalBookingMs <= 0 || totalPrice <= 0) {
    return { realizedHours: 0, scheduledHours: 0, totalOverlapHours: 0, realizedRevenue: 0, scheduledRevenue: 0 }
  }

  const overlapStartMs = Math.max(bookingStart.getTime(), windowStart.getTime())
  const overlapEndMs = Math.min(bookingEnd.getTime(), windowEnd.getTime())
  if (overlapEndMs <= overlapStartMs) {
    return { realizedHours: 0, scheduledHours: 0, totalOverlapHours: 0, realizedRevenue: 0, scheduledRevenue: 0 }
  }

  const nowMs = now.getTime()
  const pricePerHour = totalPrice / (totalBookingMs / (1000 * 60 * 60))

  // Porsi Terealisasi: [overlapStartMs, min(overlapEndMs, nowMs)]
  const realizedEndMs = Math.min(overlapEndMs, nowMs)
  const realizedMs = Math.max(0, realizedEndMs - overlapStartMs)
  const realizedHours = realizedMs / (1000 * 60 * 60)
  const realizedRevenue = Math.round(realizedHours * pricePerHour)

  // Porsi Terjadwal/Pipeline: [max(overlapStartMs, nowMs), overlapEndMs]
  const scheduledStartMs = Math.max(overlapStartMs, nowMs)
  const scheduledMs = Math.max(0, overlapEndMs - scheduledStartMs)
  const scheduledHours = scheduledMs / (1000 * 60 * 60)
  const scheduledRevenue = Math.round(scheduledHours * pricePerHour)

  return {
    realizedHours,
    scheduledHours,
    totalOverlapHours: (overlapEndMs - overlapStartMs) / (1000 * 60 * 60),
    realizedRevenue,
    scheduledRevenue
  }
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
