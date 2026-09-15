import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { Locale } from '@/lib/i18n/types'

/**
 * Memetakan kode dan pesan error dari Supabase Auth ke Bahasa Indonesia atau English yang informatif.
 * Memeriksa `error.code` dan `error.status` terlebih dahulu sebelum melakukan fallback pencocokan substring pesan.
 */
export function getAuthErrorMessage(error: any, locale: Locale = 'id'): string {
  const isEn = locale === 'en'

  if (!error) {
    return isEn
      ? 'An issue occurred. Please try again shortly.'
      : 'Terjadi kendala. Silakan coba beberapa saat lagi.'
  }

  const code = String(error.code || '').toLowerCase()
  const msg = String(error.message || '').toLowerCase()
  const status = Number(error.status)

  // 1. Kredensial tidak valid (email tidak ditemukan atau password salah)
  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    return isEn
      ? 'Invalid email or password. Please verify your credentials and try again.'
      : 'Email atau kata sandi yang Anda masukkan salah. Silakan periksa kembali.'
  }

  // 2. Email belum dikonfirmasi/diverifikasi
  if (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed')
  ) {
    return isEn
      ? 'Your email address has not been verified. Please check your inbox or spam folder for the verification link.'
      : 'Email Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda untuk tautan verifikasi akun.'
  }

  // 3. Batas laju permintaan (Rate Limit / Too Many Requests)
  if (
    code === 'over_request_rate_limit' ||
    code === 'too_many_requests' ||
    status === 429 ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('security purposes, you can only request this once') ||
    msg.includes('only request this once every')
  ) {
    return isEn
      ? 'Too many requests. For security reasons, please wait 60 seconds before trying again.'
      : 'Terlalu banyak permintaan dalam waktu singkat. Demi alasan keamanan, silakan tunggu 60 detik sebelum mencoba kembali.'
  }

  // 4. Kata sandi lemah / tidak memenuhi panjang minimum
  if (
    code === 'weak_password' ||
    msg.includes('password should be at least') ||
    msg.includes('weak password')
  ) {
    return isEn
      ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      : `Kata sandi minimal harus terdiri dari ${MIN_PASSWORD_LENGTH} karakter.`
  }

  // 5. Akun sudah terdaftar (pada saat registrasi)
  if (
    code === 'user_already_exists' ||
    msg.includes('user already registered') ||
    msg.includes('already exists')
  ) {
    return isEn
      ? 'This email is already registered. Please sign in or use a different email address.'
      : 'Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.'
  }

  // 6. Token reset atau OTP kedaluwarsa / invalid
  if (
    code === 'otp_expired' ||
    msg.includes('token has expired') ||
    msg.includes('invalid token')
  ) {
    return isEn
      ? 'The password reset link is invalid or has expired. Please request a new link.'
      : 'Tautan pemulihan kata sandi tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
  }

  // Fallback umum
  return isEn
    ? 'An issue occurred during authentication. Please try again shortly.'
    : 'Terjadi kendala saat memproses autentikasi. Silakan coba beberapa saat lagi.'
}
