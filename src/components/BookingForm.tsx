'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDraftBookingAction, BookingFormPayload } from '@/actions/booking'
import { calculateEstimatedPrice } from '@/lib/pricing'
import { RentalType } from '@prisma/client'

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
}

export default function BookingForm({ vehicleId, dailyRate, branches, defaultBranchId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [branchId, setBranchId] = useState<string>(defaultBranchId)
  const [rentalType, setRentalType] = useState<RentalType>('self_drive')

  const isFormValid = startDate && endDate && new Date(startDate) <= new Date(endDate) && branchId
  
  let pricing = null
  if (isFormValid) {
    pricing = calculateEstimatedPrice(dailyRate, startDate, endDate, rentalType)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    setErrorMsg(null)
    
    startTransition(async () => {
      const payload: BookingFormPayload = {
        vehicleId,
        branchId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
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
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  }

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      <h2 className="font-headline-md text-on-surface mb-2">Booking Details</h2>
      
      {errorMsg && (
        <div className="p-4 bg-error-container/20 border border-error text-error rounded-lg text-body-md">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        
        {/* Date Inputs */}
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

        {/* Branch Selection (MVP: Single Branch for Pickup and Return) */}
        <div className="flex flex-col gap-2">
          <label className="font-label-caps text-on-surface-variant uppercase">Branch Location</label>
          <select 
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="bg-surface-container border border-outline-variant rounded p-3 text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary appearance-none"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name} - {b.address}</option>
            ))}
          </select>
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
