'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDraftBookingAction, BookingFormPayload } from '@/actions/booking'
import { calculateEstimatedPrice } from '@/lib/pricing'
import { RentalType } from '@prisma/client'
import { TURNOVER_BUFFER_MS, isWithinOperatingHoursWIB } from '@/lib/constants'

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
}

export default function BookingForm({ vehicleId, dailyRate, branches, defaultBranchId, vehicleBranch, maintenanceEndAt }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
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

  const isFormValid = startDate && endDate && new Date(startDate) <= new Date(endDate) && branchId === defaultBranchId && isOperatingHoursValid
  
  let pricing = null
  if (startDate && endDate && parsedStartDate && parsedEndDate) {
    pricing = calculateEstimatedPrice(dailyRate, parsedStartDate, parsedEndDate, rentalType)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    if (branchId !== defaultBranchId) {
      setErrorMsg(`Armada ini hanya tersedia di ${assignedBranch?.name || 'cabang asalnya'}. Pemesanan tidak dapat dilakukan di cabang lain.`)
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
        // Redirect to success or payment page. For now, we redirect to a placeholder or home.
        // Once Issue 7 is done, this will redirect to /booking/[id]/payment
        router.push(`/booking/${result.bookingId}`)
      } else {
        setErrorMsg(result.error || 'Terjadi kesalahan tidak terduga.')
      }
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
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
      <h2 className="font-headline-md text-on-surface mb-2">Booking Details</h2>
      
      {errorMsg && (
        <div className="p-4 bg-error-container/20 border border-error text-error rounded-lg text-body-md">
          {errorMsg}
        </div>
      )}

      {maintenanceEndAt && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5">build</span>
          <span>
            Armada ini sedang dalam masa perawatan hingga <strong>{new Date(maintenanceEndAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB</strong>. Waktu penjemputan otomatis dibatasi mulai minimal 3 jam setelah masa perawatan berakhir.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        
        {/* Date Inputs */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-on-surface-variant uppercase">Pick-up Time</label>
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
              <label className="font-label-caps text-on-surface-variant uppercase">Return Time</label>
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
            <span>Jam layanan operasional cabang: <strong>08:00 – 21:00 WIB</strong> (minimal 3 jam dari waktu pemesanan).</span>
          </div>

          {/* Warning if selected time is outside operating hours */}
          {!isOperatingHoursValid && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] flex-shrink-0">warning</span>
              <span>Waktu penjemputan dan pengembalian harus berada dalam rentang jam operasional cabang (08:00 – 21:00 WIB).</span>
            </div>
          )}
        </div>

        {/* Branch Location (Locked to Vehicle's Stationed Branch) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-label-caps text-on-surface-variant uppercase">Branch Location</label>
            <span className="text-[11px] text-secondary/90 bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[13px]">location_on</span>
              Lokasi Armada
            </span>
          </div>

          <div className="relative">
            <select 
              value={branchId}
              onChange={(e) => {
                const selectedId = e.target.value
                if (selectedId !== defaultBranchId) {
                  setErrorMsg(`Armada ini hanya tersedia di ${assignedBranch?.name || 'cabang asalnya'}. Tidak dapat dipesan dari cabang lain.`)
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
                    {b.name} - {b.address} {isCurrentBranch ? '✓ (Lokasi Armada)' : '— (Armada Tidak Tersedia)'}
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
              Armada ini berbasis di <strong>{assignedBranch?.name || 'cabang ini'}</strong>. Pengambilan dan pengembalian wajib dilakukan di cabang yang bersangkutan.
            </span>
          </div>
        </div>

        {/* Rental Type Toggle */}
        <div className="flex flex-col gap-2">
          <label className="font-label-caps text-on-surface-variant uppercase">Service Type</label>
          <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant">
            <button
              type="button"
              onClick={() => setRentalType('self_drive')}
              className={`flex-1 py-2 text-center rounded-md font-button transition-all ${rentalType === 'self_drive' ? 'bg-secondary text-on-secondary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Self-Drive
            </button>
            <button
              type="button"
              onClick={() => setRentalType('with_driver')}
              className={`flex-1 py-2 text-center rounded-md font-button transition-all ${rentalType === 'with_driver' ? 'bg-secondary text-on-secondary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              With Driver
            </button>
          </div>
        </div>

        {/* Dynamic Price Breakdown */}
        {pricing && (
          <div className="mt-4 p-6 bg-surface-container-high rounded-xl border border-outline-variant flex flex-col gap-4">
            <h3 className="font-label-caps text-on-surface-variant uppercase tracking-widest border-b border-surface-variant pb-2">Price Breakdown</h3>
            <div className="flex justify-between items-center text-body-md text-on-surface">
              <span>Vehicle ({formatCurrency(dailyRate)} x {pricing.days} days)</span>
              <span>{formatCurrency(pricing.vehicleTotal)}</span>
            </div>
            {pricing.driverTotal > 0 && (
              <div className="flex justify-between items-center text-body-md text-on-surface">
                <span>Driver Fee (x {pricing.days} days)</span>
                <span>{formatCurrency(pricing.driverTotal)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-2 pt-4 border-t border-surface-variant">
              <span className="font-headline-md text-on-surface">Total Price</span>
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
              <span>Processing...</span>
            </>
          ) : (
            'Confirm Booking'
          )}
        </button>
      </form>
    </div>
  )
}
