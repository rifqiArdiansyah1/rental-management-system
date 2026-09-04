'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { verifyDocument, assignDriver, adminCancelBooking, markPaymentRefunded, startRental, endRental } from '@/actions/admin'
import { useRouter } from 'next/navigation'
import { generateSignedDocumentUrl } from '@/actions/document'
import { CheckCircle2, XCircle, UserCheck, XOctagon, ExternalLink, RefreshCw, Play, AlertCircle } from 'lucide-react'

export function ViewDocumentButton({ fileUrl }: { fileUrl: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleView = () => {
    startTransition(async () => {
      setError(null)
      const res = await generateSignedDocumentUrl(fileUrl)
      if (res.error) {
        setError(res.error)
      } else if (res.url) {
        window.open(res.url, '_blank')
      }
    })
  }

  return (
    <div className="w-full">
      <button
        onClick={handleView}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 text-sm text-blue-600 bg-white border border-zinc-200 py-6 rounded-md hover:bg-zinc-50 transition-colors disabled:opacity-50 cursor-pointer"
      >
        <ExternalLink className="w-4 h-4" />
        {isPending ? 'Membuka...' : 'Lihat Dokumen'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
    </div>
  )
}

export function VerifyDocumentButton({ documentId, currentStatus }: { documentId: string, currentStatus?: 'verified' | null }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const router = useRouter()
  
  const handleApprove = () => {
    startTransition(async () => {
      setError(null)
      const res = await verifyDocument(documentId, 'verified')
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      setError('Mohon masukkan alasan penolakan minimal 5 karakter.')
      return
    }

    startTransition(async () => {
      setError(null)
      const res = await verifyDocument(documentId, 'rejected', rejectReason.trim())
      if (res.error) {
        setError(res.error)
      } else {
        setIsRejectModalOpen(false)
        setRejectReason('')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 mt-3">
      <div className="flex items-center gap-2">
        {currentStatus !== 'verified' && (
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve
          </button>
        )}
        <button
          onClick={() => {
            setError(null)
            setIsRejectModalOpen(true)
          }}
          disabled={isPending}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          <XCircle className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}

      {/* Reject Reason Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-red-700 mb-2 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Tolak Dokumen Identitas
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              Masukkan alasan penolakan dokumen. Alasan ini akan tersimpan di sistem, tampil di dashboard customer, dan dikirimkan via email.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full border border-zinc-300 rounded-md p-2.5 text-sm text-zinc-900 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Foto KTP buram dan NIK tidak terbaca jelas. Mohon unggah ulang foto asli beresolusi tinggi."
                  disabled={isPending}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Tolak Dokumen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function StartRentalButton({ 
  bookingId, 
  disabled = false, 
  disabledReason 
}: { 
  bookingId: string
  disabled?: boolean
  disabledReason?: string 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleConfirmStart = () => {
    startTransition(async () => {
      setError(null)
      const res = await startRental(bookingId)
      if (res.error) {
        setError(res.error)
      } else {
        setIsOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled || isPending}
        title={disabled ? disabledReason : undefined}
        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed shadow-sm w-full cursor-pointer"
      >
        <Play className="w-4 h-4" />
        Mulai Sewa (Serah Terima Kunci)
      </button>
      {disabled && disabledReason && (
        <p className="text-xs text-amber-700 mt-1 flex items-start gap-1 bg-amber-50 p-2 rounded border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{disabledReason}</span>
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900 mb-2 flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-600" /> Konfirmasi Mulai Sewa
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              Apakah Anda yakin ingin menyerahkan armada dan kunci ke pelanggan sekarang? Status pesanan akan berganti menjadi <strong>ONGOING</strong>.
            </p>
            {error && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmStart}
                disabled={isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isPending ? 'Memproses...' : 'Ya, Mulai Sewa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function EndRentalButton({ bookingId }: { bookingId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleConfirmEnd = () => {
    startTransition(async () => {
      setError(null)
      const res = await endRental(bookingId)
      if (res.error) {
        setError(res.error)
      } else {
        setIsOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <button
        onClick={() => setIsOpen(true)}
        disabled={isPending}
        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm w-full cursor-pointer"
      >
        <CheckCircle2 className="w-4 h-4" />
        Selesaikan Sewa (Armada Kembali)
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" /> Konfirmasi Selesai Sewa
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              Konfirmasi bahwa armada telah diperiksa dan diserahkan kembali oleh pelanggan. Status pesanan akan berganti menjadi <strong>COMPLETED</strong> dan armada akan berstatus tersedia kembali.
            </p>
            {error && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmEnd}
                disabled={isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isPending ? 'Memproses...' : 'Ya, Selesaikan Sewa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AssignDriverForm({ bookingId, availableDrivers, currentDriverId }: { 
  bookingId: string, 
  availableDrivers: Array<{id: string, name: string}>,
  currentDriverId?: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [selectedDriver, setSelectedDriver] = useState(currentDriverId || '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const prevDriverIdRef = useRef(currentDriverId)

  useEffect(() => {
    if (prevDriverIdRef.current !== currentDriverId) {
      setSelectedDriver(currentDriverId || '')
      setReason('')
      prevDriverIdRef.current = currentDriverId
    }
  }, [currentDriverId])

  const isReassignment = Boolean(currentDriverId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDriver) return

    if (isReassignment && (!reason.trim() || reason.trim().length < 5)) {
      setError('Alasan penggantian sopir wajib diisi (minimal 5 karakter).')
      return
    }

    startTransition(async () => {
      setError(null)
      const res = await assignDriver(bookingId, selectedDriver, isReassignment ? reason.trim() : undefined)
      if (res.error) {
        setError(res.error)
      } else {
        setReason('')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
      <div className="flex gap-2">
        <select
          value={selectedDriver}
          onChange={(e) => {
            setSelectedDriver(e.target.value)
            setError(null)
          }}
          disabled={isPending}
          className="flex-1 border border-zinc-300 rounded-md p-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Pilih Sopir --</option>
          {availableDrivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.id === currentDriverId ? '(Saat ini)' : ''}
            </option>
          ))}
        </select>
        
        <button
          type="submit"
          disabled={isPending || !selectedDriver || selectedDriver === currentDriverId}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          <UserCheck className="w-4 h-4" />
          {isReassignment ? 'Ganti' : 'Tugaskan'}
        </button>
      </div>

      {isReassignment && selectedDriver && selectedDriver !== currentDriverId && (
        <div className="mt-2">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Alasan Pergantian Sopir <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Sopir sakit mendadak, izin keluarga, dsb."
            disabled={isPending}
            required
            className="w-full border border-zinc-300 rounded-md p-2 text-xs text-zinc-900 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {error && <span className="text-xs text-red-600 mt-1">{error}</span>}
    </form>
  )
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [rejectDoc, setRejectDoc] = useState(false)
  const [sendEmail, setSendEmail] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCancel = () => {
    if (!reason.trim()) {
      setError('Alasan pembatalan wajib diisi.')
      return
    }

    startTransition(async () => {
      setError(null)
      const res = await adminCancelBooking(bookingId, reason, rejectDoc, sendEmail)
      if (res.error) {
        setError(res.error)
      } else {
        setIsOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
      >
        <XOctagon className="w-4 h-4" />
        Batalkan Pesanan (Force Cancel)
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-red-700 mb-2 flex items-center gap-2">
              <XOctagon className="w-5 h-5" /> Batalkan Pesanan Secara Sepihak
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              Masukkan alasan pembatalan pesanan ini. Tindakan ini tidak dapat dibatalkan dan akan langsung membebaskan kendaraan terkait.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Alasan Pembatalan *</label>
                <textarea
                  className="w-full border border-zinc-300 rounded-md p-2 text-sm text-zinc-900 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Misal: Dokumen palsu - Refund akan diproses 3 hari kerja"
                  disabled={isPending}
                  required
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rejectDoc}
                  onChange={(e) => setRejectDoc(e.target.checked)}
                  disabled={isPending}
                  className="mt-1"
                />
                <span className="text-sm text-zinc-700">
                  Sekaligus tandai status verifikasi KTP/SIM pelanggan ini sebagai <strong>Ditolak</strong> (jika alasan pembatalan adalah dokumen bermasalah).
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={isPending}
                />
                <span className="text-sm text-zinc-700">
                  Kirim notifikasi pembatalan ke email pelanggan.
                </span>
              </label>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Membatalkan...' : 'Batalkan Sekarang'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function MarkRefundedButton({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleRefunded = () => {
    if (!confirm('Apakah Anda yakin telah mengembalikan dana ke pelanggan secara manual? Tindakan ini akan menandai refund selesai dan tidak bisa dibatalkan.')) return
    
    startTransition(async () => {
      setError(null)
      const res = await markPaymentRefunded(paymentId)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-start gap-1 mt-3">
      <button
        onClick={handleRefunded}
        disabled={isPending}
        className="flex items-center gap-2 bg-zinc-800 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Tandai Refund Selesai
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}