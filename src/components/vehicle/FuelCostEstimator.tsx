'use client'

import { useState } from 'react'
import { FuelType } from '@prisma/client'
import { FUEL_TYPE_LABELS, ROUTE_DISTANCE_PRESETS } from '@/lib/constants'

interface FuelCostEstimatorProps {
  fuelType: FuelType
  fuelEfficiencyKmL: number | null
  pricePerLiter: number
}

export default function FuelCostEstimator({
  fuelType,
  fuelEfficiencyKmL,
  pricePerLiter,
}: FuelCostEstimatorProps) {
  const [distanceKm, setDistanceKm] = useState<number>(50)

  const fuelLabel = FUEL_TYPE_LABELS[fuelType] || fuelType

  // Kalkulasi
  const hasEfficiency = fuelEfficiencyKmL !== null && fuelEfficiencyKmL > 0
  const estimatedLiters = hasEfficiency ? distanceKm / fuelEfficiencyKmL : null
  const estimatedCost = estimatedLiters !== null ? Math.round(estimatedLiters * pricePerLiter) : null

  return (
    <div className="bg-surface-container rounded-xl p-6 md:p-8 border border-surface-variant ambient-glow flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-variant/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">local_gas_station</span>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              Estimasi Biaya BBM Perjalanan
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Simulasikan kebutuhan konsumsi bahan bakar berdasarkan estimasi rute Anda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded bg-secondary/10 text-secondary border border-secondary/20">
            {fuelLabel}
          </span>
          <span className="text-xs text-on-surface-variant">
            Rp {pricePerLiter.toLocaleString('id-ID')} / L
          </span>
        </div>
      </div>

      {/* Preset Buttons */}
      <div>
        <label className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider block mb-2">
          Pilih Rute Cepat
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {ROUTE_DISTANCE_PRESETS.map((preset) => (
            <button
              key={preset.distanceKm}
              type="button"
              onClick={() => setDistanceKm(preset.distanceKm)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-all text-left flex flex-col gap-0.5 cursor-pointer ${
                distanceKm === preset.distanceKm
                  ? 'bg-secondary/15 border-secondary text-on-surface font-semibold ring-1 ring-secondary/50'
                  : 'bg-surface-container-high/40 border-white/10 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span>{preset.label}</span>
              <span className="text-[11px] font-mono text-secondary">{preset.distanceKm} km</span>
            </button>
          ))}
        </div>
      </div>

      {/* Distance Slider */}
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <label className="text-xs font-label-caps text-on-surface-variant uppercase tracking-wider">
            Atur Jarak Tempuh Rencana
          </label>
          <span className="font-mono text-base font-bold text-secondary">
            {distanceKm} km
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="500"
          step="5"
          value={distanceKm}
          onChange={(e) => setDistanceKm(Number(e.target.value))}
          className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary"
        />
        <div className="flex justify-between text-[10px] font-mono text-on-surface-variant/70 mt-1">
          <span>10 km</span>
          <span>250 km</span>
          <span>500 km</span>
        </div>
      </div>

      {/* Calculation Output Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-container-high/60 rounded-lg p-4 border border-white/5 flex flex-col">
          <span className="text-[11px] font-label-caps text-on-surface-variant uppercase">Rencana Jarak</span>
          <span className="font-mono text-xl font-bold text-on-surface mt-1">
            {distanceKm} <span className="text-xs text-on-surface-variant font-normal">km</span>
          </span>
        </div>

        <div className="bg-surface-container-high/60 rounded-lg p-4 border border-white/5 flex flex-col">
          <span className="text-[11px] font-label-caps text-on-surface-variant uppercase">Estimasi Konsumsi</span>
          <span className="font-mono text-xl font-bold text-on-surface mt-1">
            {estimatedLiters !== null ? (
              <>
                ~{estimatedLiters.toFixed(1)}{' '}
                <span className="text-xs text-on-surface-variant font-normal">Liter</span>
              </>
            ) : (
              <span className="text-xs text-on-surface-variant font-normal">-</span>
            )}
          </span>
          {hasEfficiency && (
            <span className="text-[10px] text-on-surface-variant mt-0.5">
              Acuan efisiensi: {Number(fuelEfficiencyKmL)} km/L
            </span>
          )}
        </div>

        <div className="bg-surface-container-high/60 rounded-lg p-4 border border-secondary/20 flex flex-col">
          <span className="text-[11px] font-label-caps text-secondary uppercase">Estimasi Biaya BBM</span>
          <span className="font-mono text-xl font-bold text-secondary mt-1">
            {estimatedCost !== null ? (
              new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0,
              }).format(estimatedCost)
            ) : (
              <span className="text-xs text-on-surface-variant font-normal">Spesifikasi belum diatur</span>
            )}
          </span>
          <span className="text-[10px] text-on-surface-variant mt-0.5">
            Perkiraan belanja bensin
          </span>
        </div>
      </div>

      {/* Kebijakan Opsi A Notice */}
      <div className="p-3.5 rounded-lg bg-secondary/10 border border-secondary/20 flex items-start gap-2.5">
        <span className="material-symbols-outlined text-secondary text-sm shrink-0 mt-0.5">info</span>
        <div className="text-xs text-on-surface-variant leading-relaxed">
          <strong className="text-on-surface">Kebijakan Biaya Operasional (Opsi A):</strong>{' '}
          Kalkulator ini bersifat murni estimasi informasional untuk membantu perencanaan perjalanan Anda. Biaya bahan bakar dan tarif tol ditanggung langsung oleh penyewa di lapangan dan tidak ditagihkan ke dalam invoice rental Prestige Motion.
        </div>
      </div>
    </div>
  )
}
