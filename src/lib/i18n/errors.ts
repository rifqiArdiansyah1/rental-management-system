import { Locale } from './types'

export type ActionErrorCode =
  | 'AUTH_REQUIRED'
  | 'VEHICLE_NOT_FOUND'
  | 'BRANCH_MISMATCH'
  | 'BUFFER_VIOLATION'
  | 'OPERATING_HOURS_VIOLATION'
  | 'BOOKING_OVERLAP'
  | 'BOOKING_NOT_FOUND'
  | 'FORBIDDEN_CANCELLATION'
  | 'CANNOT_CANCEL_STATUS'
  | 'KYC_NOT_VERIFIED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'RATE_LIMIT'
  | 'WEAK_PASSWORD'
  | 'USER_ALREADY_EXISTS'
  | 'TOKEN_EXPIRED'
  | 'UNKNOWN_ERROR'

export const ACTION_ERRORS: Record<ActionErrorCode, { id: string; en: string }> = {
  AUTH_REQUIRED: {
    id: 'Anda harus masuk ke akun terlebih dahulu untuk melanjutkan pemesanan.',
    en: 'Please sign in to your account first to continue your reservation.',
  },
  VEHICLE_NOT_FOUND: {
    id: 'Armada tidak ditemukan atau sedang tidak aktif.',
    en: 'Vehicle not found or is currently inactive.',
  },
  BRANCH_MISMATCH: {
    id: 'Armada ini hanya tersedia di cabang asalnya. Pemesanan tidak dapat dilakukan di cabang lain.',
    en: 'This vehicle is only available at its home branch. Reservation cannot be made for other branches.',
  },
  BUFFER_VIOLATION: {
    id: 'Waktu pengambilan minimal 3 jam dari waktu pemesanan saat ini (jeda inspeksi & persiapan unit).',
    en: 'Earliest pickup time is 3 hours from the current booking time (unit inspection & prep window).',
  },
  OPERATING_HOURS_VIOLATION: {
    id: 'Waktu pengambilan dan pengembalian kendaraan harus berada dalam jam operasional cabang (08:00 – 21:00 WIB).',
    en: 'Vehicle pickup and return times must be within branch operating hours (08:00 – 21:00 WIB).',
  },
  BOOKING_OVERLAP: {
    id: 'Mobil sudah dipesan di rentang tanggal tersebut. Silakan pilih tanggal atau jam lain.',
    en: 'This vehicle is already reserved for the selected schedule. Please select alternative dates or times.',
  },
  BOOKING_NOT_FOUND: {
    id: 'Pesanan tidak ditemukan.',
    en: 'Booking not found.',
  },
  FORBIDDEN_CANCELLATION: {
    id: 'Anda tidak memiliki hak untuk membatalkan pesanan ini.',
    en: 'You are not authorized to cancel this reservation.',
  },
  CANNOT_CANCEL_STATUS: {
    id: 'Hanya pesanan yang belum dibayar yang dapat dibatalkan secara mandiri.',
    en: 'Only unpaid reservations can be cancelled directly.',
  },
  KYC_NOT_VERIFIED: {
    id: 'Kunci tidak dapat diserahkan. Identitas pelanggan (KTP/SIM) belum diverifikasi.',
    en: 'Handover unavailable. Customer identity verification (ID/Driver License) is pending.',
  },
  INVALID_CREDENTIALS: {
    id: 'Email atau kata sandi yang Anda masukkan salah. Silakan periksa kembali.',
    en: 'Invalid email or password. Please verify your credentials and try again.',
  },
  EMAIL_NOT_CONFIRMED: {
    id: 'Email Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda untuk tautan verifikasi akun.',
    en: 'Your email is not verified. Please check your inbox or spam folder for the verification link.',
  },
  RATE_LIMIT: {
    id: 'Terlalu banyak permintaan dalam waktu singkat. Demi alasan keamanan, silakan tunggu 60 detik sebelum mencoba kembali.',
    en: 'Too many requests. For security reasons, please wait 60 seconds before trying again.',
  },
  WEAK_PASSWORD: {
    id: 'Kata sandi minimal harus terdiri dari 8 karakter.',
    en: 'Password must be at least 8 characters long.',
  },
  USER_ALREADY_EXISTS: {
    id: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.',
    en: 'This email is already registered. Please sign in or use a different email address.',
  },
  TOKEN_EXPIRED: {
    id: 'Tautan pemulihan kata sandi tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.',
    en: 'Password recovery link is invalid or has expired. Please request a new link.',
  },
  UNKNOWN_ERROR: {
    id: 'Terjadi kendala sistem. Silakan coba beberapa saat lagi.',
    en: 'A system issue occurred. Please try again shortly.',
  },
}

export function getActionErrorMessage(
  code: ActionErrorCode,
  locale: Locale = 'id',
  params?: Record<string, string>
): string {
  const template = ACTION_ERRORS[code]?.[locale] || ACTION_ERRORS.UNKNOWN_ERROR[locale]
  if (!params) return template

  return Object.entries(params).reduce((acc, [key, val]) => {
    return acc.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
  }, template)
}
