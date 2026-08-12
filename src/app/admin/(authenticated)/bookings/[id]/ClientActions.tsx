'use client'

import { useState, useTransition } from 'react'
import { verifyDocument, assignDriver, cancelBooking } from '@/actions/admin'
import { generateSignedDocumentUrl } from '@/actions/document'
import { CheckCircle2, XCircle, UserCheck, XOctagon, ExternalLink } from 'lucide-react'

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

  const handleAssign = () => {
    if (!selectedDriver) return
    startTransition(async () => {
      setError(null)
      const res = await assignDriver(bookingId, selectedDriver)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-2">
        <select 
          className="border border-zinc-300 rounded-md px-3 py-1.5 text-sm flex-1 disabled:opacity-50"
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

  const handleCancel = () => {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini secara manual? Proses ini tidak dapat dibatalkan.')) return

    startTransition(async () => {
      setError(null)
      const res = await cancelBooking(bookingId)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCancel}
        disabled={isPending}
        className="flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
      >
        <XOctagon className="w-4 h-4" />
        Batalkan Pesanan
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
