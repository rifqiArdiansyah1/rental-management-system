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
    <div className="flex flex-col items-end w-full gap-1">
      <button 
        onClick={handleStart} 
        disabled={isPending}
        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>{isPending ? 'Memproses...' : 'Mulai Sewa'}</span>
      </button>
      {error && <span className="text-[11px] text-red-600 max-w-[160px] text-right">{error}</span>}
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
    <div className="flex flex-col items-end w-full gap-1">
      <button 
        onClick={handleEnd} 
        disabled={isPending}
        className="w-full flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-black text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
        <span>{isPending ? 'Memproses...' : 'Selesai Sewa'}</span>
      </button>
      {error && <span className="text-[11px] text-red-600 max-w-[160px] text-right">{error}</span>}
    </div>
  )
}
