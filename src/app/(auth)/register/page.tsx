import { Metadata } from 'next'
import Link from 'next/link'
import { signup } from './actions'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { User, Phone, Mail, Lock, AlertCircle } from 'lucide-react'

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

  return (
    <div className="max-w-md w-full bg-surface-container-lowest/80 backdrop-blur-xl border border-surface-variant/40 rounded-xl shadow-2xl p-8 sm:p-10 transition-all">
      {/* Header Form */}
      <div className="text-center mb-8">
        <span className="font-label-caps text-xs text-secondary tracking-widest uppercase font-semibold block mb-2">
          Prestige Motion
        </span>
        <h1 className="font-display-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
          Daftar Akun Baru
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant mt-2">
          Mulai pengalaman mobilitas kelas atas Anda bersama kami.
        </p>
      </div>

      {resolvedSearchParams.message && (
        <div
          role="alert"
          data-testid="auth-alert"
          className="mb-6 p-3.5 rounded-lg text-sm flex items-start gap-3 bg-error-container/20 border border-error/40 text-error transition-all"
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
            Nama Lengkap
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
              <User className="w-4 h-4" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Nama sesuai KTP"
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 px-4 py-2.5 pl-10 text-sm transition-all"
            />
          </div>
        </div>

        {/* Nomor Telepon */}
        <div>
          <label
            htmlFor="phone"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-1.5"
          >
            Nomor Telepon / WhatsApp
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
              <Phone className="w-4 h-4" />
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              placeholder="08xxxxxxxxxx"
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 px-4 py-2.5 pl-10 text-sm transition-all"
            />
          </div>
        </div>

        {/* Alamat Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-1.5"
          >
            Alamat Email
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
              placeholder="nama@email.com"
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 px-4 py-2.5 pl-10 text-sm transition-all"
            />
          </div>
        </div>

        {/* Kata Sandi */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-label-caps uppercase tracking-wider text-on-surface font-semibold mb-1.5"
          >
            Kata Sandi (Min. {MIN_PASSWORD_LENGTH} Karakter)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
              className="w-full bg-surface-container/60 border border-outline-variant/40 rounded-lg text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 px-4 py-2.5 pl-10 text-sm transition-all"
            />
          </div>
        </div>

        {/* Tombol Submit */}
        <div className="pt-3">
          <button
            type="submit"
            className="w-full bg-secondary text-on-secondary font-bold text-sm tracking-wide rounded-lg py-3 px-4 hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/15 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            Daftar Sekarang
          </button>
        </div>
      </form>

      {/* Footer Navigasi */}
      <div className="text-center mt-6 pt-6 border-t border-surface-variant/30">
        <p className="text-sm text-on-surface-variant">
          Sudah memiliki akun?{' '}
          <Link
            href="/login"
            className="text-secondary font-semibold hover:underline transition-colors inline-block ml-1 cursor-pointer"
          >
            Masuk ke akun Anda
          </Link>
        </p>
      </div>
    </div>
  )
}
