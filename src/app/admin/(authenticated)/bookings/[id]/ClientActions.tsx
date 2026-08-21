'use client'

import { useState, useTransition } from 'react'
import { verifyDocument, assignDriver, adminCancelBooking, markPaymentRefunded } from '@/actions/admin'
import { useRouter } from 'next/navigation'
import { generateSignedDocumentUrl } from '@/actions/document'
import { CheckCircle2, XCircle, UserCheck, XOctagon, ExternalLink, RefreshCw } from 'lucide-react'

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
        className="flex w-full items-center justify-center gap-2 text-sm text-blue-600 bg-white border border-zinc-200 py-6 rounded-md hover:bg-zinc-50 transition-colors disabled:opacity-50"
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
  
  const handleVerify = (status: 'verified' | 'rejected') => {
    let reason = ''
    if (status === 'rejected') {
      const input = prompt('Alasan penolakan dokumen (akan dikirim via email):')
      if (input === null) return // cancelled
      reason = input
    } else {
      if (!confirm('Verifikasi dokumen ini sah?')) return
    }

    startTransition(async () => {
      setError(null)
      const res = await verifyDocument(documentId, status, reason)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-2 mt-3">
      <div className="flex items-center gap-2">
        {currentStatus !== 'verified' && (
          <button
            onClick={() => handleVerify('verified')}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve
          </button>
        )}
        <button
          onClick={() => handleVerify('rejected')}
          disabled={isPending}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
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
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleAssign = () => {
    if (!selectedDriver) return
    startTransition(async () => {
      setError(null)
      const res = await assignDriver(bookingId, selectedDriver)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-2">
        <select 
          className="border border-zinc-300 rounded-md px-3 py-1.5 text-sm flex-1 disabled:opacity-50 text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={selectedDriver}
          onChange={(e) => setSelectedDriver(e.target.value)}
          disabled={isPending}
        >
          <option value="">-- Pilih Sopir --</option>
          {availableDrivers.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={isPending || !selectedDriver || selectedDriver === currentDriverId}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
        >
          <UserCheck className="w-4 h-4" />
          Assign
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [rejectDoc, setRejectDoc] = useState(false)
  const [sendEmail, setSendEmail] = useState(true)
  const router = useRouter()

  const handleCancel = () => {
    if (!reason || reason.trim().length === 0) {
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
        className="flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        <XOctagon className="w-4 h-4" />
        Batalkan Pesanan (Force Cancel)
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full">
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

              {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isPending || reason.trim().length === 0}
                  className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
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
        className="flex items-center gap-2 bg-zinc-800 text-white hover:bg-zinc-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Tandai Refund Selesai
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
