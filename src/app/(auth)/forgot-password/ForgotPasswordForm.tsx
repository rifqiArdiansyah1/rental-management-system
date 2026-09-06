'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { requestPasswordReset } from './actions'

interface ForgotPasswordFormProps {
  initialMessage?: string
  messageType?: 'success' | 'error' | string
}

export default function ForgotPasswordForm({
  initialMessage,
  messageType,
}: ForgotPasswordFormProps) {
  const [isPending, startTransition] = useTransition()

  const isSuccess = messageType === 'success' || (
    initialMessage && (
      initialMessage.includes('telah dikirim') ||
      initialMessage.includes('berhasil')
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
          className={`mb-6 p-3.5 rounded-lg text-sm flex items-start gap-3 border transition-all ${
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
            Alamat Email Akun
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={isPending}
              placeholder="nama@email.com"
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 px-4 py-3 pl-10 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            Kami akan mengirimkan tautan aman untuk mengatur ulang kata sandi Anda.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-secondary text-on-secondary font-bold text-sm tracking-wide rounded-lg py-3 px-4 hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-secondary/15 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-on-secondary" />
                <span>Mengirim Tautan...</span>
              </>
            ) : (
              <span>Kirim Tautan Pemulihan</span>
            )}
          </button>
        </div>
      </form>

      {/* Kembali ke Login */}
      <div className="text-center mt-6 pt-6 border-t border-surface-variant/30">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-secondary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke halaman masuk</span>
        </Link>
      </div>
    </div>
  )
}
