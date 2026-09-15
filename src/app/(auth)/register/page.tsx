import { Metadata } from 'next'
import Link from 'next/link'
import { signup } from './actions'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { User, Phone, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Daftar Akun Baru | Prestige Motion',
  description: 'Buat akun pelanggan Prestige Motion untuk pengalaman reservasi kendaraan premium yang mulus.',
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
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
          {dict.auth.registerTitle}
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant mt-2 animate-page-desc">
          {dict.auth.registerSubtitle}
        </p>
      </div>

      {resolvedSearchParams.message && (
        <div
          role="alert"
          data-testid="auth-alert"
          className="animate-alert-slide mb-6 p-3.5 rounded-lg text-sm flex items-start gap-3 bg-error-container/20 border border-error/40 text-error transition-all"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed flex-1">{resolvedSearchParams.message}</p>
        </div>
      )}

      <form className="space-y-4" action={signup}>
        {/* Nama Lengkap */}
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-1.5"
          >
            {dict.auth.nameLabel}
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline transition-all duration-300 group-focus-within:text-secondary group-focus-within:scale-110">
              <User className="w-4 h-4" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder={dict.auth.namePlaceholder}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container/90 px-4 py-2.5 pl-10 text-sm transition-all duration-300"
            />
          </div>
        </div>

        {/* Nomor Telepon */}
        <div>
          <label
            htmlFor="phone"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-1.5"
          >
            {dict.auth.phoneLabel}
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline transition-all duration-300 group-focus-within:text-secondary group-focus-within:scale-110">
              <Phone className="w-4 h-4" />
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              placeholder={dict.auth.phonePlaceholder}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container/90 px-4 py-2.5 pl-10 text-sm transition-all duration-300"
            />
          </div>
        </div>

        {/* Alamat Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-1.5"
          >
            {dict.auth.emailLabel}
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline transition-all duration-300 group-focus-within:text-secondary group-focus-within:scale-110">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder={dict.auth.emailPlaceholder}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container/90 px-4 py-2.5 pl-10 text-sm transition-all duration-300"
            />
          </div>
        </div>

        {/* Kata Sandi */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-1.5"
          >
            {dict.auth.passwordMinHint}
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline transition-all duration-300 group-focus-within:text-secondary group-focus-within:scale-110">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={dict.auth.passwordMinPlaceholder}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container/90 px-4 py-2.5 pl-10 text-sm transition-all duration-300"
            />
          </div>
        </div>

        {/* Tombol Submit */}
        <div className="pt-3">
          <button
            type="submit"
            className="shimmer-btn group w-full bg-secondary text-on-secondary font-bold text-sm tracking-wide rounded-lg py-3 px-4 hover:bg-secondary/90 transition-all duration-300 shadow-lg shadow-secondary/15 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>{dict.auth.registerSubmitBtn}</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </form>

      {/* Footer Navigasi */}
      <div className="text-center mt-6 pt-6 border-t border-surface-variant/30">
        <p className="text-sm text-on-surface-variant">
          {dict.auth.hasAccountPrompt}{' '}
          <Link
            href="/login"
            className="text-secondary hover:text-secondary-fixed font-semibold hover:underline transition-colors duration-200 inline-block ml-1 cursor-pointer"
          >
            {dict.auth.signInLink}
          </Link>
        </p>
      </div>
    </div>
  )
}
