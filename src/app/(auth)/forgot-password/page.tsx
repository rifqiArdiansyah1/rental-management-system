import { Metadata } from 'next'
import ForgotPasswordForm from './ForgotPasswordForm'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Lupa Kata Sandi | Prestige Motion',
  description: 'Atur ulang kata sandi akun pelanggan Prestige Motion Anda dengan tautan pemulihan aman.',
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; type?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return (
    <div className="animate-auth-card max-w-md w-full bg-surface-container-lowest/85 backdrop-blur-xl border border-surface-variant/40 hover:border-secondary/40 rounded-xl shadow-2xl hover:shadow-secondary/5 p-8 sm:p-10 transition-all duration-500">
      {/* Header Form (Pure CSS entrance, LCP safe) */}
      <div className="text-center mb-8">
        <span className="font-label-caps text-xs text-secondary tracking-widest uppercase font-semibold block mb-2 animate-hero-kicker">
          Prestige Motion
        </span>
        <h1 className="font-display-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight animate-page-header">
          {dict.auth.forgotTitle}
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant mt-2 animate-page-desc">
          {dict.auth.forgotSubtitle}
        </p>
      </div>

      {/* Komponen Form */}
      <ForgotPasswordForm
        initialMessage={resolvedSearchParams.message}
        messageType={resolvedSearchParams.type}
      />
    </div>
  )
}
