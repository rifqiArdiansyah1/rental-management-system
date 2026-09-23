'use client'

import { useState } from 'react'
import DocumentUploadForm, { DocumentSummary } from '@/components/DocumentUploadForm'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  bookingId: string
  branchName: string
  startDateFormatted: string
  customer: {
    id: string
    name: string
    verificationStatus: string
    ktpNumber?: string | null
    simNumber?: string | null
  }
  ktpDoc?: DocumentSummary | null
  simDoc?: DocumentSummary | null
}

export default function PostPaymentKycSection({
  bookingId,
  branchName,
  startDateFormatted,
  customer,
  ktpDoc,
  simDoc
}: Props) {
  const router = useRouter()
  const [showSkipModal, setShowSkipModal] = useState(false)

  const isKtpVerified = Boolean(ktpDoc?.verifiedAt)
  const isSimVerified = Boolean(simDoc?.verifiedAt)
  const isKtpRejected = Boolean(ktpDoc?.rejectionReason && !ktpDoc?.verifiedAt)
  const isSimRejected = Boolean(simDoc?.rejectionReason && !simDoc?.verifiedAt)
  const hasKtp = Boolean(ktpDoc)
  const hasSim = Boolean(simDoc)

  // Prioritas Eksplisit: rejected > belum_lengkap > pending > verified
  let aggregateStatus: 'rejected' | 'belum_lengkap' | 'pending' | 'verified'
  if (isKtpRejected || isSimRejected) {
    aggregateStatus = 'rejected'
  } else if (!hasKtp || !hasSim) {
    aggregateStatus = 'belum_lengkap'
  } else if (!isKtpVerified || !isSimVerified) {
    aggregateStatus = 'pending'
  } else {
    aggregateStatus = 'verified'
  }

  return (
    <div className="flex flex-col gap-8 w-full mt-6" data-testid="post-payment-kyc-section">
      
      {/* ── 3-Step Progress Stepper ── */}
      <div className="bg-surface-variant/40 border border-surface-variant rounded-xl p-4 sm:p-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Step 1: Pembayaran */}
          <div className="flex items-center gap-3 bg-surface p-3.5 rounded-lg border border-emerald-500/30 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
              <span className="material-symbols-outlined text-lg">check</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Langkah 1</p>
              <p className="text-sm font-bold text-on-surface">Pembayaran Lunas</p>
            </div>
          </div>

          {/* Step 2: KYC */}
          <div className={`flex items-center gap-3 bg-surface p-3.5 rounded-lg border shadow-sm ${
            aggregateStatus === 'verified' ? 'border-emerald-500/30' :
            aggregateStatus === 'rejected' ? 'border-red-500/40 bg-red-500/5' :
            aggregateStatus === 'pending' ? 'border-amber-500/30 bg-amber-500/5' :
            'border-secondary/40 bg-secondary/5'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
              aggregateStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
              aggregateStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
              aggregateStatus === 'pending' ? 'bg-amber-500/20 text-amber-400' :
              'bg-secondary/20 text-secondary'
            }`}>
              {aggregateStatus === 'verified' ? (
                <span className="material-symbols-outlined text-lg">check</span>
              ) : aggregateStatus === 'rejected' ? (
                <span className="material-symbols-outlined text-lg">priority_high</span>
              ) : aggregateStatus === 'pending' ? (
                <span className="material-symbols-outlined text-lg">schedule</span>
              ) : (
                <span className="text-sm font-bold">2</span>
              )}
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${
                aggregateStatus === 'verified' ? 'text-emerald-400' :
                aggregateStatus === 'rejected' ? 'text-red-400' :
                aggregateStatus === 'pending' ? 'text-amber-400' :
                'text-secondary'
              }`}>
                Langkah 2
              </p>
              <p className="text-sm font-bold text-on-surface">
                {aggregateStatus === 'verified' ? 'Identitas Terverifikasi' :
                 aggregateStatus === 'rejected' ? 'Perlu Perbaikan Dokumen' :
                 aggregateStatus === 'pending' ? 'Menunggu Peninjauan' :
                 'Verifikasi KTP & SIM'}
              </p>
            </div>
          </div>

          {/* Step 3: Pengambilan Armada */}
          <div className="flex items-center gap-3 bg-surface p-3.5 rounded-lg border border-surface-variant shadow-sm opacity-80">
            <div className="w-8 h-8 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center font-bold flex-shrink-0 text-sm">
              3
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Langkah 3</p>
              <p className="text-sm font-bold text-on-surface">Serah Terima Armada</p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Skenario 1: Verified (Customer Lama / Sudah Diverifikasi) ── */}
      {aggregateStatus === 'verified' && (
        <div className="flex flex-col gap-6 p-6 sm:p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center" data-testid="kyc-verified-box">
          <div className="flex justify-center">
            <span className="material-symbols-outlined text-5xl text-emerald-400">verified</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-on-surface">Identitas Anda Telah Terverifikasi Resmi</h3>
            <p className="text-sm text-on-surface-variant mt-2 max-w-lg mx-auto">
              Dokumen KTP dan SIM Anda sudah valid. Seluruh syarat administrasi persewaan telah terpenuhi, dan armada siap diserahterimakan pada hari-H di cabang <strong>{branchName}</strong>.
            </p>
          </div>

          <div className="p-4 bg-surface rounded-lg border border-surface-variant max-w-md mx-auto w-full text-left text-xs text-on-surface-variant flex flex-col gap-2">
            <div className="flex items-center gap-2 text-on-surface font-semibold text-sm">
              <span className="material-symbols-outlined text-secondary text-base">info</span>
              <span>Instruksi Penjemputan di Hari-H:</span>
            </div>
            <p>• Jadwal: <strong>{startDateFormatted}</strong></p>
            <p>• Lokasi: <strong>Cabang {branchName}</strong></p>
            <p>• Harap bawa <strong>KTP & SIM fisik asli</strong> untuk verifikasi visual singkat oleh staf saat serah terima kunci.</p>
          </div>

          <div className="flex justify-center">
            <Link
              href="/dashboard"
              className="bg-secondary text-on-secondary font-button text-sm py-3 px-8 rounded-full hover:bg-secondary-fixed transition-colors shadow-sm"
            >
              Buka Dashboard Saya
            </Link>
          </div>
        </div>
      )}

      {/* ── Skenario 2: Pending Review (Dokumen Sudah Diunggah, Menunggu Admin) ── */}
      {aggregateStatus === 'pending' && (
        <div className="flex flex-col gap-6 p-6 sm:p-8 bg-amber-500/10 border border-amber-500/30 rounded-xl" data-testid="kyc-pending-box">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <span className="material-symbols-outlined text-4xl text-amber-400 flex-shrink-0 mt-1">schedule</span>
            <div>
              <h3 className="font-headline-sm text-on-surface">Dokumen Anda Sedang Dalam Antrean Peninjauan</h3>
              <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">
                Terima kasih telah mengunggah KTP dan SIM. Tim staf operasional cabang <strong>{branchName}</strong> sedang memverifikasi keabsahan dokumen Anda. Proses ini umumnya selesai dalam 1×24 jam atau sebelum waktu serah terima. Kami akan mengirimkan email konfirmasi begitu disetujui.
              </p>
            </div>
          </div>

          {/* Form tetap ditampilkan agar customer bisa perbarui jika ada kesalahan */}
          <div className="mt-2 border-t border-amber-500/20 pt-6">
            <h4 className="text-sm font-semibold text-on-surface mb-4">Perbarui Dokumen (Jika Diperlukan):</h4>
            <DocumentUploadForm
              bookingId={bookingId}
              ktpDoc={ktpDoc}
              simDoc={simDoc}
              initialKtpNumber={customer.ktpNumber}
              initialSimNumber={customer.simNumber}
              verificationStatus={customer.verificationStatus}
            />
          </div>

          <div className="flex justify-center sm:justify-end border-t border-amber-500/20 pt-4">
            <Link
              href="/dashboard"
              className="bg-surface-variant text-on-surface font-button text-sm py-2.5 px-6 rounded-lg hover:bg-surface-variant/80 transition-colors border border-outline"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* ── Skenario 3 & 4: Belum Lengkap / Ditolak (Form Upload Aktif) ── */}
      {(aggregateStatus === 'belum_lengkap' || aggregateStatus === 'rejected') && (
        <div className="flex flex-col gap-6" data-testid="kyc-actionable-box">
          
          {/* Header Banner */}
          <div className={`p-6 rounded-xl border flex flex-col gap-3 ${
            aggregateStatus === 'rejected'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-secondary/10 border-secondary/30 text-secondary'
          }`}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl">
                {aggregateStatus === 'rejected' ? 'error' : 'shield'}
              </span>
              <div>
                <h3 className="font-headline-sm text-on-surface font-bold">
                  {aggregateStatus === 'rejected'
                    ? 'Tindakan Diperlukan: Dokumen Memerlukan Perbaikan'
                    : 'Langkah Wajib Selanjutnya: Verifikasi KTP & SIM'}
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
                  Sesuai regulasi persewaan dan SOP keselamatan armada, kunci mobil <strong>hanya dapat diserahterimakan pada hari-H</strong> jika identitas Anda (KTP & SIM) telah terverifikasi resmi oleh staf kami. Unggah sekarang agar perjalanan Anda bebas kendala.
                </p>
              </div>
            </div>
          </div>

          {/* Embedded Dual-Slot Upload Form */}
          <DocumentUploadForm
            bookingId={bookingId}
            ktpDoc={ktpDoc}
            simDoc={simDoc}
            initialKtpNumber={customer.ktpNumber}
            initialSimNumber={customer.simNumber}
            verificationStatus={customer.verificationStatus}
          />

          {/* Skip CTA with modal trigger */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-surface-variant">
            <p className="text-xs text-on-surface-variant text-center sm:text-left">
              Tidak sedang membawa fisik KTP / SIM? Anda dapat menyelesaikannya nanti melalui Dashboard.
            </p>
            <button
              type="button"
              onClick={() => setShowSkipModal(true)}
              className="text-xs font-semibold text-secondary hover:underline cursor-pointer flex-shrink-0"
              data-testid="btn-skip-kyc"
            >
              Lengkapi Nanti di Dashboard →
            </button>
          </div>

        </div>
      )}

      {/* ── Modal Dialog Konfirmasi "Lengkapi Nanti" ── */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface max-w-md w-full p-6 rounded-2xl border border-surface-variant shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-400">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="font-headline-sm text-on-surface font-bold">Tunda Verifikasi Dokumen?</h3>
            </div>
            
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Perhatian: Unit kendaraan <strong>TIDAK DAPAT diserahterimakan</strong> pada waktu penjemputan di cabang <strong>{branchName}</strong> jika verifikasi KTP & SIM belum disetujui staf operasional kami.
            </p>
            <p className="text-xs text-on-surface-variant">
              Pastikan Anda mengunggah dokumen sesegera mungkin melalui menu Dashboard sebelum jadwal keberangkatan Anda (<strong>{startDateFormatted}</strong>).
            </p>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowSkipModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-outline text-on-surface hover:bg-surface-variant font-button text-xs transition-colors cursor-pointer"
              >
                Tetap di Sini & Unggah
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSkipModal(false)
                  router.push('/dashboard')
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-secondary text-on-secondary hover:bg-secondary-fixed font-button text-xs transition-colors cursor-pointer"
                data-testid="btn-confirm-skip-dashboard"
              >
                Saya Mengerti, Buka Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
