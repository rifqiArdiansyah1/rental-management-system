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
  formatDayMonthWib
} from '@/lib/analytics/metrics'
import { parseWibDateBoundary, formatWibDateTime } from '@/lib/bookingFilters'
import { BookingStatus, PaymentStatus, BookingChannel } from '@prisma/client'

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

    const totalWindowHours = Math.max(1, (endBoundary.getTime() - startBoundary.getTime()) / (1000 * 60 * 60))

    // 1. Ambil data Pembayaran (Basis Kas)
    const paymentsWhere: any = {
      createdAt: { gte: startBoundary, lte: endBoundary },
      status: PaymentStatus.success
    }
    if (targetBranchId) {
      paymentsWhere.booking = { pickupBranchId: targetBranchId }
    }

    const [payments, lateFeeBookings, refundedPayments] = await Promise.all([
      prisma.payment.findMany({
        where: paymentsWhere,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          booking: {
            select: { pickupBranchId: true }
          }
        }
      }),
      prisma.booking.findMany({
        where: {
          ...(targetBranchId ? { pickupBranchId: targetBranchId } : {}),
          status: BookingStatus.completed,
          actualReturnAt: { gte: startBoundary, lte: endBoundary },
          lateFeeWaived: false,
          lateFeeAmount: { gt: 0 }
        },
        select: {
          id: true,
          lateFeeAmount: true,
          actualReturnAt: true,
          pickupBranchId: true
        }
      }),
      prisma.payment.findMany({
        where: {
          ...(targetBranchId ? { booking: { pickupBranchId: targetBranchId } } : {}),
          status: PaymentStatus.refunded,
          updatedAt: { gte: startBoundary, lte: endBoundary }
        },
        select: { amount: true }
      })
    ])

    const totalSettledPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalLateFeeRevenue = lateFeeBookings.reduce((sum, b) => sum + Number(b.lateFeeAmount || 0), 0)
    const totalRefunds = refundedPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const netCashInflow = totalSettledPayments + totalLateFeeRevenue - totalRefunds

    // 2. Ambil data Booking dalam rentang waktu
    const bookings = await prisma.booking.findMany({
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

    const totalBookings = bookings.length
    const completedBookings = bookings.filter(b => b.status === BookingStatus.completed).length
    const grossRentalValue = bookings
      .filter(b => b.status !== BookingStatus.cancelled && b.status !== BookingStatus.pending_payment)
      .reduce((sum, b) => sum + Number(b.totalPrice), 0)

    const onlineBookings = bookings.filter(b => b.bookingChannel === BookingChannel.online).length
    const walkInBookings = bookings.filter(b => b.bookingChannel === BookingChannel.walk_in).length
    const onlinePercentage = totalBookings > 0 ? Math.round((onlineBookings / totalBookings) * 100) : 0
    const averageOrderValue = (completedBookings + bookings.filter(b => b.status === BookingStatus.ongoing || b.status === BookingStatus.confirmed).length) > 0
      ? Math.round(grossRentalValue / (completedBookings + bookings.filter(b => b.status === BookingStatus.ongoing || b.status === BookingStatus.confirmed).length))
      : 0

    // 3. Funnel Konversi Sewa
    const funnel: ConversionFunnelData = {
      created: totalBookings,
      paid: bookings.filter(b => b.status !== BookingStatus.pending_payment).length,
      kycVerified: bookings.filter(b => b.customer.verificationStatus === 'verified').length,
      ongoingOrCompleted: bookings.filter(b => b.status === BookingStatus.ongoing || b.status === BookingStatus.completed).length,
      completed: completedBookings,
      cancelledExpired: bookings.filter(b => b.status === BookingStatus.cancelled && (b.cancellationNote?.includes('60 menit') || b.cancelledBy === 'SYSTEM_CRON_AUTO_CANCEL')).length,
      cancelledManual: bookings.filter(b => b.status === BookingStatus.cancelled && !(b.cancellationNote?.includes('60 menit') || b.cancelledBy === 'SYSTEM_CRON_AUTO_CANCEL')).length
    }

    // 4. Tren Harian (Daily Trends dalam Timezone WIB)
    const dailyMap = new Map<string, { cashInflow: number; rentalValue: number; bookingsCount: number }>()
    
    // Inisialisasi setiap hari dalam rentang kalender
    const curDate = new Date(dateFromStr + 'T00:00:00Z')
    const endDateObj = new Date(dateToStr + 'T00:00:00Z')
    while (curDate <= endDateObj) {
      const key = curDate.toISOString().split('T')[0]
      dailyMap.set(key, { cashInflow: 0, rentalValue: 0, bookingsCount: 0 })
      curDate.setUTCDate(curDate.getUTCDate() + 1)
    }

    // Petakan Pembayaran ke Hari WIB
    for (const p of payments) {
      const pWibStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(p.createdAt))
      const entry = dailyMap.get(pWibStr)
      if (entry) {
        entry.cashInflow += Number(p.amount)
      }
    }
    // Petakan Denda ke Hari WIB
    for (const b of lateFeeBookings) {
      if (b.actualReturnAt) {
        const bWibStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(b.actualReturnAt))
        const entry = dailyMap.get(bWibStr)
        if (entry) {
          entry.cashInflow += Number(b.lateFeeAmount || 0)
        }
      }
    }
    // Petakan Booking ke Hari WIB
    for (const b of bookings) {
      const bWibStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(b.createdAt))
      const entry = dailyMap.get(bWibStr)
      if (entry) {
        entry.bookingsCount += 1
        if (b.status !== BookingStatus.cancelled && b.status !== BookingStatus.pending_payment) {
          entry.rentalValue += Number(b.totalPrice)
        }
      }
    }

    const dailyTrends: DailyTrendItem[] = Array.from(dailyMap.entries()).map(([dateKey, val]) => ({
      date: dateKey,
      formattedDate: formatDayMonthWib(dateKey),
      cashInflow: Math.round(val.cashInflow),
      rentalValue: Math.round(val.rentalValue),
      bookingsCount: val.bookingsCount
    }))

    // 5. Performa Armada & Utilisasi (Mengelompokkan berdasarkan identitas fisik plat nomor)
    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        isActive: true
      },
      include: {
        category: true,
        branch: true,
        bookings: {
          where: {
            status: { in: [BookingStatus.confirmed, BookingStatus.ongoing, BookingStatus.completed] },
            startDate: { lte: endBoundary },
            endDate: { gte: startBoundary }
          },
          select: {
            startDate: true,
            endDate: true,
            totalPrice: true,
            status: true
          }
        }
      }
    })

    let totalRentedHoursAllFleet = 0
    let totalCapacityHoursAllFleet = vehicles.length * totalWindowHours

    const fleetPerformance: FleetPerformanceItem[] = vehicles.map(v => {
      let vehicleRentedHours = 0
      let vehicleRevenue = 0

      for (const b of v.bookings) {
        const overlap = calculateIntervalOverlapHours(b.startDate, b.endDate, startBoundary, endBoundary)
        vehicleRentedHours += overlap
        if (b.status !== BookingStatus.cancelled) {
          vehicleRevenue += Number(b.totalPrice)
        }
      }

      totalRentedHoursAllFleet += vehicleRentedHours
      const utilizationRate = Math.min(100, Math.round((vehicleRentedHours / totalWindowHours) * 100))

      return {
        plateNumber: v.plateNumber,
        vehicleName: v.name || v.category.name,
        categoryName: v.category.name,
        branchName: v.branch.name,
        totalRentalHours: Math.round(vehicleRentedHours),
        totalRentalDays: Number((vehicleRentedHours / 24).toFixed(1)),
        revenueGenerated: Math.round(vehicleRevenue),
        utilizationRate,
        currentOdometerKm: v.currentOdometerKm != null ? Number(v.currentOdometerKm) : null
      }
    })

    // Urutkan armada dari revenue tertinggi
    fleetPerformance.sort((a, b) => b.revenueGenerated - a.revenueGenerated)

    const overallUtilizationRate = totalCapacityHoursAllFleet > 0
      ? Math.min(100, Math.round((totalRentedHoursAllFleet / totalCapacityHoursAllFleet) * 100))
      : 0

    // 6. Perbandingan Antar Cabang (Khusus admin_pusat)
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
        const branchPayments = payments.filter(p => p.booking?.pickupBranchId === b.id)
        const branchLateFees = lateFeeBookings.filter(l => l.pickupBranchId === b.id)
        const bCashInflow = branchPayments.reduce((s, p) => s + Number(p.amount), 0) + branchLateFees.reduce((s, l) => s + Number(l.lateFeeAmount || 0), 0)
        
        branchComparisons.push({
          branchId: b.id,
          branchName: b.name,
          city: b.city,
          cashInflow: bCashInflow,
          totalBookings: b.pickups.length,
          activeVehicles: b.vehicles.length,
          utilizationRate: 0 // Placeholder agregasi
        })
      }
      branchComparisons.sort((a, b) => b.cashInflow - a.cashInflow)
    }

    const kpi: KpiMetrics = {
      netCashInflow: Math.round(netCashInflow),
      grossRentalValue: Math.round(grossRentalValue),
      totalBookings,
      completedBookings,
      averageOrderValue,
      overallUtilizationRate,
      onlineBookings,
      walkInBookings,
      onlinePercentage,
      lateFeeRevenue: Math.round(totalLateFeeRevenue)
    }

    return {
      dateRange,
      kpi,
      dailyTrends,
      fleetPerformance,
      funnel,
      branchComparisons
    }
  } catch (error: any) {
    console.error('[ANALYTICS_ERROR] getAnalyticsData failed:', error)
    return { error: error.message || 'Gagal memproses data analitik.' }
  }
}

/**
 * Server Action: Ekspor Data Analitik CSV Terlindungi Kepatuhan UU PDP
 * - Nomor NIK dan SIM mutlak dihapus/tidak dimasukkan.
 * - Nama, email, dan telepon pelanggan ditampilkan penuh untuk admin.
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
        'Arus Kas Masuk (IDR)',
        'Nilai Kontrak Sewa (IDR)',
        'Jumlah Pesanan Dibuat'
      ]
      const rows = [headers.join(',')]
      for (const item of analyticsData.dailyTrends) {
        rows.push([
          escapeCsv(item.date),
          escapeCsv(item.cashInflow),
          escapeCsv(item.rentalValue),
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
        'Pendapatan Dihasilkan (IDR)',
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
          escapeCsv(item.revenueGenerated),
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
