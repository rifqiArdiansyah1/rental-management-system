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

/**
 * Panjang minimum karakter kata sandi (8 karakter) yang diterapkan seragam
 * pada seluruh alur autentikasi (Registrasi Akun dan Pemulihan/Reset Kata Sandi).
 */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Masa tenggang (toleransi) pengembalian armada sebelum denda mulai dihitung (45 menit).
 */
export const LATE_RETURN_GRACE_MINUTES = 45

/**
 * Ambang batas keterlambatan ekstrem (3 jam), selaras dengan TURNOVER_BUFFER_HOURS.
 * Jika keterlambatan melewati ambang ini, dikenakan penalti tarif sewa 1 hari penuh (atau kelipatan hari).
 */
export const EXTREME_LATE_HOURS = 3

/**
 * Batas bawah tarif overtime per jam minimum (Rp 50.000 / jam).
 */
export const MIN_HOURLY_OVERTIME_RATE = 50_000

/**
 * Persentase tarif overtime per jam dari tarif sewa harian (10% / jam).
 */
export const OVERTIME_HOURLY_PERCENTAGE = 0.10

/**
 * Durasi masa berlaku transaksi Midtrans Snap dalam menit (60 menit).
 */
export const MIDTRANS_SNAP_EXPIRY_MINUTES = 60

/**
 * Safety buffer masa berlaku token Snap sebelum kedaluwarsa (10 menit).
 */
export const SNAP_TOKEN_SAFETY_BUFFER_MINUTES = 10

/**
 * Jendela reuse Snap token idempoten: diturunkan dari masa berlaku dikurangi safety buffer (50 menit).
 */
export const SNAP_TOKEN_REUSE_WINDOW_MINUTES =
  MIDTRANS_SNAP_EXPIRY_MINUTES - SNAP_TOKEN_SAFETY_BUFFER_MINUTES

/**
 * Nilai acuan awal harga bahan bakar (BBM) per liter standar nasional.
 * Digunakan sebagai baseline seed dan fallback aman kode.
 */
export const DEFAULT_FUEL_PRICES: Record<string, number> = {
  pertalite: 10_000,
  pertamax: 12_950,
  pertamax_turbo: 14_400,
  solar: 6_800,
  dexlite: 13_050,
} as const

/**
 * Label ramah pengguna untuk setiap jenis bahan bakar.
 */
export const FUEL_TYPE_LABELS: Record<string, string> = {
  pertalite: 'Pertalite (RON 90)',
  pertamax: 'Pertamax (RON 92)',
  pertamax_turbo: 'Pertamax Turbo (RON 98)',
  solar: 'Solar / Biosolar',
  dexlite: 'Dexlite (CN 51)',
} as const

/**
 * Preset jarak perjalanan generik (km) untuk kalkulator pra-perjalanan publik.
 * Netral antarcabang (tidak terpaku pada nama kota tertentu).
 */
export const ROUTE_DISTANCE_PRESETS = [
  { label: 'Dalam Kota', distanceKm: 50, description: 'Aktivitas bisnis & mobilitas harian' },
  { label: 'Luar Kota Dekat', distanceKm: 150, description: 'Perjalanan ke kota penyangga' },
  { label: 'Perjalanan Jauh', distanceKm: 300, description: 'Perjalanan antarkota lintas wilayah' },
] as const


