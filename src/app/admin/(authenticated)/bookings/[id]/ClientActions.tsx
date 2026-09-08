'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { verifyDocument, assignDriver, adminCancelBooking, markPaymentRefunded, startRental, endRental } from '@/actions/admin'
import { useRouter } from 'next/navigation'
import { generateSignedDocumentUrl } from '@/actions/document'
import { CheckCircle2, XCircle, UserCheck, XOctagon, ExternalLink, RefreshCw, Play, AlertCircle, Clock, AlertTriangle, Gauge } from 'lucide-react'
import { calculateLateFee } from '@/lib/lateFee'
import { formatWibDateTime } from '@/lib/bookingFilters'

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
  const [odometerStart, setOdometerStart] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleConfirmStart = () => {
    startTransition(async () => {
      setError(null)
      const parsedOdo = odometerStart.trim() !== '' ? parseInt(odometerStart, 10) : undefined
      const res = await startRental(bookingId, {
        odometerStart: parsedOdo
      })
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
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                <Gauge className="w-4 h-4" /> Odometer Awal (km) <span className="text-zinc-400 font-normal">(opsional)</span>
              </label>
              <input
                type="number"
                min="0"
                value={odometerStart}
                onChange={(e) => setOdometerStart(e.target.value)}
                placeholder="Misal: 45200"
                className="w-full text-zinc-900 border border-zinc-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Catatan angka kilometer pada saat serah terima unit ke pelanggan.
              </p>
            </div>

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

export interface EndRentalButtonProps {
  bookingId: string
  endDate?: string | Date
  agreedDailyRate?: number
  vehicleName?: string
  userRole?: string
  className?: string
  buttonText?: string
  variant?: 'compact' | 'full'
  odometerStart?: number | null
  fuelEfficiencyKmL?: number | null
  fuelType?: string | null
  fuelPricePerLiter?: number | null
}

export function EndRentalButton({
  bookingId,
  endDate,
  agreedDailyRate = 0,
  vehicleName,
  userRole,
  className,
  buttonText,
  variant = 'full',
  odometerStart,
  fuelEfficiencyKmL,
  fuelType,
  fuelPricePerLiter,
}: EndRentalButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [waiveLateFee, setWaiveLateFee] = useState(false)
  const [lateFeeNote, setLateFeeNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash_late_fee' | 'midtrans_late_fee'>('cash_late_fee')
  const [customLateFee, setCustomLateFee] = useState<number | ''>('')
  const [odometerEnd, setOdometerEnd] = useState<string>('')

  const canWaive = userRole === 'admin_cabang' || userRole === 'admin_pusat'

  const endDateTime = endDate ? new Date(endDate) : null
  const returnDateTime = new Date()

  // Kalkulasi denda secara real-time
  const feeCalc = endDateTime && agreedDailyRate > 0
    ? calculateLateFee(endDateTime, returnDateTime, agreedDailyRate)
    : null

  const suggestedFee = feeCalc ? feeCalc.suggestedLateFee : 0
  const activeFee = waiveLateFee
    ? 0
    : customLateFee !== ''
    ? Number(customLateFee)
    : suggestedFee

  // Kalkulasi odometer & estimasi BBM real-time
  const parsedOdoEnd = odometerEnd.trim() !== '' ? parseInt(odometerEnd, 10) : null
  const isOdoAnomaly = parsedOdoEnd !== null && odometerStart !== null && odometerStart !== undefined && parsedOdoEnd < odometerStart
  const tripDistance = parsedOdoEnd !== null && odometerStart !== null && odometerStart !== undefined && !isOdoAnomaly
    ? parsedOdoEnd - odometerStart
    : null
  const estimatedFuelLiters = tripDistance !== null && fuelEfficiencyKmL && fuelEfficiencyKmL > 0
    ? tripDistance / fuelEfficiencyKmL
    : null
  const estimatedFuelCost = estimatedFuelLiters !== null && fuelPricePerLiter && fuelPricePerLiter > 0
    ? Math.round(estimatedFuelLiters * fuelPricePerLiter)
    : null

  const handleConfirmEnd = () => {
    if (waiveLateFee && !lateFeeNote.trim()) {
      setError('Catatan alasan wajib diisi saat membebaskan denda keterlambatan.')
      return
    }

    startTransition(async () => {
      setError(null)
      const res = await endRental(bookingId, {
        actualReturnAt: returnDateTime.toISOString(),
        lateFeeAmount: activeFee,
        lateFeeNote: lateFeeNote.trim() || undefined,
        waiveLateFee,
        paymentMethod: activeFee > 0 && !waiveLateFee ? paymentMethod : undefined,
        odometerEnd: parsedOdoEnd !== null ? parsedOdoEnd : undefined,
      })

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
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={isPending}
          className={className || "w-full flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-black text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{buttonText || 'Selesai Sewa'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={isPending}
          className={className || "flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm w-full cursor-pointer"}
        >
          <CheckCircle2 className="w-4 h-4" />
          {buttonText || 'Selesaikan Sewa (Armada Kembali)'}
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full shadow-2xl my-8 text-left">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" /> Konfirmasi Selesai Sewa (Pengembalian Armada)
              </h3>
              <span className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                #{bookingId.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {vehicleName && (
              <p className="text-sm font-semibold text-zinc-800 mb-3">
                Unit Armada: {vehicleName}
              </p>
            )}

            {/* Box Waktu Jadwal vs Aktual */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 text-xs space-y-1.5 mb-4">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Jadwal Selesai Rencana:</span>
                <span className="font-semibold text-zinc-800">
                  {endDateTime ? formatWibDateTime(endDateTime) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Waktu Aktual Pengembalian:</span>
                <span className="font-semibold text-zinc-900">
                  {formatWibDateTime(returnDateTime)}
                </span>
              </div>
              {agreedDailyRate > 0 && (
                <div className="flex justify-between pt-1 border-t border-zinc-200">
                  <span className="text-zinc-500 font-medium">Tarif Sewa Harian:</span>
                  <span className="font-semibold text-zinc-800">
                    Rp {agreedDailyRate.toLocaleString('id-ID')} / hari
                  </span>
                </div>
              )}
            </div>

            {/* Box Pencatatan Odometer & Estimasi BBM */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 text-xs space-y-3 mb-4">
              <div className="flex items-center gap-2 text-zinc-800 font-bold">
                <Gauge className="w-4 h-4 text-blue-600" />
                <span>Pencatatan Odometer & Estimasi BBM</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-500 font-medium mb-1">Odometer Awal (km)</label>
                  <div className="p-2 bg-zinc-100 rounded border border-zinc-200 font-mono font-semibold text-zinc-800">
                    {odometerStart != null ? `${odometerStart.toLocaleString('id-ID')} km` : 'Tidak dicatat'}
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-700 font-medium mb-1">
                    Odometer Akhir (km) <span className="text-zinc-400 font-normal">(opsional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Misal: 45450"
                    value={odometerEnd}
                    onChange={(e) => setOdometerEnd(e.target.value)}
                    className="w-full text-zinc-900 bg-white border border-zinc-300 rounded p-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {isOdoAnomaly && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Odometer akhir ({parsedOdoEnd?.toLocaleString('id-ID')} km) lebih kecil dari odometer awal ({odometerStart?.toLocaleString('id-ID')} km). Data tetap disimpan, namun estimasi konsumsi BBM dilewati.
                  </span>
                </div>
              )}

              {tripDistance !== null && (
                <div className="pt-2 border-t border-zinc-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Jarak Tempuh Trip:</span>
                    <span className="font-semibold text-zinc-900 font-mono">{tripDistance.toLocaleString('id-ID')} km</span>
                  </div>
                  {estimatedFuelLiters !== null && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Estimasi Konsumsi BBM:</span>
                      <span className="font-semibold text-zinc-900">~{estimatedFuelLiters.toFixed(1)} Liter</span>
                    </div>
                  )}
                  {estimatedFuelCost !== null && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Estimasi Biaya BBM:</span>
                      <span className="font-bold text-amber-700 font-mono">
                        ~{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(estimatedFuelCost)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-zinc-500 italic">
                ℹ️ Estimasi BBM informasional — BBM ditanggung penyewa penuh di luar tagihan rental (Opsi A).
              </p>
            </div>

            {/* Kalkulasi Denda & Status Keterlambatan */}
            {feeCalc && (
              <div className="mb-4">
                {!feeCalc.isLate ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-900">Pengembalian Tepat Waktu / Dalam Toleransi</p>
                      <p className="text-emerald-700 mt-0.5">{feeCalc.breakdownText}</p>
                    </div>
                  </div>
                ) : feeCalc.isExtremeLate ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-900">Keterlambatan Ekstrem (&gt; 3 Jam)</p>
                      <p className="text-red-700 mt-0.5">{feeCalc.breakdownText}</p>
                      <p className="text-red-800 font-bold mt-1 text-sm">
                        Denda Terhitung: Rp {feeCalc.suggestedLateFee.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900">Terlambat Kembali (Overtime Proporsional)</p>
                      <p className="text-amber-700 mt-0.5">{feeCalc.breakdownText}</p>
                      <p className="text-amber-800 font-bold mt-1 text-sm">
                        Denda Terhitung: Rp {feeCalc.suggestedLateFee.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bagian Penanganan Denda (jika denda terhitung > 0) */}
            {suggestedFee > 0 && (
              <div className="border border-zinc-200 rounded-lg p-4 mb-4 bg-zinc-50/50 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-medium text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waiveLateFee}
                      onChange={(e) => {
                        setWaiveLateFee(e.target.checked)
                        if (e.target.checked) setError(null)
                      }}
                      disabled={!canWaive}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span className={!canWaive ? 'text-zinc-400' : ''}>
                      Bebaskan Denda Keterlambatan (Waive)
                    </span>
                  </label>
                  {!canWaive && (
                    <span className="text-[10px] bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded font-medium">
                      Khusus Admin Cabang / Pusat
                    </span>
                  )}
                </div>

                {waiveLateFee ? (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Alasan Pembebasan Denda <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={lateFeeNote}
                      onChange={(e) => setLateFeeNote(e.target.value)}
                      placeholder="Contoh: Dispensasi operasional disetujui BM karena kendala armada..."
                      className="w-full p-2 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                      rows={2}
                      required
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Denda akan menjadi Rp 0 dan alasan akan dicatat secara permanen di audit trail.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-zinc-200">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Nominal Denda (Rp)
                      </label>
                      <input
                        type="number"
                        value={customLateFee !== '' ? customLateFee : suggestedFee}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomLateFee(val === '' ? '' : Math.max(0, parseInt(val, 10) || 0))
                        }}
                        className="w-full p-2 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        Metode Pembayaran Denda
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        <label className={`flex items-center gap-2 p-2.5 rounded border cursor-pointer ${
                          paymentMethod === 'cash_late_fee' ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-200 bg-white'
                        }`}>
                          <input
                            type="radio"
                            name={`paymentMethod-${bookingId}`}
                            value="cash_late_fee"
                            checked={paymentMethod === 'cash_late_fee'}
                            onChange={() => setPaymentMethod('cash_late_fee')}
                            className="text-blue-600"
                          />
                          <div>
                            <span className="font-semibold text-zinc-800 block">💵 Tunai di Kasir / Konter Cabang</span>
                            <span className="text-[11px] text-zinc-500">Staf menerima uang tunai langsung. Status denda langsung lunas (success).</span>
                          </div>
                        </label>

                        <label className={`flex items-center gap-2 p-2.5 rounded border cursor-pointer ${
                          paymentMethod === 'midtrans_late_fee' ? 'border-blue-500 bg-blue-50/50' : 'border-zinc-200 bg-white'
                        }`}>
                          <input
                            type="radio"
                            name={`paymentMethod-${bookingId}`}
                            value="midtrans_late_fee"
                            checked={paymentMethod === 'midtrans_late_fee'}
                            onChange={() => setPaymentMethod('midtrans_late_fee')}
                            className="text-blue-600"
                          />
                          <div>
                            <span className="font-semibold text-zinc-800 block">💳 Tagih Online (Midtrans Snap)</span>
                            <span className="text-[11px] text-zinc-500">Dibuatkan tagihan invoice online. Status pending sampai customer membayar.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">
                        Catatan Keterlambatan (Opsional)
                      </label>
                      <input
                        type="text"
                        value={lateFeeNote}
                        onChange={(e) => setLateFeeNote(e.target.value)}
                        placeholder="Catatan tambahan staf..."
                        className="w-full p-2 border border-zinc-300 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmEnd}
                disabled={isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 mt-2">
      <div>
        <select
          value={selectedDriver}
          onChange={(e) => {
            setSelectedDriver(e.target.value)
            setError(null)
          }}
          disabled={isPending}
          className="w-full border border-zinc-300 rounded-md p-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Pilih Sopir --</option>
          {availableDrivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.id === currentDriverId ? '(Saat ini)' : ''}
            </option>
          ))}
        </select>
      </div>

      {isReassignment && selectedDriver && selectedDriver !== currentDriverId && (
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Alasan Pergantian Sopir <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan pergantian sopir (opsional)"
            disabled={isPending}
            required
            className="w-full border border-zinc-300 rounded-md p-2 text-xs text-zinc-900 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !selectedDriver || selectedDriver === currentDriverId}
        className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
      >
        <UserCheck className="w-4 h-4" />
        {isPending ? 'Memproses...' : isReassignment ? 'Ganti Sopir' : 'Tugaskan Sopir'}
      </button>

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