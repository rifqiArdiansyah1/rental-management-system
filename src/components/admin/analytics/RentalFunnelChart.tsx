'use client'

import React from 'react'
import { ConversionFunnelData } from '@/lib/analytics/metrics'
import { CheckCircle2, CreditCard, ShieldCheck, Car, Flag, AlertTriangle, Clock } from 'lucide-react'

interface RentalFunnelChartProps {
  funnel: ConversionFunnelData
}

export function RentalFunnelChart({ funnel }: RentalFunnelChartProps) {
  const baseCount = Math.max(1, funnel.created)

  const steps = [
    {
      label: '1. Pesanan Dibuat',
      count: funnel.created,
      pct: Math.round((funnel.created / baseCount) * 100),
      icon: CheckCircle2,
      color: 'bg-zinc-800',
      textColor: 'text-zinc-800'
    },
    {
      label: '2. Pembayaran Lunas',
      count: funnel.paid,
      pct: Math.round((funnel.paid / baseCount) * 100),
      icon: CreditCard,
      color: 'bg-emerald-600',
      textColor: 'text-emerald-700'
    },
    {
      label: '3. Verifikasi KYC Lengkap',
      count: funnel.kycVerified,
      pct: Math.round((funnel.kycVerified / baseCount) * 100),
      icon: ShieldCheck,
      color: 'bg-blue-600',
      textColor: 'text-blue-700'
    },
    {
      label: '4. Armada Berjalan / Diambil',
      count: funnel.ongoingOrCompleted,
      pct: Math.round((funnel.ongoingOrCompleted / baseCount) * 100),
      icon: Car,
      color: 'bg-indigo-600',
      textColor: 'text-indigo-700'
    },
    {
      label: '5. Rental Selesai',
      count: funnel.completed,
      pct: Math.round((funnel.completed / baseCount) * 100),
      icon: Flag,
      color: 'bg-emerald-700',
      textColor: 'text-emerald-800'
    }
  ]

  const totalCancelled = funnel.cancelledExpired + funnel.cancelledManual
  const cancellationRate = funnel.created > 0 ? Math.round((totalCancelled / funnel.created) * 100) : 0

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm" data-testid="rental-funnel-chart">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-2">
        <div>
          <h2 className="text-base font-bold text-zinc-900 tracking-tight">Funnel Konversi Sewa</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Tingkat konversi perjalanan pelanggan dari pembuatan pesanan hingga pengembalian unit
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500">Tingkat Penyelesaian: </span>
          <strong className="text-emerald-700 font-mono text-sm">
            {funnel.created > 0 ? Math.round((funnel.completed / funnel.created) * 100) : 0}%
          </strong>
        </div>
      </div>

      {/* Funnel Horizontal Bars */}
      <div className="mt-6 space-y-4">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const dropOffFromPrev = idx > 0 && steps[idx - 1].count > 0
            ? Math.round(((steps[idx - 1].count - step.count) / steps[idx - 1].count) * 100)
            : 0

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${step.textColor}`} />
                  <span className="font-semibold text-zinc-800">{step.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  {idx > 0 && dropOffFromPrev > 0 && (
                    <span className="text-[10px] text-rose-500 font-medium">
                      -{dropOffFromPrev}% drop
                    </span>
                  )}
                  <span className="font-mono text-zinc-900 font-bold">
                    {step.count.toLocaleString('id-ID')}
                  </span>
                  <span className="font-mono text-zinc-400 w-10 text-right text-[11px]">
                    ({step.pct}%)
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${step.color}`}
                  style={{ width: `${Math.max(2, step.pct)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Breakdown Pembatalan & Drop-off */}
      <div className="mt-6 pt-5 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-3">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900">Kedaluwarsa Pembayaran (60 Menit)</div>
            <div className="text-zinc-600 mt-0.5 text-[11px]">
              <strong className="font-mono text-amber-800">{funnel.cancelledExpired}</strong> pesanan hangus sebelum bayar
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/70 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-900">Pembatalan Manual / Ditolak</div>
            <div className="text-zinc-600 mt-0.5 text-[11px]">
              <strong className="font-mono text-rose-800">{funnel.cancelledManual}</strong> pesanan dibatalkan pelanggan/admin ({cancellationRate}% total)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
