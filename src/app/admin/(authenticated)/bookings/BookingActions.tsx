'use client'

import { startRental, endRental } from '@/actions/admin'
import { useState, useTransition } from 'react'
import { Play, Square } from 'lucide-react'

export function StartRentalButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleStart = () => {
    if (!confirm('Apakah Anda yakin ingin memulai penyewaan ini? Pastikan dokumen pengguna dan penugasan sopir sudah beres.')) return

    startTransition(async () => {
      setError(null)
      const res = await startRental(bookingId)
      if (res.error) {
        setError(res.error)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button 
        onClick={handleStart} 
        disabled={isPending}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Play className="w-4 h-4" />
        {isPending ? 'Memproses...' : 'Mulai Sewa'}
      </button>
      {error && <span className="text-xs text-red-600 max-w-[200px] text-right">{error}</span>}
    </div>
  )
}

export function EndRentalButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleEnd = () => {
    if (!confirm('Apakah Anda yakin ingin menyelesaikan penyewaan ini? Mobil akan kembali berstatus Available.')) return

    startTransition(async () => {
      setError(null)
      const res = await endRental(bookingId)
      if (res.error) {
        setError(res.error)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button 
        onClick={handleEnd} 
        disabled={isPending}
        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-900 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Square className="w-4 h-4" />
        {isPending ? 'Memproses...' : 'Selesai Sewa'}
      </button>
      {error && <span className="text-xs text-red-600 max-w-[200px] text-right">{error}</span>}
    </div>
  )
}
