'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Send } from 'lucide-react'
import { requestPasswordReset } from './actions'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface ForgotPasswordFormProps {
  initialMessage?: string
  messageType?: 'success' | 'error' | string
}

export default function ForgotPasswordForm({
  initialMessage,
  messageType,
}: ForgotPasswordFormProps) {
  const [isPending, startTransition] = useTransition()
  const { t } = useLanguage()

  const isSuccess = messageType === 'success' || (
    initialMessage && (
      initialMessage.includes('telah dikirim') ||
      initialMessage.includes('berhasil') ||
      initialMessage.includes('sent') ||
      initialMessage.includes('success')
    )
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isPending) return

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await requestPasswordReset(formData)
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
            isSuccess
              ? 'bg-secondary/10 border-secondary/30 text-secondary'
              : 'bg-error-container/20 border-error/40 text-error'
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed flex-1">{initialMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-2"
          >
            {t.auth.forgotEmailLabel}
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
          <p className="text-xs text-on-surface-variant mt-2">
            {t.auth.forgotEmailHelp}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="shimmer-btn group w-full bg-secondary text-on-secondary font-bold text-sm tracking-wide rounded-lg py-3 px-4 hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-secondary/15 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-on-secondary" />
                <span>{t.auth.sendingResetLink}</span>
              </>
            ) : (
              <>
                <span>{t.auth.forgotSubmitBtn}</span>
                <Send className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Kembali ke Login */}
      <div className="text-center mt-6 pt-6 border-t border-surface-variant/30">
        <Link
          href="/login"
          className="group inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-secondary transition-colors duration-200 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
          <span>{t.auth.backToLogin}</span>
        </Link>
      </div>
    </div>
  )
}
