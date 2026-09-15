import { Metadata } from 'next'
import LoginForm from './LoginForm'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Masuk ke Akun | Prestige Motion',
  description: 'Masuk ke portal akun pelanggan Prestige Motion untuk mengelola reservasi dan dokumen Anda.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; redirectTo?: string }>
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
          {dict.auth.loginTitle}
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant mt-2 animate-page-desc">
          {dict.auth.loginSubtitle}
        </p>
      </div>

      {/* Komponen Form Login */}
      <LoginForm
        initialMessage={resolvedSearchParams.message}
        redirectTo={resolvedSearchParams.redirectTo}
      />
    </div>
  )
}
