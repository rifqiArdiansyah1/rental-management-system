import { MIN_PASSWORD_LENGTH } from '@/lib/constants'

/**
 * Memetakan kode dan pesan error dari Supabase Auth ke Bahasa Indonesia yang informatif dan ramah pengguna.
 * Memeriksa `error.code` dan `error.status` terlebih dahulu sebelum melakukan fallback pencocokan substring pesan.
 */
export function getAuthErrorMessage(error: any): string {
  if (!error) return 'Terjadi kendala. Silakan coba beberapa saat lagi.'

  const code = String(error.code || '').toLowerCase()
  const msg = String(error.message || '').toLowerCase()
  const status = Number(error.status)

  // 1. Kredensial tidak valid (email tidak ditemukan atau password salah)
  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    return 'Email atau kata sandi yang Anda masukkan salah. Silakan periksa kembali.'
  }

  // 2. Email belum dikonfirmasi/diverifikasi
  if (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed')
  ) {
    return 'Email Anda belum diverifikasi. Silakan periksa kotak masuk atau spam email Anda untuk tautan verifikasi akun.'
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
    return 'Terlalu banyak permintaan dalam waktu singkat. Demi alasan keamanan, silakan tunggu 60 detik sebelum mencoba kembali.'
  }

  // 4. Kata sandi lemah / tidak memenuhi panjang minimum
  if (
    code === 'weak_password' ||
    msg.includes('password should be at least') ||
    msg.includes('weak password')
  ) {
    return `Kata sandi minimal harus terdiri dari ${MIN_PASSWORD_LENGTH} karakter.`
  }

  // 5. Akun sudah terdaftar (pada saat registrasi)
  if (
    code === 'user_already_exists' ||
    msg.includes('user already registered') ||
    msg.includes('already exists')
  ) {
    return 'Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.'
  }

  // 6. Token reset atau OTP kedaluwarsa / invalid
  if (
    code === 'otp_expired' ||
    msg.includes('token has expired') ||
    msg.includes('invalid token')
  ) {
    return 'Tautan pemulihan kata sandi tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.'
  }

  // Fallback umum
  return 'Terjadi kendala saat memproses autentikasi. Silakan coba beberapa saat lagi.'
}
