'use client'

import { useState, useTransition, useRef } from 'react'
import { uploadIdentityDocument, SupportedDocumentType } from '@/actions/document'
import { useRouter } from 'next/navigation'

export type DocumentSummary = {
  id: string
  type: string
  fileUrl?: string
  verifiedAt?: Date | string | null
  rejectionReason?: string | null
}

type Props = {
  bookingId?: string
  ktpDoc?: DocumentSummary | null
  simDoc?: DocumentSummary | null
  initialKtpNumber?: string | null
  initialSimNumber?: string | null
  verificationStatus?: string | null
  onSuccess?: () => void
}

export default function DocumentUploadForm({
  bookingId,
  ktpDoc,
  simDoc,
  initialKtpNumber,
  initialSimNumber,
  verificationStatus,
  onSuccess
}: Props) {
  const router = useRouter()
  const [isKtpPending, startKtpTransition] = useTransition()
  const [isSimPending, startSimTransition] = useTransition()

  // Double-submit protection locks
  const isKtpSubmittingRef = useRef(false)
  const isSimSubmittingRef = useRef(false)

  const [ktpError, setKtpError] = useState<string | null>(null)
  const [ktpSuccess, setKtpSuccess] = useState<string | null>(null)

  const [simError, setSimError] = useState<string | null>(null)
  const [simSuccess, setSimSuccess] = useState<string | null>(null)

  const handleUpload = async (type: SupportedDocumentType, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const isKtp = type === 'ktp'

    if (isKtp) {
      if (isKtpSubmittingRef.current || isKtpPending) return
      isKtpSubmittingRef.current = true
      setKtpError(null)
      setKtpSuccess(null)
    } else {
      if (isSimSubmittingRef.current || isSimPending) return
      isSimSubmittingRef.current = true
      setSimError(null)
      setSimSuccess(null)
    }

    const formElement = e.currentTarget
    const formData = new FormData(formElement)
    formData.set('type', type)
    if (bookingId) {
      formData.set('bookingId', bookingId)
    }

    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      if (isKtp) {
        setKtpError('Silakan pilih file dokumen untuk diunggah.')
        isKtpSubmittingRef.current = false
      } else {
        setSimError('Silakan pilih file dokumen untuk diunggah.')
        isSimSubmittingRef.current = false
      }
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      if (isKtp) {
        setKtpError('Ukuran file maksimal 5MB')
        isKtpSubmittingRef.current = false
      } else {
        setSimError('Ukuran file maksimal 5MB')
        isSimSubmittingRef.current = false
      }
      return
    }

    const transitionFn = isKtp ? startKtpTransition : startSimTransition

    transitionFn(async () => {
      try {
        const result = await uploadIdentityDocument(formData)
        if (result?.error) {
          if (isKtp) setKtpError(result.error)
          else setSimError(result.error)
        } else {
          if (isKtp) {
            setKtpSuccess('Dokumen KTP berhasil diunggah! Menunggu verifikasi tim staf.')
            // Reset only file input, keep number
            const fileInput = formElement.querySelector('input[type="file"]') as HTMLInputElement | null
            if (fileInput) fileInput.value = ''
          } else {
            setSimSuccess('Dokumen SIM berhasil diunggah! Menunggu verifikasi tim staf.')
            const fileInput = formElement.querySelector('input[type="file"]') as HTMLInputElement | null
            if (fileInput) fileInput.value = ''
          }
          router.refresh()
          if (onSuccess) onSuccess()
        }
      } catch (err) {
        if (isKtp) setKtpError('Terjadi kesalahan pada sistem saat mengunggah KTP.')
        else setSimError('Terjadi kesalahan pada sistem saat mengunggah SIM.')
      } finally {
        if (isKtp) isKtpSubmittingRef.current = false
        else isSimSubmittingRef.current = false
      }
    })
  }

  const renderBadge = (doc: DocumentSummary | null | undefined) => {
    if (!doc) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-variant text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">help_outline</span>
          Belum Diunggah
        </span>
      )
    }

    if (doc.verifiedAt) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="material-symbols-outlined text-[14px]">verified</span>
          Terverifikasi
        </span>
      )
    }

    if (doc.rejectionReason) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
          <span className="material-symbols-outlined text-[14px]">cancel</span>
          Ditolak
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <span className="material-symbols-outlined text-[14px]">schedule</span>
        Menunggu Review
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ── Slot 1: KTP ── */}
        <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm flex flex-col justify-between" data-testid="kyc-slot-ktp">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">badge</span>
                <h4 className="font-semibold text-on-surface text-base">KTP (Identitas Nasional)</h4>
              </div>
              {renderBadge(ktpDoc)}
            </div>

            <p className="text-xs text-on-surface-variant mb-4">
              Wajib untuk seluruh jenis rental. Pastikan foto KTP jelas, tidak buram, dan NIK terbaca sempurna.
            </p>

            {ktpDoc?.rejectionReason && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                <span className="font-semibold block mb-0.5">Alasan Penolakan:</span>
                <span>{ktpDoc.rejectionReason}</span>
              </div>
            )}

            {ktpError && (
              <div className="mb-4 p-3 bg-error-container text-error rounded-md text-xs">
                {ktpError}
              </div>
            )}
            {ktpSuccess && (
              <div className="mb-4 p-3 bg-success-container text-success rounded-md text-xs">
                {ktpSuccess}
              </div>
            )}
          </div>

          <form onSubmit={(e) => handleUpload('ktp', e)} className="flex flex-col gap-3 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-on-surface-variant">Nomor KTP (NIK)</label>
              <input 
                type="text" 
                name="identityNumber" 
                required 
                defaultValue={initialKtpNumber || ''}
                placeholder="16 digit NIK"
                className="p-2 text-sm rounded-md border border-outline bg-surface text-on-surface focus:outline-none focus:border-primary"
                data-testid="input-ktp-number"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-on-surface-variant">File Foto / Scan KTP (Maks 5MB)</label>
              <input 
                type="file" 
                name="file" 
                accept="image/jpeg, image/png, application/pdf" 
                required 
                className="p-1.5 text-xs text-on-surface-variant file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-primary-container file:text-on-primary-container hover:file:bg-primary hover:file:text-on-primary transition-all cursor-pointer"
                data-testid="input-ktp-file"
              />
            </div>

            <button 
              type="submit" 
              disabled={isKtpPending}
              className="mt-2 w-full bg-secondary text-on-secondary py-2.5 px-4 rounded-lg font-button text-sm hover:bg-secondary-fixed transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer"
              data-testid="btn-upload-ktp"
            >
              {isKtpPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  <span>Mengunggah KTP...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">upload</span>
                  <span>{ktpDoc ? 'Perbarui / Unggah Ulang KTP' : 'Unggah KTP'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Slot 2: SIM ── */}
        <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm flex flex-col justify-between" data-testid="kyc-slot-sim">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">directions_car</span>
                <h4 className="font-semibold text-on-surface text-base">SIM (Surat Izin Mengemudi)</h4>
              </div>
              {renderBadge(simDoc)}
            </div>

            <p className="text-xs text-on-surface-variant mb-4">
              Wajib untuk verifikasi identitas penyewa. Pastikan SIM A aktif dan data masa berlaku terlihat jelas.
            </p>

            {simDoc?.rejectionReason && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                <span className="font-semibold block mb-0.5">Alasan Penolakan:</span>
                <span>{simDoc.rejectionReason}</span>
              </div>
            )}

            {simError && (
              <div className="mb-4 p-3 bg-error-container text-error rounded-md text-xs">
                {simError}
              </div>
            )}
            {simSuccess && (
              <div className="mb-4 p-3 bg-success-container text-success rounded-md text-xs">
                {simSuccess}
              </div>
            )}
          </div>

          <form onSubmit={(e) => handleUpload('sim', e)} className="flex flex-col gap-3 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-on-surface-variant">Nomor SIM</label>
              <input 
                type="text" 
                name="identityNumber" 
                required 
                defaultValue={initialSimNumber || ''}
                placeholder="Nomor SIM Anda"
                className="p-2 text-sm rounded-md border border-outline bg-surface text-on-surface focus:outline-none focus:border-primary"
                data-testid="input-sim-number"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-on-surface-variant">File Foto / Scan SIM (Maks 5MB)</label>
              <input 
                type="file" 
                name="file" 
                accept="image/jpeg, image/png, application/pdf" 
                required 
                className="p-1.5 text-xs text-on-surface-variant file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-primary-container file:text-on-primary-container hover:file:bg-primary hover:file:text-on-primary transition-all cursor-pointer"
                data-testid="input-sim-file"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSimPending}
              className="mt-2 w-full bg-secondary text-on-secondary py-2.5 px-4 rounded-lg font-button text-sm hover:bg-secondary-fixed transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer"
              data-testid="btn-upload-sim"
            >
              {isSimPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  <span>Mengunggah SIM...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">upload</span>
                  <span>{simDoc ? 'Perbarui / Unggah Ulang SIM' : 'Unggah SIM'}</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
