'use client'

import { useState, useTransition } from 'react'
import { Lock, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { updatePassword } from './actions'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface ResetPasswordFormProps {
  initialMessage?: string
}

export default function ResetPasswordForm({ initialMessage }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { t } = useLanguage()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isPending) return

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await updatePassword(formData)
    })
  }

  return (
    <div className="w-full">
      {/* Banner Notifikasi Error */}
      {initialMessage && (
        <div
          role="alert"
          data-testid="auth-alert"
          className="animate-alert-slide mb-6 p-3.5 rounded-lg text-sm flex items-start gap-3 border bg-error-container/20 border-error/40 text-error transition-all"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed flex-1">{initialMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Kata Sandi Baru */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-2"
          >
            {t.auth.newPasswordMinLabel}
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline transition-all duration-300 group-focus-within:text-secondary group-focus-within:scale-110">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              disabled={isPending}
              placeholder={t.auth.passwordMinPlaceholder}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container/90 px-4 py-3 pl-10 pr-11 text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
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

        {/* Konfirmasi Kata Sandi Baru */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-2"
          >
            {t.auth.confirmPasswordLabel}
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline transition-all duration-300 group-focus-within:text-secondary group-focus-within:scale-110">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              disabled={isPending}
              placeholder={t.auth.confirmPasswordPlaceholder}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container/90 px-4 py-3 pl-10 pr-11 text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? t.auth.hidePassword : t.auth.showPassword}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-secondary hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Tombol Simpan */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="shimmer-btn group w-full bg-secondary text-on-secondary font-bold text-sm tracking-wide rounded-lg py-3 px-4 hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-secondary/15 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-on-secondary" />
                <span>{t.auth.savingPassword}</span>
              </>
            ) : (
              <>
                <span>{t.auth.resetSubmitBtn}</span>
                <ShieldCheck className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
