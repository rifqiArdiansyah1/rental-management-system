import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/utils/prisma'
import { createClient } from '@/utils/supabase/server'
import PaymentClient from './PaymentClient'

export default async function BookingPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const bookingId = resolvedParams.id

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      vehicle: {
        include: { category: true }
      },
      customer: true
    }
  })

  if (!booking) {
    notFound()
  }

  if (booking.customerId !== user.id) {
    redirect('/')
  }

  // Calculate if it's expired manually in UI (60 mins limit)
  const createdAt = new Date(booking.createdAt).getTime()
  const now = Date.now()
  const ageMinutes = (now - createdAt) / (1000 * 60)

  // Pass it to Client Component
  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 bg-background min-h-[calc(100vh-80px)]">
      <div className="max-w-xl w-full bg-surface p-8 rounded-xl border border-surface-variant shadow-xl">
        <h1 className="font-display-md text-on-surface mb-6 text-center tracking-tight">Booking Summary</h1>
        
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex justify-between border-b border-surface-variant pb-2">
            <span className="text-on-surface-variant">Vehicle</span>
            <span className="font-headline-sm text-on-surface">{booking.vehicle.plateNumber}</span>
          </div>
          <div className="flex justify-between border-b border-surface-variant pb-2">
            <span className="text-on-surface-variant">Dates</span>
            <span className="text-on-surface">{booking.startDate.toLocaleDateString()} - {booking.endDate.toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between border-b border-surface-variant pb-2">
            <span className="text-on-surface-variant">Status</span>
            <span className="font-label-caps uppercase text-secondary tracking-widest">{booking.status.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between border-b border-surface-variant pb-2">
            <span className="text-on-surface-variant">Total Price</span>
            <span className="font-headline-md text-secondary">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(booking.totalPrice))}
            </span>
          </div>
        </div>

        {booking.status === 'pending_payment' && ageMinutes < 60 ? (
          <PaymentClient 
            bookingId={booking.id} 
            createdAtMs={createdAt}
            clientKey={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''}
          />
        ) : booking.status === 'pending_payment' ? (
          <div className="text-center p-4 bg-error-container/20 border border-error rounded-lg text-error">
            This booking has expired. Please make a new reservation.
          </div>
        ) : booking.status === 'cancelled' ? (
          <div className="text-center p-4 bg-error-container/20 border border-error rounded-lg text-error">
            This booking has been cancelled.
          </div>
        ) : (
          <div className="text-center p-4 bg-success/20 border border-success rounded-lg text-success">
            Payment successful! Your booking is confirmed.
          </div>
        )}
      </div>
    </div>
  )
}
