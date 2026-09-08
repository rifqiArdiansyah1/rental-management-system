'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import { customerCancelBooking } from '@/actions/booking'
import { createLateFeeSnapToken, syncLateFeePaymentStatus } from '@/actions/payment'
import { useRouter } from 'next/navigation'

type BookingWithRelations = {
  id: string
  status: string
  rentalType: string
  startDate: Date | string
  endDate: Date | string
  totalPrice: number | string | bigint
  actualReturnAt?: string | null
  lateMinutes?: number | null
  lateFeeAmount?: number | null
  lateFeeWaived?: boolean
  lateFeeNote?: string | null
  odometerStart?: number | null
  odometerEnd?: number | null
  vehicle: {
    name: string
    plateNumber: string
    photos: string[]
    category: { name: string }
  }
  driver: { name: string; phone: string } | null
  payments?: Array<{
    id: string
    method: string
    status: string
    amount: number
  }>
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
  const [snapLoadingId, setSnapLoadingId] = useState<string | null>(null)
  const [snapError, setSnapError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isProd = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
  const snapUrl = isProd
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js'
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''

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

  function handlePayLateFee(e: React.MouseEvent, bookingId: string) {
    e.preventDefault()
    e.stopPropagation()
    setSnapLoadingId(bookingId)
    setSnapError(null)

    startTransition(async () => {
      try {
        const res = await createLateFeeSnapToken(bookingId)
        // @ts-ignore
        if (typeof window !== 'undefined' && window.snap) {
          // @ts-ignore
          window.snap.pay(res.token, {
            onSuccess: async () => {
              setSnapLoadingId(null)
              await syncLateFeePaymentStatus(bookingId)
              router.refresh()
            },
            onPending: async () => {
              setSnapLoadingId(null)
              await syncLateFeePaymentStatus(bookingId)
              router.refresh()
            },
            onError: () => {
              setSnapLoadingId(null)
              setSnapError('Pembayaran denda gagal atau dibatalkan.')
            },
            onClose: async () => {
              setSnapLoadingId(null)
              await syncLateFeePaymentStatus(bookingId)
              router.refresh()
            }
          })
        } else {
          setSnapLoadingId(null)
          setSnapError('Modul pembayaran sedang dimuat, silakan coba lagi.')
        }
      } catch (err: any) {
        setSnapLoadingId(null)
        setSnapError(err.message || 'Gagal memulai pembayaran online denda.')
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
      <Script src={snapUrl} data-client-key={clientKey} strategy="lazyOnload" />
      {snapError && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {snapError}
        </div>
      )}
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

                  {/* Late Fee Display & Online Payment */}
                  {booking.lateFeeAmount && Number(booking.lateFeeAmount) > 0 ? (
                    <div className="mt-3 p-2.5 rounded-lg bg-surface border border-red-500/20 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-red-400 font-semibold text-xs block">
                          Denda Keterlambatan: Rp {Number(booking.lateFeeAmount).toLocaleString('id-ID')}
                        </span>
                        <span className="text-zinc-400 text-[11px]">
                          Terlambat {booking.lateMinutes || 0} menit
                          {booking.lateFeeNote && ` • ${booking.lateFeeNote}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {booking.payments?.some(p => (p.method === 'cash_late_fee' || p.method === 'midtrans_late_fee') && p.status === 'success') ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Denda Lunas
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              Belum Lunas
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handlePayLateFee(e, booking.id)}
                              disabled={isPending || snapLoadingId === booking.id}
                              className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-bold rounded-lg text-xs transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                              {snapLoadingId === booking.id ? 'Memuat...' : 'Bayar Denda Online'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : booking.lateFeeWaived ? (
                    <div className="mt-2.5 p-2 rounded-lg bg-surface border border-emerald-500/30 text-xs flex items-center justify-between">
                      <span className="text-emerald-400 font-medium">
                        Denda Keterlambatan: Dibebaskan
                      </span>
                      <span className="text-[10px] text-zinc-400 italic">
                        {booking.lateFeeNote || 'Dispensasi Operasional'}
                      </span>
                    </div>
                  ) : null}

                  {/* Trip Odometer & Fuel Policy Summary */}
                  {booking.odometerStart != null && booking.odometerEnd != null && (
                    <div className="mt-2.5 p-2 rounded-lg bg-surface border border-surface-variant text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-zinc-300">
                        <span className="material-symbols-outlined text-sm text-secondary">speed</span>
                        <span>
                          Trip: <strong className="text-white font-mono">{Math.max(0, booking.odometerEnd - booking.odometerStart)} km</strong>
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {booking.rentalType === 'with_driver'
                          ? 'BBM ditanggung penyewa via sopir'
                          : 'BBM ditanggung penyewa mandiri'}
                      </span>
                    </div>
                  )}

                  {booking.status === 'ongoing' && booking.odometerStart != null && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className="material-symbols-outlined text-sm text-secondary">speed</span>
                      <span>Odometer Awal: <strong className="text-zinc-200 font-mono">{booking.odometerStart.toLocaleString('id-ID')} km</strong></span>
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
