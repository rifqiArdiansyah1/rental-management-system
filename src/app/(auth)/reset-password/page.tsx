import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ResetPasswordForm from './ResetPasswordForm'

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

  // Jika tidak ada sesi aktif dari token pertukaran, arahkan kembali ke forgot password
  if (!user) {
    redirect('/forgot-password?message=' + encodeURIComponent('Sesi pengaturan ulang kata sandi tidak ditemukan atau telah berakhir. Silakan minta tautan baru.') + '&type=error')
  }

  const resolvedSearchParams = await searchParams

  return (
    <div className="max-w-md w-full bg-surface-container-lowest/80 backdrop-blur-xl border border-surface-variant/40 rounded-xl shadow-2xl p-8 sm:p-10 transition-all">
      {/* Header Form */}
      <div className="text-center mb-8">
        <span className="font-label-caps text-xs text-secondary tracking-widest uppercase font-semibold block mb-2">
          Prestige Motion
        </span>
        <h1 className="font-display-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
          Atur Ulang Kata Sandi
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant mt-2">
          Buat kata sandi baru yang kuat untuk melindungi akun dan riwayat reservasi Anda.
        </p>
      </div>

      {/* Komponen Form */}
      <ResetPasswordForm initialMessage={resolvedSearchParams.message} />
    </div>
  )
}
