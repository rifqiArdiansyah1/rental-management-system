import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/utils/prisma'
import { createClient } from '@/utils/supabase/server'
import PaymentClient from './PaymentClient'
import { syncPaymentStatus } from '@/actions/payment'

export const dynamic = 'force-dynamic'

export default async function BookingPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const bookingId = resolvedParams.id

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  let booking = await prisma.booking.findUnique({
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

  // Real-time synchronization check: If pending_payment, check directly with Midtrans
  if (booking.status === 'pending_payment') {
    const syncRes = await syncPaymentStatus(booking.id).catch(() => null)
    if (syncRes && syncRes.status && syncRes.status !== 'pending_payment') {
      booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          vehicle: {
            include: { category: true }
          },
          customer: true
        }
      }) || booking
    }
  }

  // Calculate if it's expired manually in UI (60 mins limit)
  const createdAt = new Date(booking.createdAt).getTime()
  const now = Date.now()
  const ageMinutes = (now - createdAt) / (1000 * 60)

  const vehicleName = booking.vehicle.name || `${booking.vehicle.category.name} (${booking.vehicle.plateNumber})`

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 bg-background min-h-[calc(100vh-80px)]">
      <div className="max-w-xl w-full bg-surface p-8 rounded-xl border border-surface-variant shadow-xl">
        <h1 className="font-display-md text-on-surface mb-6 text-center tracking-tight">Booking Summary</h1>
        
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex justify-between border-b border-surface-variant pb-2">
            <span className="text-on-surface-variant">Vehicle</span>
            <div className="text-right">
              <span className="font-headline-sm text-on-surface block">{vehicleName}</span>
              <span className="font-mono text-xs text-on-surface-variant">{booking.vehicle.plateNumber}</span>
            </div>
          </div>
          <div className="flex justify-between border-b border-surface-variant pb-2">
            <span className="text-on-surface-variant">Dates</span>
            <span className="text-on-surface">{booking.startDate.toLocaleDateString('id-ID')} - {booking.endDate.toLocaleDateString('id-ID')}</span>
          </div>
          <div className="flex justify-between border-b border-surface-variant pb-2">
            <span className="text-on-surface-variant">Status</span>
            <span className={`font-label-caps uppercase tracking-widest ${
              booking.status === 'confirmed' ? 'text-emerald-500 font-bold' :
              booking.status === 'cancelled' ? 'text-error font-bold' :
              'text-secondary'
            }`}>
              {booking.status.replace('_', ' ')}
            </span>
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
            clientKey={process.env.MIDTRANS_CLIENT_KEY || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''}
            isProduction={(process.env.MIDTRANS_IS_PRODUCTION || process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION) === 'true'}
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
          <div className="flex flex-col gap-4 text-center p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <div className="flex justify-center">
              <span className="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-on-surface">Pembayaran Berhasil Terverifikasi!</h3>
              <p className="text-sm text-on-surface-variant mt-1">Pesanan Anda telah dikonfirmasi. Anda dapat memantau status pesanan di Dashboard.</p>
            </div>
            <a
              href="/dashboard"
              className="mt-2 inline-block bg-secondary text-on-secondary font-button text-sm py-2.5 px-4 rounded-lg hover:bg-secondary-fixed transition-colors"
            >
              Buka Dashboard Saya
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
