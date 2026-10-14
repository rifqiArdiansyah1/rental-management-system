import React from 'react'
import { KpiMetrics } from '@/lib/analytics/metrics'
import { DollarSign, FileSpreadsheet, Percent, Car, Globe, Store, Wrench, Wallet } from 'lucide-react'

interface KpiCardGridProps {
  kpi: KpiMetrics
}

export function KpiCardGrid({ kpi }: KpiCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4" data-testid="kpi-card-grid">
      {/* Card 1: Kas Masuk Bersih */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-emerald-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Kas Masuk Bersih</span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-xl lg:text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-net-cash">
            Rp {kpi.netCashInflow.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-1">
            <span className="text-emerald-600 font-medium font-mono">
              +Rp {kpi.lateFeeRevenue.toLocaleString('id-ID')}
            </span>
            <span>denda terlambat</span>
          </p>
        </div>
      </div>

      {/* Card 2: Biaya Pemeliharaan Armada */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-rose-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Biaya Perawatan</span>
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-xl lg:text-2xl font-bold text-rose-600 font-mono tracking-tight" data-testid="kpi-maintenance-expenses">
            Rp {kpi.totalMaintenanceExpenses.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1.5">
            Servis, ban, perbaikan & pajak
          </p>
        </div>
      </div>

      {/* Card 3: Arus Kas Operasional Bersih */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Kas Operasional</span>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <h3 className={`text-xl lg:text-2xl font-bold font-mono tracking-tight ${kpi.netOperatingCashFlow >= 0 ? 'text-zinc-900' : 'text-rose-600'}`} data-testid="kpi-operating-cash">
            Rp {kpi.netOperatingCashFlow.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1.5">
            Kas Masuk − Biaya Perawatan
          </p>
        </div>
      </div>

      {/* Card 4: Nilai Kontrak Sewa */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nilai Sewa (AOV)</span>
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-xl lg:text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-rental-value">
            Rp {kpi.grossRentalValue.toLocaleString('id-ID')}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1.5">
            AOV: <strong className="text-zinc-800 font-mono">Rp {kpi.averageOrderValue.toLocaleString('id-ID')}</strong>
          </p>
        </div>
      </div>

      {/* Card 5: Utilisasi Armada */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-indigo-400 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tingkat Utilisasi</span>
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Percent className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xl lg:text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-utilization-rate">
              {kpi.overallUtilizationRate}%
            </h3>
            <span className="text-[11px] text-zinc-500">
              {kpi.totalBookings} booking
            </span>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, kpi.overallUtilizationRate)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
