'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { login } from './actions'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface LoginFormProps {
  initialMessage?: string
  redirectTo?: string
}

export default function LoginForm({ initialMessage, redirectTo }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'

  // Tentukan apakah pesan merupakan informasi sukses
  const isSuccessMessage = initialMessage && (
    initialMessage.toLowerCase().includes('berhasil') ||
    initialMessage.toLowerCase().includes('sukses') ||
    initialMessage.toLowerCase().includes('success')
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isPending) return

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await login(formData)
    })
  }

  return (
    <div className="w-full">
      {/* Banner Notifikasi Pesan */}
      {initialMessage && (
        <div
          role="alert"
          data-testid="auth-alert"
          className={`animate-alert-slide mb-6 p-3.5 rounded-lg text-sm flex items-start gap-3 border transition-all ${
            isSuccessMessage
              ? 'bg-secondary/10 border-secondary/30 text-secondary'
              : 'bg-error-container/20 border-error/40 text-error'
          }`}
        >
          {isSuccessMessage ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed flex-1">{initialMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {redirectTo && (
          <input type="hidden" name="redirectTo" value={redirectTo} />
        )}

        {/* Input Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-2"
          >
            {t.auth.emailLabel}
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
              autoComplete="email"
              disabled={isPending}
              placeholder={t.auth.emailPlaceholder}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container/90 px-4 py-3 pl-10 text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Input Kata Sandi */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="password"
              className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold"
            >
              {t.auth.passwordLabel}
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-secondary hover:text-secondary-fixed hover:underline transition-colors duration-200 cursor-pointer"
            >
              {t.auth.forgotPasswordLink}
            </Link>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline transition-all duration-300 group-focus-within:text-secondary group-focus-within:scale-110">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              disabled={isPending}
              placeholder="••••••••"
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container/90 px-4 py-3 pl-10 pr-11 text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? (isEn ? 'Hide password' : 'Sembunyikan kata sandi') : (isEn ? 'Show password' : 'Tampilkan kata sandi')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-secondary hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
              tabIndex={0}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Tombol Submit "Masuk" */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="shimmer-btn group w-full bg-secondary text-on-secondary font-bold text-sm tracking-wide rounded-lg py-3 px-4 hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-secondary/15 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-on-secondary" />
                <span>{t.auth.submitting}</span>
              </>
            ) : (
              <>
                <span>{t.auth.loginSubmitBtn}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Footer Navigasi Pendaftaran */}
      <div className="text-center mt-6 pt-6 border-t border-surface-variant/30">
        <p className="text-sm text-on-surface-variant">
          {t.auth.noAccountPrompt}{' '}
          <Link
            href="/register"
            className="text-secondary hover:text-secondary-fixed font-semibold hover:underline transition-colors duration-200 inline-block ml-1 cursor-pointer"
          >
            {t.auth.createAccountLink}
          </Link>
        </p>
      </div>
    </div>
  )
}
