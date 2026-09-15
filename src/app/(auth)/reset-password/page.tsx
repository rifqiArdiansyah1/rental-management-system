import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ResetPasswordForm from './ResetPasswordForm'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Atur Ulang Kata Sandi | Prestige Motion',
  description: 'Tetapkan kata sandi baru untuk mengamankan akun pelanggan Prestige Motion Anda.',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const locale = await getLocale()
  const dict = await getDictionary(locale)

  // Jika tidak ada sesi aktif dari token pertukaran, arahkan kembali ke forgot password
  if (!user) {
    const expiredMsg = locale === 'en'
      ? 'Password reset session is invalid or expired. Please request a new recovery link.'
      : 'Sesi pengaturan ulang kata sandi tidak ditemukan atau telah berakhir. Silakan minta tautan baru.'
    redirect('/forgot-password?message=' + encodeURIComponent(expiredMsg) + '&type=error')
  }

  const resolvedSearchParams = await searchParams

  return (
    <div className="animate-auth-card max-w-md w-full bg-surface-container-lowest/85 backdrop-blur-xl border border-surface-variant/40 hover:border-secondary/40 rounded-xl shadow-2xl hover:shadow-secondary/5 p-8 sm:p-10 transition-all duration-500">
      {/* Header Form (Pure CSS entrance, LCP safe) */}
      <div className="text-center mb-8">
        <span className="font-label-caps text-xs text-secondary tracking-widest uppercase font-semibold block mb-2 animate-hero-kicker">
          Prestige Motion
        </span>
        <h1 className="font-display-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight animate-page-header">
          {dict.auth.resetTitle}
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant mt-2 animate-page-desc">
          {dict.auth.resetSubtitle}
        </p>
      </div>

      {/* Komponen Form */}
      <ResetPasswordForm initialMessage={resolvedSearchParams.message} />
    </div>
  )
}
