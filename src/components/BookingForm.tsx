'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDraftBookingAction, BookingFormPayload } from '@/actions/booking'
import { calculateEstimatedPrice } from '@/lib/pricing'
import { RentalType } from '@prisma/client'
import { TURNOVER_BUFFER_MS, isWithinOperatingHoursWIB } from '@/lib/constants'
import { checkIntervalOverlap } from '@/lib/utils/date'
import { OccupiedRange } from '@/actions/vehicle'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type Branch = {
  id: string
  name: string
  address: string
}

type Props = {
  vehicleId: string
  dailyRate: number
  branches: Branch[]
  defaultBranchId: string
  vehicleBranch?: Branch | null
  maintenanceEndAt?: string | null
  vehicleStatus?: string
  occupiedRanges?: OccupiedRange[]
}

export default function BookingForm({
  vehicleId,
  dailyRate,
  branches,
  defaultBranchId,
  vehicleBranch,
  maintenanceEndAt,
  vehicleStatus,
  occupiedRanges = [],
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { t, locale, formatCurrency, formatDate } = useLanguage()
  const isEn = locale === 'en'
  
  const assignedBranch = vehicleBranch || branches.find(b => b.id === defaultBranchId) || branches[0]

  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [branchId, setBranchId] = useState<string>(defaultBranchId)
  const [rentalType, setRentalType] = useState<RentalType>('self_drive')

  const parsedStartDate = startDate ? new Date(`${startDate}+07:00`) : null
  const parsedEndDate = endDate ? new Date(`${endDate}+07:00`) : null

  const isStartInHours = parsedStartDate ? isWithinOperatingHoursWIB(parsedStartDate) : true
  const isEndInHours = parsedEndDate ? isWithinOperatingHoursWIB(parsedEndDate) : true
  const isOperatingHoursValid = isStartInHours && isEndInHours

  // Instant client-side conflict check with existing occupied ranges (including 3-hour buffer)
  const hasScheduleConflict = Boolean(
    parsedStartDate &&
    parsedEndDate &&
    occupiedRanges.length > 0 &&
    occupiedRanges.some((range) => {
      const userEndWithBuffer = new Date(parsedEndDate.getTime() + TURNOVER_BUFFER_MS)
      const rangeStart = new Date(range.start)
      const rangeEnd = new Date(range.end)
      return checkIntervalOverlap(parsedStartDate, userEndWithBuffer, rangeStart, rangeEnd)
    })
  )

  const isFormValid =
    startDate &&
    endDate &&
    new Date(startDate) <= new Date(endDate) &&
    branchId === defaultBranchId &&
    isOperatingHoursValid &&
    !hasScheduleConflict
  
  let pricing = null
  if (startDate && endDate && parsedStartDate && parsedEndDate) {
    pricing = calculateEstimatedPrice(dailyRate, parsedStartDate, parsedEndDate, rentalType)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    if (branchId !== defaultBranchId) {
      setErrorMsg(
        isEn
          ? `This vehicle is only available at ${assignedBranch?.name || 'its home branch'}. Reservations cannot be made from other branches.`
          : `Armada ini hanya tersedia di ${assignedBranch?.name || 'cabang asalnya'}. Pemesanan tidak dapat dilakukan di cabang lain.`
      )
      return
    }

    if (hasScheduleConflict) {
      setErrorMsg(
        isEn
          ? 'The selected dates conflict with an existing reservation (including 3-hour turnover buffer). Please choose another schedule.'
          : 'Tanggal yang dipilih bertabrakan dengan jadwal reservasi lain (termasuk buffer jeda 3 jam). Silakan pilih jadwal lain.'
      )
      return
    }

    setErrorMsg(null)
    
    startTransition(async () => {
      // Explicitly parse string as WIB (+07:00) to avoid environment timezone bugs
      const parsedStartDate = new Date(`${startDate}+07:00`)
      const parsedEndDate = new Date(`${endDate}+07:00`)

      const payload: BookingFormPayload = {
        vehicleId,
        branchId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        rentalType,
      }

      const result = await createDraftBookingAction(payload)
      
      if (result.success && result.bookingId) {
        router.push(`/booking/${result.bookingId}`)
      } else {
        setErrorMsg(result.error || (isEn ? 'An unexpected error occurred.' : 'Terjadi kesalahan tidak terduga.'))
      }
    })
  }

  const getLocalMinDateTime = () => {
    // Minimum time is buffer from now (3 hours)
    let minTime = Date.now() + TURNOVER_BUFFER_MS
    if (maintenanceEndAt) {
      const maintEndTime = new Date(maintenanceEndAt).getTime() + TURNOVER_BUFFER_MS
      if (maintEndTime > minTime) {
        minTime = maintEndTime
      }
    }
    const d = new Date(minTime)
    // Convert to WIB string (+7 hours) for datetime-local naive format
    const wibDate = new Date(d.getTime() + 7 * 60 * 60 * 1000)
    return wibDate.toISOString().slice(0, 16)
  }

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      <h2 className="font-headline-md text-on-surface mb-2">
        {t.booking.pageTitle}
      </h2>
      
      {errorMsg && (
        <div className="p-4 bg-error-container/20 border border-error text-error rounded-lg text-body-md" data-testid="booking-error-msg">
          {errorMsg}
        </div>
      )}

      {maintenanceEndAt && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5">build</span>
          <span>
            {isEn ? (
              <>
                This vehicle is currently undergoing scheduled workshop maintenance until <strong>{formatDate(maintenanceEndAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB</strong>. Earliest pickup is restricted to 3 hours after maintenance ends.
              </>
            ) : (
              <>
                Armada ini sedang dalam masa perawatan hingga <strong>{formatDate(maintenanceEndAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB</strong>. Waktu penjemputan otomatis dibatasi mulai minimal 3 jam setelah masa perawatan berakhir.
              </>
            )}
          </span>
        </div>
      )}

      {/* Rented Status Notice */}
      {vehicleStatus === 'rented' && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-lg text-xs flex items-start gap-2" data-testid="rented-vehicle-notice">
          <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5">info</span>
          <span>
            {isEn
              ? 'This vehicle is currently on an active rental. You can still reserve it for future dates that are not yet occupied.'
              : 'Armada ini sedang dalam masa sewa aktif. Anda tetap dapat melakukan reservasi untuk jadwal di luar tanggal sewa yang sedang berjalan.'}
          </span>
        </div>
      )}

      {/* Occupied Ranges List */}
      {occupiedRanges.length > 0 && (
        <div className="p-3 bg-surface-container border border-outline-variant/40 rounded-lg text-xs flex flex-col gap-2" data-testid="occupied-ranges-box">
          <div className="flex items-center gap-1.5 text-on-surface font-semibold">
            <span className="material-symbols-outlined text-[16px] text-secondary">event_busy</span>
            <span>{isEn ? 'Reserved Dates (Unavailable):' : 'Jadwal Terisi (Tidak Tersedia):'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {occupiedRanges.map((range, idx) => {
              const startD = new Date(range.start)
              const endD = new Date(range.end)
              return (
                <span key={idx} className="px-2.5 py-1 rounded bg-surface-variant text-[11px] text-on-surface-variant font-mono flex items-center gap-1">
                  <span>{formatDate(startD, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>—</span>
                  <span>{formatDate(endD, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB</span>
                  {range.reason === 'maintenance' && (
                    <span className="text-[10px] text-amber-400 font-sans ml-1">({isEn ? 'Maint.' : 'Perawatan'})</span>
                  )}
                </span>
              )
            })}
          </div>
          <span className="text-[10px] text-on-surface-variant/70">
            {isEn ? '*Includes 3-hour turnover buffer for vehicle cleaning & inspection.' : '*Termasuk jeda buffer 3 jam untuk pencucian & inspeksi armada.'}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        
        {/* Date Inputs */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-on-surface-variant uppercase">
                {t.booking.startDateLabel}
              </label>
              <input 
                type="datetime-local" 
                required
                min={getLocalMinDateTime()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-surface-container border border-outline-variant rounded p-3 text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-on-surface-variant uppercase">
                {t.booking.endDateLabel}
              </label>
              <input 
                type="datetime-local" 
                required
                min={startDate || getLocalMinDateTime()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-surface-container border border-outline-variant rounded p-3 text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </div>
          </div>

          {/* Operating hours guidance note */}
          <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container p-2.5 rounded-md border border-outline-variant/40">
            <span className="material-symbols-outlined text-[16px] text-secondary">schedule</span>
            <span>
              {isEn ? (
                <>Branch operating hours: <strong>08:00 – 21:00 WIB</strong> (minimum 3 hours advance booking).</>
              ) : (
                <>Jam layanan operasional cabang: <strong>08:00 – 21:00 WIB</strong> (minimal 3 jam dari waktu pemesanan).</>
              )}
            </span>
          </div>

          {/* Warning if selected time is outside operating hours */}
          {!isOperatingHoursValid && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] flex-shrink-0">warning</span>
              <span>
                {isEn
                  ? 'Vehicle pickup and return times must be within branch operating hours (08:00 – 21:00 WIB).'
                  : 'Waktu penjemputan dan pengembalian harus berada dalam rentang jam operasional cabang (08:00 – 21:00 WIB).'}
              </span>
            </div>
          )}

          {/* Warning if selected time conflicts with occupied ranges */}
          {hasScheduleConflict && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-center gap-2" data-testid="schedule-conflict-warning">
              <span className="material-symbols-outlined text-[16px] flex-shrink-0">event_busy</span>
              <span>
                {isEn
                  ? 'The selected dates conflict with an existing reservation (including 3-hour turnover buffer). Please choose another schedule.'
                  : 'Tanggal yang dipilih bertabrakan dengan jadwal reservasi lain (termasuk buffer jeda 3 jam). Silakan pilih jadwal lain.'}
              </span>
            </div>
          )}
        </div>

        {/* Branch Location (Locked to Vehicle's Stationed Branch) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-label-caps text-on-surface-variant uppercase">
              {t.booking.branchLabel}
            </label>
            <span className="text-[11px] text-secondary/90 bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[13px]">location_on</span>
              {isEn ? 'Fleet Base' : 'Lokasi Armada'}
            </span>
          </div>

          <div className="relative">
            <select 
              value={branchId}
              onChange={(e) => {
                const selectedId = e.target.value
                if (selectedId !== defaultBranchId) {
                  setErrorMsg(
                    isEn
                      ? `This vehicle is only stationed at ${assignedBranch?.name || 'its home branch'}. It cannot be booked from other branches.`
                      : `Armada ini hanya tersedia di ${assignedBranch?.name || 'cabang asalnya'}. Tidak dapat dipesan dari cabang lain.`
                  )
                  return
                }
                setBranchId(selectedId)
                setErrorMsg(null)
              }}
              className="w-full bg-surface-container border border-outline-variant rounded p-3 pr-10 text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary appearance-none"
            >
              {branches.map(b => {
                const isCurrentBranch = b.id === defaultBranchId
                return (
                  <option 
                    key={b.id} 
                    value={b.id} 
                    disabled={!isCurrentBranch}
                  >
                    {b.name} - {b.address} {isCurrentBranch ? (isEn ? '✓ (Fleet Station)' : '✓ (Lokasi Armada)') : (isEn ? '— (Unavailable Here)' : '— (Armada Tidak Tersedia)')}
                  </option>
                )
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </div>
          </div>

          {/* Operating branch guidance note */}
          <div className="flex items-start gap-2 text-xs text-on-surface-variant bg-surface-container p-2.5 rounded-md border border-outline-variant/40">
            <span className="material-symbols-outlined text-[16px] text-secondary flex-shrink-0 mt-0.5">info</span>
            <span>
              {isEn ? (
                <>This vehicle is stationed at <strong>{assignedBranch?.name || 'this branch'}</strong>. Pickup and return must occur at this branch location.</>
              ) : (
                <>Armada ini berbasis di <strong>{assignedBranch?.name || 'cabang ini'}</strong>. Pengambilan dan pengembalian wajib dilakukan di cabang yang bersangkutan.</>
              )}
            </span>
          </div>
        </div>

        {/* Rental Type Toggle */}
        <div className="flex flex-col gap-2">
          <label className="font-label-caps text-on-surface-variant uppercase">
            {t.booking.stepService}
          </label>
          <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant">
            <button
              type="button"
              onClick={() => setRentalType('self_drive')}
              className={`flex-1 py-2 text-center rounded-md font-button transition-all ${rentalType === 'self_drive' ? 'bg-secondary text-on-secondary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t.booking.selfDrive}
            </button>
            <button
              type="button"
              onClick={() => setRentalType('with_driver')}
              className={`flex-1 py-2 text-center rounded-md font-button transition-all ${rentalType === 'with_driver' ? 'bg-secondary text-on-secondary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t.booking.withDriver}
            </button>
          </div>
        </div>

        {/* Dynamic Price Breakdown */}
        {pricing && (
          <div className="mt-4 p-6 bg-surface-container-high rounded-xl border border-outline-variant flex flex-col gap-4">
            <h3 className="font-label-caps text-on-surface-variant uppercase tracking-widest border-b border-surface-variant pb-2">
              {t.booking.stepSummary}
            </h3>
            <div className="flex justify-between items-center text-body-md text-on-surface">
              <span>{isEn ? 'Vehicle' : 'Kendaraan'} ({formatCurrency(dailyRate)} x {pricing.days} {isEn ? 'days' : 'hari'})</span>
              <span>{formatCurrency(pricing.vehicleTotal)}</span>
            </div>
            {pricing.driverTotal > 0 && (
              <div className="flex justify-between items-center text-body-md text-on-surface">
                <span>{t.booking.driverFee} (x {pricing.days} {isEn ? 'days' : 'hari'})</span>
                <span>{formatCurrency(pricing.driverTotal)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-2 pt-4 border-t border-surface-variant">
              <span className="font-headline-md text-on-surface">{t.booking.grandTotal}</span>
              <span className="font-headline-md text-secondary">{formatCurrency(pricing.grandTotal)}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={!isFormValid || isPending}
          className="w-full mt-4 bg-secondary text-on-secondary font-button py-4 rounded-lg hover:bg-secondary-fixed transition-all shadow-[0_10px_20px_-10px_rgba(233,193,118,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex justify-center items-center gap-2"
        >
          {isPending ? (
            <>
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              <span>{t.booking.submittingBtn}</span>
            </>
          ) : (
            t.booking.submitBtn
          )}
        </button>
      </form>
    </div>
  )
}
