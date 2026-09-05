/**
 * Centralized business constants for the Rental Management System.
 * Mencegah logic drift antara client, server actions, dan core library.
 */

/**
 * Jeda waktu (dalam jam dan milidetik) yang diwajibkan antar-sewa
 * untuk proses inspeksi berkala, pembersihan, dan detailing armada.
 */
export const TURNOVER_BUFFER_HOURS = 3
export const TURNOVER_BUFFER_MS = TURNOVER_BUFFER_HOURS * 60 * 60 * 1000

/**
 * Jam operasional layanan cabang untuk serah-terima dan pengembalian unit kendaraan.
 * Saat ini seluruh cabang menganut kebijakan jam layanan seragam: 08:00 – 21:00 WIB (UTC+7).
 */
export const BRANCH_OPERATING_HOURS = {
  OPEN_HOUR: 8,     // 08:00 WIB
  CLOSE_HOUR: 21,   // 21:00 WIB
  TIMEZONE: 'Asia/Jakarta',
  TIMEZONE_OFFSET_HOURS: 7,
} as const

/**
 * Batas tarif sewa harian minimum (Rp 250.000 / hari) untuk mencegah
 * anomali data, kesalahan input staf admin, dan risiko kerugian komersial.
 */
export const MIN_VEHICLE_DAILY_RATE = 250_000

/**
 * Memvalidasi apakah suatu waktu (Date) berada dalam rentang jam operasional cabang (08:00–21:00 WIB).
 * @param date Waktu yang akan divalidasi (UTC Date)
 * @returns boolean true jika berada antara 08:00 sampai 21:00 WIB inklusif
 */
export function isWithinOperatingHoursWIB(date: Date): boolean {
  // Konversi timestamp UTC ke waktu WIB (+7 jam)
  const wibTime = new Date(date.getTime() + BRANCH_OPERATING_HOURS.TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000)
  const hours = wibTime.getUTCHours()
  const minutes = wibTime.getUTCMinutes()

  // Di bawah jam 08:00 WIB
  if (hours < BRANCH_OPERATING_HOURS.OPEN_HOUR) return false

  // Di atas jam 21:00 WIB
  if (hours > BRANCH_OPERATING_HOURS.CLOSE_HOUR) return false

  // Tepat jam 21:00 WIB diperbolehkan (21:00), tetapi lewat menit (misal 21:01) tidak diperbolehkan
  if (hours === BRANCH_OPERATING_HOURS.CLOSE_HOUR && minutes > 0) return false

  return true
}
