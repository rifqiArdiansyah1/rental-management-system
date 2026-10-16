'use client'

import React, { useState } from 'react'
import { AnalyticsSummaryResult } from '@/lib/analytics/metrics'
import { getAnalyticsData, exportAnalyticsCsvAction } from '@/actions/adminAnalytics'
import { DateRangeSelector } from '@/components/admin/analytics/DateRangeSelector'
import { KpiCardGrid } from '@/components/admin/analytics/KpiCardGrid'
import { TrendAreaChart } from '@/components/admin/analytics/TrendAreaChart'
import { FleetPerformanceTable } from '@/components/admin/analytics/FleetPerformanceTable'
import { RentalFunnelChart } from '@/components/admin/analytics/RentalFunnelChart'
import { Building2, AlertCircle, Info } from 'lucide-react'

interface BranchOption {
  id: string
  name: string
}

interface AnalyticsClientProps {
  initialData: AnalyticsSummaryResult
  branches?: BranchOption[]
  userRole: string
}

export function AnalyticsClient({ initialData, branches, userRole }: AnalyticsClientProps) {
  const [data, setData] = useState<AnalyticsSummaryResult>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [currentFilters, setCurrentFilters] = useState<{
    dateFrom: string
    dateTo: string
    branchId?: string
  }>({
    dateFrom: initialData.dateRange.dateFrom,
    dateTo: initialData.dateRange.dateTo,
    branchId: 'all'
  })

  const handleFilterChange = async (filters: { dateFrom: string; dateTo: string; branchId?: string }) => {
    setIsLoading(true)
    setErrorMsg(null)
    setCurrentFilters(filters)

    try {
      const res = await getAnalyticsData(filters)
      if ('error' in res) {
        setErrorMsg(res.error)
      } else {
        setData(res)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat ulang data analitik.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCsv = async (type: 'daily_summary' | 'fleet_performance') => {
    setErrorMsg(null)
    try {
      const res = await exportAnalyticsCsvAction({
        dateFrom: currentFilters.dateFrom,
        dateTo: currentFilters.dateTo,
        branchId: currentFilters.branchId,
        type
      })

      if ('error' in res) {
        setErrorMsg(res.error)
        return
      }

      if (res.csvContent && res.filename) {
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', res.filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunduh file CSV.')
    }
  }

  return (
    <div className="space-y-6 pb-12" data-testid="analytics-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Analisis & Laporan</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Visualisasi KPI eksekutif, tren kas masuk riil, utilisasi armada, dan tingkat konversi sewa
        </p>
      </div>

      {/* Date & Branch Controls */}
      <DateRangeSelector
        initialDateFrom={data.dateRange.dateFrom}
        initialDateTo={data.dateRange.dateTo}
        branches={branches}
        selectedBranchId={currentFilters.branchId}
        isLoading={isLoading}
        onFilterChange={handleFilterChange}
        onExportCsv={handleExportCsv}
      />

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Partial Cost Data Notice */}
      {data.hasPartialCostData && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5" data-testid="partial-cost-banner">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Data Biaya Parsial:</strong> Pelacakan biaya armada resmi dimulai sejak {data.costTrackingStartDate}. Periode sewa sebelum tanggal ini mungkin belum merefleksikan seluruh biaya riil armada.
          </span>
        </div>
      )}

      {/* Section 1: KPI Cards */}
      <KpiCardGrid kpi={data.kpi} />

      {/* Section 2: Tren Harian & Funnel Konversi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendAreaChart dailyTrends={data.dailyTrends} />
        </div>
        <div className="lg:col-span-1">
          <RentalFunnelChart funnel={data.funnel} />
        </div>
      </div>

      {/* Section 3: Performa Armada */}
      <FleetPerformanceTable fleetPerformance={data.fleetPerformance} />

      {/* Section 4: Perbandingan Antar Cabang (Khusus Admin Pusat jika > 1 cabang) */}
      {data.branchComparisons && data.branchComparisons.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm" data-testid="branch-comparisons-table">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-zinc-700" />
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">Ringkasan Konsolidasi Cabang</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-semibold uppercase text-[11px]">
                  <th className="py-2.5 px-4">Nama Cabang</th>
                  <th className="py-2.5 px-4">Kota</th>
                  <th className="py-2.5 px-4">Unit Aktif</th>
                  <th className="py-2.5 px-4">Total Pesanan</th>
                  <th className="py-2.5 px-4 text-right">Kas Masuk</th>
                  <th className="py-2.5 px-4 text-right">Biaya Servis</th>
                  <th className="py-2.5 px-4 text-right">Kas Bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.branchComparisons.map((b) => (
                  <tr key={b.branchId} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-zinc-900">{b.branchName}</td>
                    <td className="py-3 px-4 text-zinc-600">{b.city}</td>
                    <td className="py-3 px-4 font-mono text-zinc-700">{b.activeVehicles} unit</td>
                    <td className="py-3 px-4 font-mono text-zinc-700">{b.totalBookings} sewa</td>
                    <td className="py-3 px-4 font-mono text-zinc-800 text-right">
                      Rp {b.cashInflow.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-mono text-rose-600 text-right">
                      Rp {b.maintenanceExpenses.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700 text-right">
                      Rp {b.netCashFlow.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
