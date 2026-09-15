import { Locale } from './types'

/**
 * Format angka ke format mata uang Rupiah sesuai konvensi bahasa:
 * - 'id': Rp 3.500.000 (pemisah ribuan titik)
 * - 'en': Rp 3,500,000 (pemisah ribuan koma standar internasional)
 */
export function formatCurrency(
  amount: number | bigint | string | { toNumber?: () => number; toString(): string } | null | undefined,
  locale: Locale = 'id'
): string {
  if (amount == null) return 'Rp 0'
  const numeric =
    typeof (amount as any).toNumber === 'function'
      ? (amount as any).toNumber()
      : Number(amount)
  if (isNaN(numeric)) return 'Rp 0'

  if (locale === 'en') {
    return `Rp ${numeric.toLocaleString('en-US')}`
  }
  return `Rp ${numeric.toLocaleString('id-ID')}`
}

/**
 * Format tanggal sesuai konvensi lokal:
 * - 'id': 15 September 2026
 * - 'en': September 15, 2026
 */
export function formatDate(
  date: Date | string,
  locale: Locale = 'id',
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    const defaultOptions: Intl.DateTimeFormatOptions = options || {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', defaultOptions)
  } catch {
    return String(date)
  }
}

/**
 * Format tanggal dan waktu:
 * - 'id': 15 Sep 2026, 09.00 WIB
 * - 'en': Sep 15, 2026, 09:00 WIB
 */
export function formatDateTime(
  date: Date | string,
  locale: Locale = 'id'
): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return (
      d.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' WIB'
    )
  } catch {
    return String(date)
  }
}
