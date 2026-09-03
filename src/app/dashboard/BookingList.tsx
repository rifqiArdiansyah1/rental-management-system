'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { customerCancelBooking } from '@/actions/booking'
import { useRouter } from 'next/navigation'

type BookingWithRelations = {
  id: string
  status: string
  rentalType: string
  startDate: Date
  endDate: Date
  totalPrice: number | string | bigint
  vehicle: {
    name: string
    plateNumber: string
    photos: string[]
    category: { name: string }
  }
  driver: { name: string; phone: string } | null
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending_payment: {
    label: 'Menunggu Pembayaran',
    className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  },
  confirmed: {
    label: 'Terkonfirmasi',
    className: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  },
  ongoing: {
    label: 'Sedang Berjalan',
    className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  },
  completed: {
    label: 'Selesai',
    className: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30',
  },
  cancelled: {
    label: 'Dibatalkan',
    className: 'bg-red-500/15 text-red-400 border border-red-500/30',
  },
}

const PAGE_SIZE = 5

export default function BookingList({ bookings }: { bookings: BookingWithRelations[] }) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const visible = bookings.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < bookings.length

  function handleCancelClick(e: React.MouseEvent, bookingId: string) {
    e.preventDefault()
    e.stopPropagation()
    setCancelTarget(bookingId)
    setCancelError(null)
  }

  function handleConfirmCancel() {
    if (!cancelTarget) return
    startTransition(async () => {
      const res = await customerCancelBooking(cancelTarget)
      if (res.success) {
        setCancelTarget(null)
        router.refresh()
      } else {
        setCancelError(res.error || 'Terjadi kesalahan.')
      }
    })
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl block mb-2">receipt_long</span>
        <p>Belum ada riwayat pemesanan.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {visible.map((booking) => {
          const badge = STATUS_MAP[booking.status] ?? {
            label: booking.status.replace('_', ' '),
            className: 'bg-surface-variant text-on-surface-variant',
          }
          const thumb = booking.vehicle.photos?.[0]
          const vehicleName = booking.vehicle.name || `${booking.vehicle.category.name} (${booking.vehicle.plateNumber})`
          const price = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0,
          }).format(Number(booking.totalPrice))

          return (
            <Link
              key={booking.id}
              href={`/booking/${booking.id}`}
              className="block rounded-xl border border-surface-variant bg-surface-container-low hover:border-secondary/50 transition-colors group"
            >
              <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-surface-variant flex items-center justify-center">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={vehicleName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-on-surface-variant text-3xl">
                      no_photography
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-on-surface group-hover:text-secondary transition-colors truncate">
                      {vehicleName}
                    </h4>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 font-mono mb-2">{booking.vehicle.plateNumber}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                    <span>
                      {new Date(booking.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' — '}
                      {new Date(booking.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-secondary font-semibold">{price}</span>
                  </div>

                  {/* Driver info (with_driver bookings) */}
                  {booking.rentalType === 'with_driver' && booking.driver && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className="material-symbols-outlined text-sm">person</span>
                      <span>Sopir: <span className="text-white font-medium">{booking.driver.name}</span></span>
                      <span className="text-zinc-600">·</span>
                      <span>{booking.driver.phone}</span>
                    </div>
                  )}
                  {booking.rentalType === 'with_driver' && !booking.driver && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400/70">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span>Sopir belum ditugaskan</span>
                    </div>
                  )}

                  {/* Cancel button (only for pending_payment) */}
                  {booking.status === 'pending_payment' && (
                    <button
                      onClick={(e) => handleCancelClick(e, booking.id)}
                      className="mt-3 text-xs text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      Batalkan Pesanan
                    </button>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="mt-4 w-full text-sm text-secondary border border-secondary/40 py-2.5 rounded-lg hover:bg-secondary/10 transition-colors cursor-pointer"
        >
          Lihat Lebih Banyak ({bookings.length - visible.length} lagi)
        </button>
      )}

      {/* Cancel Confirmation Dialog */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface-variant rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-on-surface text-lg mb-2">Batalkan Pesanan?</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Pesanan ini akan dibatalkan secara permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            {cancelError && (
              <p className="text-xs text-red-400 mb-3">{cancelError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={isPending}
                className="flex-1 border border-surface-variant text-on-surface-variant py-2.5 rounded-lg text-sm hover:border-zinc-400 transition-colors cursor-pointer disabled:opacity-50"
              >
                Tidak, Kembali
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isPending}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50 font-semibold"
              >
                {isPending ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
