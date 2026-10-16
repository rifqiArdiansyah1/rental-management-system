'use server'

import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, StaffScope } from '@/lib/auth/scope'
import { prisma } from '@/utils/prisma'
import { logAudit } from '@/lib/audit'
import {
  AnalyticsSummaryResult,
  AnalyticsDateRange,
  KpiMetrics,
  DailyTrendItem,
  FleetPerformanceItem,
  ConversionFunnelData,
  BranchComparisonItem,
  getDefaultAnalyticsDateRange,
  calculateIntervalOverlapHours,
  calculateAccrualRevenueProration,
  formatDayMonthWib,
  isPhysicalMaintenanceCategory,
  COST_TRACKING_START_DATE,
  DEFICIT_MIN_PERIOD_DAYS,
  DEFICIT_MIN_FLEET_AGE_DAYS
} from '@/lib/analytics/metrics'
import { parseWibDateBoundary } from '@/lib/bookingFilters'
import { BookingStatus, PaymentStatus, BookingChannel, VehicleExpenseCategory } from '@prisma/client'

interface GetAnalyticsParams {
  dateFrom?: string
  dateTo?: string
  branchId?: string
}

function escapeCsv(field: any): string {
  if (field === null || field === undefined) return '""'
  const str = String(field).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * Server Action: Mengambil data analitik terintegrasi untuk Dashboard Analisis.
 * Memisahkan secara tegas Pilar Akrual (Kinerja Armada) vs Pilar Kas (Likuiditas).
 * Otorisasi: Hanya admin_cabang dan admin_pusat (staff_cabang dilarang).
 */
export async function getAnalyticsData(params?: GetAnalyticsParams): Promise<AnalyticsSummaryResult | { error: string }> {
  try {
    const adminUser = await requireAdminSession()

    // Otorisasi Least-Privilege
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf cabang tidak memiliki otorisasi untuk mengakses data analitik finansial.' }
    }

    const scope = await getStaffScope()
    
    // Tentukan scope cabang
    let targetBranchId: string | null = null
    if (scope.scope === 'branch') {
      targetBranchId = scope.branchId
    } else if (scope.scope === 'all' && params?.branchId && params.branchId !== 'all') {
      targetBranchId = params.branchId
    }

    // Tentukan rentang tanggal (Default 20 hari terakhir)
    const defaultRange = getDefaultAnalyticsDateRange()
    const dateFromStr = params?.dateFrom || defaultRange.dateFrom
    const dateToStr = params?.dateTo || defaultRange.dateTo

    const startBoundary = parseWibDateBoundary(dateFromStr, false)
    const endBoundary = parseWibDateBoundary(dateToStr, true)

    const dateRange: AnalyticsDateRange = {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      startBoundary,
      endBoundary
    }

    const now = new Date()
    const totalWindowMs = Math.max(1, endBoundary.getTime() - startBoundary.getTime())
    const totalWindowHours = totalWindowMs / (1000 * 60 * 60)
    const windowDays = Math.round(totalWindowMs / (1000 * 60 * 60 * 24))
    const hasPartialCostData = dateFromStr < COST_TRACKING_START_DATE

    // -------------------------------------------------------------
    // 1. PILAR KAS (LIKUIDITAS): Murni dari Payment sukses & Pengeluaran Kas
    // -------------------------------------------------------------
    const paymentsWhere: any = {
      createdAt: { gte: startBoundary, lte: endBoundary },
      status: PaymentStatus.success
    }
    if (targetBranchId) {
      paymentsWhere.booking = { pickupBranchId: targetBranchId }
    }

    const expensesWhere: any = {
      expenseDate: { gte: startBoundary, lte: endBoundary },
      isVoided: false
    }
    if (targetBranchId) {
      expensesWhere.branchId = targetBranchId
    }

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: paymentsWhere,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          method: true,
          booking: {
            select: { pickupBranchId: true }
          }
        }
      }),
      prisma.vehicleExpense.findMany({
        where: expensesWhere,
        select: {
          id: true,
          amount: true,
          category: true,
          expenseDate: true,
          branchId: true,
          vehicleId: true,
          vendorName: true,
          description: true,
          vehicle: { select: { id: true, plateNumber: true, branchId: true } }
        }
      })
    ])

    // Kas Masuk Murni (Σ Payment sukses) - Denda lunas sudah tercatat sebagai row Payment terpisah
    const cashInflow = payments.reduce((sum, p) => sum + Number(p.amount), 0)

    // Pengeluaran Kas: Pisahkan Beban Pemeliharaan Fisik vs Beban Kepemilikan
    let physicalMaintenanceExpenses = 0
    let ownershipExpenses = 0
    for (const e of expenses) {
      const amt = Number(e.amount)
      if (isPhysicalMaintenanceCategory(e.category)) {
        physicalMaintenanceExpenses += amt
      } else {
        ownershipExpenses += amt
      }
    }
    const totalCashExpenses = physicalMaintenanceExpenses + ownershipExpenses
    const netCashFlow = cashInflow - totalCashExpenses

    // -------------------------------------------------------------
    // 2. DATA BOOKING: Dibuat dalam periode (Sinyal Permintaan & Funnel)
    // -------------------------------------------------------------
    const createdBookings = await prisma.booking.findMany({
      where: {
        ...(targetBranchId ? { pickupBranchId: targetBranchId } : {}),
        createdAt: { gte: startBoundary, lte: endBoundary }
      },
      select: {
        id: true,
        totalPrice: true,
        status: true,
        bookingChannel: true,
        createdAt: true,
        cancellationNote: true,
        cancelledBy: true,
        customer: {
          select: { verificationStatus: true }
        }
      }
    })

    const totalBookings = createdBookings.length
    const completedCreated = createdBookings.filter(b => b.status === BookingStatus.completed).length
    const validCreated = createdBookings.filter(
      b => b.status !== BookingStatus.cancelled && b.status !== BookingStatus.pending_payment
    )
    const newBookingsValue = validCreated.reduce((sum, b) => sum + Number(b.totalPrice), 0)
    const averageOrderValue = validCreated.length > 0 ? Math.round(newBookingsValue / validCreated.length) : 0

    const onlineBookings = createdBookings.filter(b => b.bookingChannel === BookingChannel.online).length
    const walkInBookings = createdBookings.filter(b => b.bookingChannel === BookingChannel.walk_in).length
    const onlinePercentage = totalBookings > 0 ? Math.round((onlineBookings / totalBookings) * 100) : 0

    const funnel: ConversionFunnelData = {
      created: totalBookings,
      paid: createdBookings.filter(b => b.status !== BookingStatus.pending_payment).length,
      kycVerified: createdBookings.filter(b => b.customer.verificationStatus === 'verified').length,
      ongoingOrCompleted: createdBookings.filter(b => b.status === BookingStatus.ongoing || b.status === BookingStatus.completed).length,
      completed: completedCreated,
      cancelledExpired: createdBookings.filter(b => b.status === BookingStatus.cancelled && (b.cancellationNote?.includes('60 menit') || b.cancelledBy === 'SYSTEM_CRON_AUTO_CANCEL')).length,
      cancelledManual: createdBookings.filter(b => b.status === BookingStatus.cancelled && !(b.cancellationNote?.includes('60 menit') || b.cancelledBy === 'SYSTEM_CRON_AUTO_CANCEL')).length
    }

    // -------------------------------------------------------------
    // 3. PILAR AKRUAL: Prorata Sewa Beririsan (Status: confirmed, ongoing, completed)
    // -------------------------------------------------------------
    const accrualBookings = await prisma.booking.findMany({
      where: {
        ...(targetBranchId ? { pickupBranchId: targetBranchId } : {}),
        status: { in: [BookingStatus.confirmed, BookingStatus.ongoing, BookingStatus.completed] },
        startDate: { lte: endBoundary },
        endDate: { gte: startBoundary }
      },
      select: {
        id: true,
        vehicleId: true,
        startDate: true,
        endDate: true,
        totalPrice: true,
        status: true,
        actualReturnAt: true,
        lateFeeAmount: true,
        lateFeeWaived: true,
        pickupBranchId: true
      }
    })

    let accruedRealizedRevenue = 0
    let accruedScheduledRevenue = 0
    let lateFeeAccrued = 0

    // Map agregasi akrual per kendaraan
    const vehicleAccrualMap = new Map<string, {
      realized: number
      scheduled: number
      hours: number
      lateFee: number
    }>()

    // Map denda harian (WIB)
    const dailyLateFeeMap = new Map<string, number>()

    for (const b of accrualBookings) {
      const proration = calculateAccrualRevenueProration(
        b.startDate,
        b.endDate,
        Number(b.totalPrice),
        startBoundary,
        endBoundary,
        now
      )

      accruedRealizedRevenue += proration.realizedRevenue
      accruedScheduledRevenue += proration.scheduledRevenue

      let vEntry = vehicleAccrualMap.get(b.vehicleId)
      if (!vEntry) {
        vEntry = { realized: 0, scheduled: 0, hours: 0, lateFee: 0 }
        vehicleAccrualMap.set(b.vehicleId, vEntry)
      }
      vEntry.realized += proration.realizedRevenue
      vEntry.scheduled += proration.scheduledRevenue
      vEntry.hours += proration.totalOverlapHours

      // Akrual Denda: Diakui pada tanggal actualReturnAt jika jatuh dalam rentang filter
      if (
        b.status === BookingStatus.completed &&
        b.actualReturnAt &&
        b.actualReturnAt >= startBoundary &&
        b.actualReturnAt <= endBoundary &&
        !b.lateFeeWaived &&
        b.lateFeeAmount &&
        Number(b.lateFeeAmount) > 0
      ) {
        const lf = Number(b.lateFeeAmount)
        lateFeeAccrued += lf
        accruedRealizedRevenue += lf
        vEntry.realized += lf
        vEntry.lateFee += lf

        const returnDateWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(b.actualReturnAt))
        dailyLateFeeMap.set(returnDateWib, (dailyLateFeeMap.get(returnDateWib) || 0) + lf)
      }
    }

    const totalAccruedRevenue = accruedRealizedRevenue + accruedScheduledRevenue
    const operatingProfitMargin = accruedRealizedRevenue - physicalMaintenanceExpenses

    // -------------------------------------------------------------
    // 4. TREN HARIAN (Daily Trends dalam Timezone WIB)
    // -------------------------------------------------------------
    const dailyMap = new Map<string, {
      cashInflow: number
      maintenanceExpense: number
      accruedRevenue: number
      bookingsCount: number
    }>()
    
    // Inisialisasi kalender harian
    const curDate = new Date(dateFromStr + 'T00:00:00Z')
    const endDateObj = new Date(dateToStr + 'T00:00:00Z')
    while (curDate <= endDateObj) {
      const key = curDate.toISOString().split('T')[0]
      dailyMap.set(key, { cashInflow: 0, maintenanceExpense: 0, accruedRevenue: 0, bookingsCount: 0 })
      curDate.setUTCDate(curDate.getUTCDate() + 1)
    }

    // Kas Masuk ke Hari WIB
    for (const p of payments) {
      const pWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(p.createdAt))
      const entry = dailyMap.get(pWib)
      if (entry) entry.cashInflow += Number(p.amount)
    }

    // Pengeluaran Pemeliharaan ke Hari WIB
    for (const e of expenses) {
      const eWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(e.expenseDate))
      const entry = dailyMap.get(eWib)
      if (entry) entry.maintenanceExpense += Number(e.amount)
    }

    // Booking dibuat ke Hari WIB
    for (const b of createdBookings) {
      const bWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(b.createdAt))
      const entry = dailyMap.get(bWib)
      if (entry) entry.bookingsCount += 1
    }

    // Akrual Sewa per Hari WIB (prorata per 24 jam)
    for (const [dateKey, entry] of dailyMap.entries()) {
      const dayStart = parseWibDateBoundary(dateKey, false)
      const dayEnd = parseWibDateBoundary(dateKey, true)
      
      let dayAccrued = 0
      for (const b of accrualBookings) {
        const p = calculateAccrualRevenueProration(
          b.startDate,
          b.endDate,
          Number(b.totalPrice),
          dayStart,
          dayEnd,
          now
        )
        dayAccrued += p.realizedRevenue
      }

      // Tambahkan denda yang jatuh pada hari ini
      const dayLf = dailyLateFeeMap.get(dateKey) || 0
      dayAccrued += dayLf

      entry.accruedRevenue = dayAccrued
    }

    const dailyTrends: DailyTrendItem[] = Array.from(dailyMap.entries()).map(([dateKey, val]) => ({
      date: dateKey,
      formattedDate: formatDayMonthWib(dateKey),
      cashInflow: Math.round(val.cashInflow),
      maintenanceExpense: Math.round(val.maintenanceExpense),
      netCashFlow: Math.round(val.cashInflow - val.maintenanceExpense),
      accruedRevenue: Math.round(val.accruedRevenue),
      rentalValue: Math.round(val.accruedRevenue), // alias
      bookingsCount: val.bookingsCount
    }))

    // -------------------------------------------------------------
    // 5. PERFORMA ARMADA & UTILISASI (Tingkat Unit Individu)
    // -------------------------------------------------------------
    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        isActive: true
      },
      include: {
        category: true,
        branch: true
      }
    })

    // Agregasi biaya per kendaraan (pisahkan fisik vs kepemilikan)
    const expenseByVehicle = new Map<string, {
      physical: number
      ownership: number
      largestCategory?: string
      largestAmount: number
    }>()

    for (const e of expenses) {
      let vExp = expenseByVehicle.get(e.vehicleId)
      if (!vExp) {
        vExp = { physical: 0, ownership: 0, largestAmount: 0 }
        expenseByVehicle.set(e.vehicleId, vExp)
      }
      const amt = Number(e.amount)
      if (isPhysicalMaintenanceCategory(e.category)) {
        vExp.physical += amt
      } else {
        vExp.ownership += amt
      }
      if (amt > vExp.largestAmount) {
        vExp.largestAmount = amt
        vExp.largestCategory = e.category
      }
    }

    let totalRentedHoursAllFleet = 0
    const totalCapacityHoursAllFleet = vehicles.length * totalWindowHours

    const fleetPerformance: FleetPerformanceItem[] = vehicles.map(v => {
      const vAccrual = vehicleAccrualMap.get(v.id) || { realized: 0, scheduled: 0, hours: 0, lateFee: 0 }
      const vExp = expenseByVehicle.get(v.id) || { physical: 0, ownership: 0, largestAmount: 0 }

      const vRealizedRev = Math.round(vAccrual.realized)
      const vScheduledRev = Math.round(vAccrual.scheduled)
      const vPhysicalExp = Math.round(vExp.physical)
      const vOwnershipExp = Math.round(vExp.ownership)
      const vOperatingMargin = vRealizedRev - vPhysicalExp

      totalRentedHoursAllFleet += vAccrual.hours
      const utilizationRate = Math.min(100, Math.round((vAccrual.hours / totalWindowHours) * 100))

      const vehicleAgeDays = Math.max(0, Math.floor((now.getTime() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
      const isDeficitQualified = windowDays >= DEFICIT_MIN_PERIOD_DAYS && vehicleAgeDays >= DEFICIT_MIN_FLEET_AGE_DAYS
      const isDeficit = vOperatingMargin < 0

      return {
        plateNumber: v.plateNumber,
        vehicleName: v.name || v.category.name,
        categoryName: v.category.name,
        branchName: v.branch.name,
        totalRentalHours: Math.round(vAccrual.hours),
        totalRentalDays: Number((vAccrual.hours / 24).toFixed(1)),
        accruedRealizedRevenue: vRealizedRev,
        accruedScheduledRevenue: vScheduledRev,
        physicalMaintenanceExpenses: vPhysicalExp,
        ownershipExpenses: vOwnershipExp,
        operatingProfitMargin: vOperatingMargin,
        utilizationRate,
        currentOdometerKm: v.currentOdometerKm != null ? Number(v.currentOdometerKm) : null,
        vehicleAgeDays,
        isDeficitQualified,
        isDeficit,
        largestExpenseCategory: vExp.largestCategory,
        largestExpenseAmount: vExp.largestAmount > 0 ? vExp.largestAmount : undefined,
        // Backwards compatibility
        revenueGenerated: vRealizedRev,
        maintenanceExpenses: vPhysicalExp,
        unitProfitMargin: vOperatingMargin
      }
    })

    // Urutkan performa armada dari margin operasional tertinggi
    fleetPerformance.sort((a, b) => b.operatingProfitMargin - a.operatingProfitMargin)

    const overallUtilizationRate = totalCapacityHoursAllFleet > 0
      ? Math.min(100, Math.round((totalRentedHoursAllFleet / totalCapacityHoursAllFleet) * 100))
      : 0

    // -------------------------------------------------------------
    // 6. PERBANDINGAN ANTAR CABANG (Khusus admin_pusat)
    // -------------------------------------------------------------
    const branchComparisons: BranchComparisonItem[] = []
    if (scope.scope === 'all') {
      const branches = await prisma.branch.findMany({
        where: { isActive: true },
        include: {
          vehicles: { where: { isActive: true } },
          pickups: {
            where: {
              createdAt: { gte: startBoundary, lte: endBoundary }
            },
            select: { id: true, totalPrice: true, status: true }
          }
        }
      })

      for (const b of branches) {
        const bPayments = payments.filter(p => p.booking?.pickupBranchId === b.id)
        const bCashInflow = bPayments.reduce((s, p) => s + Number(p.amount), 0)
        const bExpenses = expenses.filter(e => e.branchId === b.id).reduce((s, e) => s + Number(e.amount), 0)
        
        branchComparisons.push({
          branchId: b.id,
          branchName: b.name,
          city: b.city,
          cashInflow: bCashInflow,
          maintenanceExpenses: Math.round(bExpenses),
          netCashFlow: Math.round(bCashInflow - bExpenses),
          totalBookings: b.pickups.length,
          activeVehicles: b.vehicles.length,
          utilizationRate: 0
        })
      }
      branchComparisons.sort((a, b) => b.cashInflow - a.cashInflow)
    }

    const kpi: KpiMetrics = {
      // Pilar Akrual
      accruedRealizedRevenue: Math.round(accruedRealizedRevenue),
      accruedScheduledRevenue: Math.round(accruedScheduledRevenue),
      totalAccruedRevenue: Math.round(totalAccruedRevenue),
      physicalMaintenanceExpenses: Math.round(physicalMaintenanceExpenses),
      operatingProfitMargin: Math.round(operatingProfitMargin),
      ownershipExpenses: Math.round(ownershipExpenses),
      newBookingsValue: Math.round(newBookingsValue),
      lateFeeAccrued: Math.round(lateFeeAccrued),

      // Pilar Kas
      cashInflow: Math.round(cashInflow),
      totalCashExpenses: Math.round(totalCashExpenses),
      netCashFlow: Math.round(netCashFlow),

      // Operasional
      totalBookings,
      completedBookings: completedCreated,
      averageOrderValue,
      overallUtilizationRate,
      onlineBookings,
      walkInBookings,
      onlinePercentage,

      // Aliases
      netCashInflow: Math.round(cashInflow),
      totalMaintenanceExpenses: Math.round(physicalMaintenanceExpenses),
      netOperatingCashFlow: Math.round(netCashFlow),
      grossRentalValue: Math.round(newBookingsValue),
      lateFeeRevenue: Math.round(lateFeeAccrued)
    }

    return {
      dateRange,
      kpi,
      dailyTrends,
      fleetPerformance,
      funnel,
      branchComparisons,
      hasPartialCostData,
      costTrackingStartDate: COST_TRACKING_START_DATE,
      windowDays
    }
  } catch (error: any) {
    console.error('[ANALYTICS_ERROR] getAnalyticsData failed:', error)
    return { error: error.message || 'Gagal memproses data analitik.' }
  }
}

/**
 * Server Action: Ekspor Data Analitik CSV Terlindungi Kepatuhan UU PDP
 * - Nomor NIK dan SIM mutlak tidak dimasukkan.
 * - Format kolom memisahkan Akrual & Kas secara transparan.
 * - Setiap ekspor wajib tercatat di AuditLog.
 */
export async function exportAnalyticsCsvAction(params: {
  dateFrom?: string
  dateTo?: string
  branchId?: string
  type: 'daily_summary' | 'fleet_performance'
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Anda tidak memiliki wewenang untuk mengunduh laporan analitik.' }
    }

    const analyticsData = await getAnalyticsData(params)
    if ('error' in analyticsData) {
      return { error: analyticsData.error }
    }

    let csvContent = ''
    let filename = ''
    let rowCount = 0

    if (params.type === 'daily_summary') {
      const headers = [
        'Tanggal (WIB)',
        'Kas Masuk (IDR)',
        'Kas Keluar Biaya Armada (IDR)',
        'Arus Kas Bersih (IDR)',
        'Pendapatan Akrual (IDR)',
        'Volume Pesanan Dibuat'
      ]
      const rows = [headers.join(',')]
      for (const item of analyticsData.dailyTrends) {
        rows.push([
          escapeCsv(item.date),
          escapeCsv(item.cashInflow),
          escapeCsv(item.maintenanceExpense),
          escapeCsv(item.netCashFlow),
          escapeCsv(item.accruedRevenue),
          escapeCsv(item.bookingsCount)
        ].join(','))
      }
      csvContent = '\uFEFF' + rows.join('\r\n')
      filename = `analitik-harian-${analyticsData.dateRange.dateFrom}_sd_${analyticsData.dateRange.dateTo}.csv`
      rowCount = analyticsData.dailyTrends.length
    } else {
      const headers = [
        'Plat Nomor',
        'Armada',
        'Kategori',
        'Cabang',
        'Total Hari Disewa',
        'Pendapatan Akrual Terealisasi (IDR)',
        'Biaya Pemeliharaan Fisik (IDR)',
        'Beban Kepemilikan (IDR)',
        'Margin Operasional Armada (IDR)',
        'Tingkat Utilisasi (%)',
        'Odometer Terkini (KM)'
      ]
      const rows = [headers.join(',')]
      for (const item of analyticsData.fleetPerformance) {
        rows.push([
          escapeCsv(item.plateNumber),
          escapeCsv(item.vehicleName),
          escapeCsv(item.categoryName),
          escapeCsv(item.branchName),
          escapeCsv(item.totalRentalDays),
          escapeCsv(item.accruedRealizedRevenue),
          escapeCsv(item.physicalMaintenanceExpenses),
          escapeCsv(item.ownershipExpenses),
          escapeCsv(item.operatingProfitMargin),
          escapeCsv(`${item.utilizationRate}%`),
          escapeCsv(item.currentOdometerKm != null ? `${item.currentOdometerKm} km` : '-')
        ].join(','))
      }
      csvContent = '\uFEFF' + rows.join('\r\n')
      filename = `performa-armada-${analyticsData.dateRange.dateFrom}_sd_${analyticsData.dateRange.dateTo}.csv`
      rowCount = analyticsData.fleetPerformance.length
    }

    // Catat Audit Log Wajib UU PDP
    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: adminUser.branchId || null,
      action: 'analytics.export_csv',
      entityType: 'Booking',
      entityId: `export_${params.type}`,
      metadata: {
        dateFrom: analyticsData.dateRange.dateFrom,
        dateTo: analyticsData.dateRange.dateTo,
        exportType: params.type,
        rowCount,
        targetBranchId: params.branchId || 'all'
      }
    })

    return {
      success: true,
      csvContent,
      filename,
      rowCount
    }
  } catch (error: any) {
    console.error('[EXPORT_CSV_ERROR] exportAnalyticsCsvAction failed:', error)
    return { error: error.message || 'Gagal mengekspor laporan CSV.' }
  }
}
