'use client'

import { useState, useTransition } from 'react'
import { Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { updatePassword } from './actions'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'

interface ResetPasswordFormProps {
  initialMessage?: string
}

export default function ResetPasswordForm({ initialMessage }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

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
          className="mb-6 p-3.5 rounded-lg text-sm flex items-start gap-3 border bg-error-container/20 border-error/40 text-error transition-all"
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
            Kata Sandi Baru (Min. {MIN_PASSWORD_LENGTH} Karakter)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
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
              placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 px-4 py-3 pl-10 pr-11 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-on-surface transition-colors cursor-pointer"
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
            Konfirmasi Kata Sandi Baru
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
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
              placeholder="Ulangi kata sandi baru"
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 px-4 py-3 pl-10 pr-11 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-outline hover:text-on-surface transition-colors cursor-pointer"
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
            className="w-full bg-secondary text-on-secondary font-bold text-sm tracking-wide rounded-lg py-3 px-4 hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-secondary/15 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-on-secondary" />
                <span>Menyimpan Kata Sandi...</span>
              </>
            ) : (
              <span>Simpan Kata Sandi Baru</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
