import React from 'react'
import { KpiMetrics } from '@/lib/analytics/metrics'
import { DollarSign, FileSpreadsheet, Percent, Wrench, Wallet, TrendingUp, ShieldCheck } from 'lucide-react'

interface KpiCardGridProps {
  kpi: KpiMetrics
}

export function KpiCardGrid({ kpi }: KpiCardGridProps) {
  return (
    <div className="space-y-4" data-testid="kpi-card-grid">
      {/* Baris 1: Pilar Akrual (Kinerja Operasional Armada) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Kinerja Armada (Basis Akrual)</span>
          <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-medium">Prorata Waktu Sewa</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Pendapatan Akrual Terealisasi */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-emerald-400 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pendapatan Terealisasi</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xl lg:text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-realized-revenue">
                Rp {kpi.accruedRealizedRevenue.toLocaleString('id-ID')}
              </h3>
              <div className="text-[11px] text-zinc-500 mt-1.5 flex flex-col gap-0.5">
                <span>Terjadwal: <strong className="text-zinc-700 font-mono">Rp {kpi.accruedScheduledRevenue.toLocaleString('id-ID')}</strong></span>
                {kpi.lateFeeAccrued > 0 && (
                  <span className="text-emerald-600 font-mono">+Rp {kpi.lateFeeAccrued.toLocaleString('id-ID')} denda terlambat</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Biaya Pemeliharaan Fisik */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-rose-400 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Beban Pemeliharaan Fisik</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <Wrench className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xl lg:text-2xl font-bold text-rose-600 font-mono tracking-tight" data-testid="kpi-maintenance-expenses">
                Rp {kpi.physicalMaintenanceExpenses.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Servis berkala, bengkel, ban & cuci
              </p>
            </div>
          </div>

          {/* Card 3: Margin Operasional Armada */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Margin Operasional Armada</span>
              <div className={`p-2 rounded-xl ${kpi.operatingProfitMargin >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className={`text-xl lg:text-2xl font-bold font-mono tracking-tight ${kpi.operatingProfitMargin >= 0 ? 'text-zinc-900' : 'text-rose-600'}`} data-testid="kpi-operating-margin">
                Rp {kpi.operatingProfitMargin.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Pendapatan Terealisasi − Pemeliharaan Fisik
              </p>
            </div>
          </div>

          {/* Card 4: Utilisasi Armada */}
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
      </div>

      {/* Baris 2: Pilar Kas & Beban Kepemilikan */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Likuiditas Kas & Legalitas (Basis Kas)</span>
          <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-medium">Realisasi Mutlak</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 5: Kas Masuk Bersih */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-emerald-400 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Kas Masuk Bersih</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xl lg:text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-net-cash">
                Rp {kpi.cashInflow.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Total pembayaran sukses diterima
              </p>
            </div>
          </div>

          {/* Card 6: Kas Operasional Bersih */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Arus Kas Bersih</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className={`text-xl lg:text-2xl font-bold font-mono tracking-tight ${kpi.netCashFlow >= 0 ? 'text-zinc-900' : 'text-rose-600'}`} data-testid="kpi-operating-cash">
                Rp {kpi.netCashFlow.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Kas Masuk − Total Kas Keluar Biaya Armada
              </p>
            </div>
          </div>

          {/* Card 7: Beban Kepemilikan & Legalitas */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-purple-400 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Beban Kepemilikan</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xl lg:text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-ownership-expenses">
                Rp {kpi.ownershipExpenses.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Pajak STNK tahunan & premi asuransi
              </p>
            </div>
          </div>

          {/* Card 8: Nilai Pemesanan Baru (Sinyal Permintaan) */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nilai Pemesanan Baru</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xl lg:text-2xl font-bold text-zinc-900 font-mono tracking-tight" data-testid="kpi-rental-value">
                Rp {kpi.newBookingsValue.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Rata-rata order: <strong className="text-zinc-800 font-mono">Rp {kpi.averageOrderValue.toLocaleString('id-ID')}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
