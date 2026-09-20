import {
  LATE_RETURN_GRACE_MINUTES,
  EXTREME_LATE_HOURS,
  MIN_HOURLY_OVERTIME_RATE,
  OVERTIME_HOURLY_PERCENTAGE,
} from './constants'

export interface LateFeeCalculation {
  lateMinutes: number
  isLate: boolean
  hoursLate: number
  isExtremeLate: boolean
  daysLate: number
  hourlyRate: number
  suggestedLateFee: number
  breakdownText: string
}

/**
 * Membulatkan angka ke kelipatan Rp 10.000 terdekat secara matematis standar.
 */
export function roundToNearest10k(val: number): number {
  return Math.round(val / 10_000) * 10_000
}

/**
 * Menghitung denda keterlambatan pengembalian armada secara proporsional.
 *
 * Aturan Bisnis:
 * 1. Toleransi Awal (Grace Period): <= 45 menit -> Bebas denda (Rp 0).
 * 2. Overtime Per Jam (45 menit < late <= 3 jam / 180 menit):
 *    - Jam keterlambatan dibulatkan ke atas: Math.ceil(lateMinutes / 60).
 *    - Tarif per jam: max(50.000, roundToNearest10k(agreedDailyRate * 0.10)).
 *    - Denda: hoursLate * hourlyRate.
 * 3. Keterlambatan Ekstrem (> 3 jam):
 *    - daysLate = Math.ceil(hoursLate / 24).
 *    - Denda: daysLate * agreedDailyRate (skala kelipatan hari penuh).
 *
 * @param endDate Waktu rencana selesai sewa
 * @param actualReturnAt Waktu fisik aktual unit dikembalikan
 * @param agreedDailyRate Tarif sewa harian kendaraan yang disepakati
 */
export function calculateLateFee(
  endDate: Date,
  actualReturnAt: Date,
  agreedDailyRate: number
): LateFeeCalculation {
  const diffMs = actualReturnAt.getTime() - endDate.getTime()
  const rawLateMinutes = Math.floor(diffMs / (60 * 1000))
  const lateMinutes = Math.max(0, rawLateMinutes)

  const rawHourlyRate = agreedDailyRate * OVERTIME_HOURLY_PERCENTAGE
  const roundedHourlyRate = roundToNearest10k(rawHourlyRate)
  const hourlyRate = Math.max(MIN_HOURLY_OVERTIME_RATE, roundedHourlyRate)

  // Kasus 1: Tepat waktu atau lebih awal
  if (lateMinutes <= 0) {
    return {
      lateMinutes: 0,
      isLate: false,
      hoursLate: 0,
      isExtremeLate: false,
      daysLate: 0,
      hourlyRate,
      suggestedLateFee: 0,
      breakdownText: 'Pengembalian tepat waktu (bebas denda)',
    }
  }

  // Kasus 2: Dalam masa toleransi (<= 45 menit)
  if (lateMinutes <= LATE_RETURN_GRACE_MINUTES) {
    return {
      lateMinutes,
      isLate: false,
      hoursLate: 0,
      isExtremeLate: false,
      daysLate: 0,
      hourlyRate,
      suggestedLateFee: 0,
      breakdownText: `Terlambat ${lateMinutes} menit (dalam masa toleransi ${LATE_RETURN_GRACE_MINUTES} menit, bebas denda)`,
    }
  }

  // Kasus 3: Melewati masa toleransi
  const hoursLate = Math.ceil(lateMinutes / 60)

  // Kasus 3a: Overtime bertingkat proporsional (<= 3 jam)
  if (hoursLate <= EXTREME_LATE_HOURS) {
    const suggestedLateFee = hoursLate * hourlyRate
    return {
      lateMinutes,
      isLate: true,
      hoursLate,
      isExtremeLate: false,
      daysLate: 0,
      hourlyRate,
      suggestedLateFee,
      breakdownText: `Terlambat ${hoursLate} jam (${lateMinutes} menit) × Rp ${hourlyRate.toLocaleString('id-ID')} (10%/jam)`,
    }
  }

  // Kasus 3b: Keterlambatan ekstrem (> 3 jam), skala kelipatan hari sewa
  const daysLate = Math.ceil(hoursLate / 24)
  const suggestedLateFee = daysLate * agreedDailyRate
  return {
    lateMinutes,
    isLate: true,
    hoursLate,
    isExtremeLate: true,
    daysLate,
    hourlyRate,
    suggestedLateFee,
    breakdownText: `Keterlambatan ekstrem ${hoursLate} jam (${daysLate} hari tarif sewa) × Rp ${agreedDailyRate.toLocaleString('id-ID')}`,
  }
}

/**
 * Memformat durasi keterlambatan (dalam menit) ke dalam format yang ramah dan mudah dibaca manusia.
 * Menghindari tampilan ribuan/puluhan ribu digit menit (misal: "8574 menit") yang membingungkan pengguna.
 *
 * Aturan format:
 * - <= 0 atau null/undefined: "0 menit"
 * - < 60 menit: "X menit"
 * - 60 s/d < 1440 menit (kurang dari 1 hari): "X jam" atau "X jam Y menit"
 * - >= 1440 menit (1 hari atau lebih): "X hari", "X hari Y jam", "X hari Y jam Z menit", dst.
 *
 * Contoh:
 * - 25 -> "25 menit"
 * - 60 -> "1 jam"
 * - 90 -> "1 jam 30 menit"
 * - 1440 -> "1 hari"
 * - 8574 -> "5 hari 22 jam 54 menit"
 *
 * Mendukung opsi bahasa ('id' | 'en'), default: 'id'.
 */
export function formatLateDuration(
  minutes: number | null | undefined,
  locale: string = 'id'
): string {
  const m = Math.max(0, Math.round(minutes || 0))
  const isEn = locale === 'en'
  if (m === 0) return isEn ? '0 minutes' : '0 menit'

  const days = Math.floor(m / 1440)
  const remMinutesAfterDays = m % 1440
  const hours = Math.floor(remMinutesAfterDays / 60)
  const mins = remMinutesAfterDays % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} ${isEn ? (days > 1 ? 'days' : 'day') : 'hari'}`)
  if (hours > 0) parts.push(`${hours} ${isEn ? (hours > 1 ? 'hours' : 'hour') : 'jam'}`)
  if (mins > 0) parts.push(`${mins} ${isEn ? (mins > 1 ? 'minutes' : 'minute') : 'menit'}`)

  return parts.join(' ') || (isEn ? '0 minutes' : '0 menit')
}

