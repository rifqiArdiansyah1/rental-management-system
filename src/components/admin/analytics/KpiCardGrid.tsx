import React from 'react'
import { KpiMetrics } from '@/lib/analytics/metrics'
import { DollarSign, FileSpreadsheet, Percent, Car, Globe, Store } from 'lucide-react'

interface KpiCardGridProps {
  kpi: KpiMetrics
}

export function KpiCardGrid({ kpi }: KpiCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" data-testid="kpi-card-grid">
      {/* Card 1: Kas Masuk Bersih */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Kas Masuk Bersih</span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-net-cash">
            Rp {kpi.netCashInflow.toLocaleString('id-ID')}
          </h3>
          <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1.5">
            <span className="text-emerald-600 font-medium font-mono">
              +Rp {kpi.lateFeeRevenue.toLocaleString('id-ID')}
            </span>
            <span>denda terlambat</span>
          </p>
        </div>
      </div>

      {/* Card 2: Nilai Kontrak Sewa */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nilai Kontrak Sewa</span>
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-rental-value">
            Rp {kpi.grossRentalValue.toLocaleString('id-ID')}
          </h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            AOV: <strong className="text-zinc-800 font-mono">Rp {kpi.averageOrderValue.toLocaleString('id-ID')}</strong> / sewa
          </p>
        </div>
      </div>

      {/* Card 3: Utilisasi Armada */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tingkat Utilisasi Armada</span>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Percent className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-utilization-rate">
            {kpi.overallUtilizationRate}%
          </h3>
          <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, kpi.overallUtilizationRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 4: Saluran Pemesanan (Online vs Walk-In) */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Saluran Pemesanan</span>
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <Car className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-total-bookings">
              {kpi.totalBookings}
            </h3>
            <span className="text-xs text-zinc-500">pesanan</span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-600 mt-2 pt-2 border-t border-zinc-100">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>Online: <strong>{kpi.onlineBookings}</strong> ({kpi.onlinePercentage}%)</span>
            </span>
            <span className="flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-amber-500" />
              <span>Walk-In: <strong>{kpi.walkInBookings}</strong></span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
