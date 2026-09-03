'use client'

import { useState, useTransition } from 'react'

type DocumentSectionProps = {
  verificationStatus: string
  ktpDoc: { id: string; type: string } | null
  simDoc: { id: string; type: string } | null
  rejectionNote?: string | null
}

export default function DocumentSection({
  verificationStatus,
  ktpDoc,
  simDoc,
  rejectionNote,
}: DocumentSectionProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLabel, setPreviewLabel] = useState<string>('')
  const [loadingType, setLoadingType] = useState<'ktp' | 'sim' | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  async function handleViewDoc(type: 'ktp' | 'sim') {
    setLoadingType(type)
    setPreviewError(null)
    try {
      const res = await fetch(`/api/document/preview?type=${type}`)
      const data = await res.json()
      if (!res.ok || !data.url) {
        setPreviewError(data.error || 'Gagal memuat pratinjau.')
      } else {
        setPreviewUrl(data.url)
        setPreviewLabel(type.toUpperCase())
      }
    } catch {
      setPreviewError('Terjadi kesalahan saat memuat dokumen.')
    } finally {
      setLoadingType(null)
    }
  }

  function scrollToUpload() {
    const el = document.getElementById('document-upload-form')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {/* Verification Status Section */}
      <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm">
        <p className="text-sm font-semibold text-on-surface-variant mb-3">Status Verifikasi Identitas</p>

        {verificationStatus === 'verified' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-full text-sm font-semibold">
              <span className="material-symbols-outlined text-sm">verified</span>
              Terverifikasi
            </span>
            <p className="text-xs text-on-surface-variant mt-0.5">Identitas Anda sudah diverifikasi.</p>
          </div>
        )}

        {verificationStatus === 'pending' && (
          <div>
            <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-full text-sm font-semibold">
              <span className="material-symbols-outlined text-sm">schedule</span>
              Menunggu Review
            </span>
            <p className="text-xs text-on-surface-variant mt-2">
              Dokumen Anda sedang dalam proses verifikasi oleh tim kami. Proses ini biasanya berlangsung dalam 1×24 jam hari kerja.
            </p>
          </div>
        )}

        {verificationStatus === 'rejected' && (
          <div>
            <span className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full text-sm font-semibold">
              <span className="material-symbols-outlined text-sm">cancel</span>
              Ditolak
            </span>
            {rejectionNote && (
              <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-400 font-semibold mb-0.5">Alasan Penolakan:</p>
                <p className="text-xs text-on-surface-variant">{rejectionNote}</p>
              </div>
            )}
            <p className="text-xs text-on-surface-variant mt-2 mb-3">
              Dokumen Anda tidak lolos verifikasi. Pastikan foto dokumen jelas, tidak buram, dan seluruh informasi terbaca.
            </p>
            <button
              onClick={scrollToUpload}
              className="inline-flex items-center gap-1.5 bg-secondary text-on-secondary text-xs font-semibold px-4 py-2 rounded-lg hover:bg-secondary-fixed transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              Unggah Ulang Sekarang
            </button>
          </div>
        )}
      </div>

      {/* Stored Documents Section */}
      {(ktpDoc || simDoc) && (
        <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm">
          <h3 className="font-semibold text-on-surface mb-4">Dokumen Tersimpan</h3>
          <ul className="flex flex-col gap-3">
            {ktpDoc && (
              <li className="flex justify-between items-center bg-surface-variant p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">badge</span>
                  <span className="font-medium text-on-surface text-sm">KTP</span>
                </div>
                <button
                  onClick={() => handleViewDoc('ktp')}
                  disabled={loadingType === 'ktp'}
                  className="text-xs text-secondary hover:text-white border border-secondary/40 px-3 py-1 rounded-lg hover:bg-secondary/20 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {loadingType === 'ktp' ? (
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  )}
                  Lihat
                </button>
              </li>
            )}
            {simDoc && (
              <li className="flex justify-between items-center bg-surface-variant p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">directions_car</span>
                  <span className="font-medium text-on-surface text-sm">SIM</span>
                </div>
                <button
                  onClick={() => handleViewDoc('sim')}
                  disabled={loadingType === 'sim'}
                  className="text-xs text-secondary hover:text-white border border-secondary/40 px-3 py-1 rounded-lg hover:bg-secondary/20 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {loadingType === 'sim' ? (
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  )}
                  Lihat
                </button>
              </li>
            )}
          </ul>
          {previewError && (
            <p className="text-xs text-red-400 mt-3">{previewError}</p>
          )}
        </div>
      )}

      {/* Document Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-surface border border-surface-variant rounded-2xl p-4 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-on-surface">Pratinjau {previewLabel}</h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <img
              src={previewUrl}
              alt={`Dokumen ${previewLabel}`}
              className="w-full rounded-lg object-contain max-h-96"
            />
            <p className="text-xs text-zinc-500 mt-2 text-center">
              Pratinjau tersedia selama 5 menit. Jangan bagikan tautan ini.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
