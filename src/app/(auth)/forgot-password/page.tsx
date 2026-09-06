import { Metadata } from 'next'
import ForgotPasswordForm from './ForgotPasswordForm'

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

  return (
    <div className="max-w-md w-full bg-surface-container-lowest/80 backdrop-blur-xl border border-surface-variant/40 rounded-xl shadow-2xl p-8 sm:p-10 transition-all">
      {/* Header Form */}
      <div className="text-center mb-8">
        <span className="font-label-caps text-xs text-secondary tracking-widest uppercase font-semibold block mb-2">
          Prestige Motion
        </span>
        <h1 className="font-display-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
          Lupa Kata Sandi
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant mt-2">
          Masukkan alamat email akun Anda untuk menerima instruksi pemulihan kata sandi.
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
