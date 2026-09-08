import { DEFAULT_FUEL_PRICES } from './constants'

export interface FuelEstimationParams {
  distanceKm: number
  efficiencyKmL?: number | null
  pricePerLiter?: number | null
}

export interface FuelEstimationResult {
  distanceKm: number
  efficiencyKmL: number
  pricePerLiter: number
  litersNeeded: number
  estimatedCost: number
  formattedCost: string
}

export interface TripOdometerParams {
  odometerStart?: number | null
  odometerEnd?: number | null
  efficiencyKmL?: number | null
  pricePerLiter?: number | null
}

export interface TripOdometerResult {
  isValid: boolean
  isAnomaly: boolean
  reason?: string
  odometerStart: number | null
  odometerEnd: number | null
  distanceKm: number | null
  litersNeeded: number | null
  estimatedCost: number | null
  formattedCost: string | null
  hasEfficiency: boolean
}

/**
 * Menghitung estimasi konsumsi liter dan biaya rupiah BBM berdasarkan jarak.
 */
export function calculateFuelEstimation(params: FuelEstimationParams): FuelEstimationResult | null {
  const { distanceKm, efficiencyKmL, pricePerLiter } = params

  if (!distanceKm || distanceKm <= 0) return null
  if (!efficiencyKmL || efficiencyKmL <= 0) return null
  if (!pricePerLiter || pricePerLiter <= 0) return null

  // Konsumsi BBM dalam liter (dibulatkan ke 1 angka di belakang koma)
  const exactLiters = distanceKm / efficiencyKmL
  const litersNeeded = Math.round(exactLiters * 10) / 10

  // Estimasi biaya dalam rupiah (dibulatkan ke kelipatan Rp 1.000 terdekat agar nyaman dibaca)
  const rawCost = exactLiters * pricePerLiter
  const estimatedCost = Math.round(rawCost / 1000) * 1000

  const formattedCost = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(estimatedCost)

  return {
    distanceKm: Math.round(distanceKm),
    efficiencyKmL: Number(efficiencyKmL),
    pricePerLiter: Number(pricePerLiter),
    litersNeeded,
    estimatedCost,
    formattedCost,
  }
}

/**
 * Menghitung jarak tempuh riil dan estimasi pemakaian BBM pasca-perjalanan dari angka odometer.
 * Berperilaku non-blocking: jika odometerEnd < odometerStart, mengembalikan isValid: false tanpa melempar error.
 */
export function calculateTripOdometer(params: TripOdometerParams): TripOdometerResult {
  const start = params.odometerStart != null ? Number(params.odometerStart) : null
  const end = params.odometerEnd != null ? Number(params.odometerEnd) : null

  if (start == null || end == null) {
    return {
      isValid: false,
      isAnomaly: false,
      reason: 'Data odometer belum lengkap (awal atau akhir belum dicatat).',
      odometerStart: start,
      odometerEnd: end,
      distanceKm: null,
      litersNeeded: null,
      estimatedCost: null,
      formattedCost: null,
      hasEfficiency: false,
    }
  }

  // Typo guard: odometer akhir lebih kecil dari odometer awal
  if (end < start) {
    return {
      isValid: false,
      isAnomaly: true,
      reason: `Odometer akhir (${end.toLocaleString('id-ID')} km) lebih kecil dari odometer awal (${start.toLocaleString('id-ID')} km). Kemungkinan salah ketik.`,
      odometerStart: start,
      odometerEnd: end,
      distanceKm: null,
      litersNeeded: null,
      estimatedCost: null,
      formattedCost: null,
      hasEfficiency: false,
    }
  }

  const distanceKm = end - start
  const efficiency = params.efficiencyKmL != null && Number(params.efficiencyKmL) > 0
    ? Number(params.efficiencyKmL)
    : null

  // Jika efisiensi mobil belum diisi admin, jarak riil tetap valid tetapi liter/rupiah null
  if (!efficiency) {
    return {
      isValid: true,
      isAnomaly: false,
      odometerStart: start,
      odometerEnd: end,
      distanceKm,
      litersNeeded: null,
      estimatedCost: null,
      formattedCost: null,
      hasEfficiency: false,
    }
  }

  const price = params.pricePerLiter != null && Number(params.pricePerLiter) > 0
    ? Number(params.pricePerLiter)
    : DEFAULT_FUEL_PRICES.pertalite

  const calc = calculateFuelEstimation({
    distanceKm,
    efficiencyKmL: efficiency,
    pricePerLiter: price,
  })

  return {
    isValid: true,
    isAnomaly: false,
    odometerStart: start,
    odometerEnd: end,
    distanceKm,
    litersNeeded: calc?.litersNeeded ?? null,
    estimatedCost: calc?.estimatedCost ?? null,
    formattedCost: calc?.formattedCost ?? null,
    hasEfficiency: true,
  }
}
