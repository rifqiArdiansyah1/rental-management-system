import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/utils/prisma'
import { createClient } from '@/utils/supabase/server'
import PaymentClient from './PaymentClient'
import BookingReviewCard from './BookingReviewCard'
import PostPaymentKycSection from '@/components/booking/PostPaymentKycSection'
import { syncPaymentStatus } from '@/actions/payment'
import { getDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function BookingPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const bookingId = resolvedParams.id

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const t = await getDictionary()

  let booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      vehicle: {
        include: { category: true }
      },
      customer: {
        include: {
          documents: {
            orderBy: { createdAt: 'desc' }
          }
        }
      },
      pickupBranch: true,
      review: true
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
          customer: {
            include: {
              documents: {
                orderBy: { createdAt: 'desc' }
              }
            }
          },
          pickupBranch: true,
          review: true
        }
      }) || booking
    }
  }

  // Calculate if it's expired manually in UI (60 mins limit)
  const createdAt = new Date(booking.createdAt).getTime()
  const now = Date.now()
  const ageMinutes = (now - createdAt) / (1000 * 60)

  const vehicleName = booking.vehicle.name || `${booking.vehicle.category.name} (${booking.vehicle.plateNumber})`

  const docs = booking.customer.documents || []
  const rawKtp = docs.find(d => d.type.toLowerCase() === 'ktp')
  const ktpDoc = rawKtp ? {
    id: rawKtp.id,
    type: 'ktp',
    fileUrl: rawKtp.fileUrl,
    verifiedAt: rawKtp.verifiedAt,
    rejectionReason: rawKtp.rejectionReason,
  } : null

  const rawSim = docs.find(d => d.type.toLowerCase() === 'sim')
  const simDoc = rawSim ? {
    id: rawSim.id,
    type: 'sim',
    fileUrl: rawSim.fileUrl,
    verifiedAt: rawSim.verifiedAt,
    rejectionReason: rawSim.rejectionReason,
  } : null

  const branchName = booking.pickupBranch?.name || 'Prestige Motion'
  const startDateFormatted = booking.startDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 bg-background min-h-[calc(100vh-80px)]">
      <div className="max-w-2xl w-full bg-surface p-6 sm:p-8 rounded-xl border border-surface-variant shadow-xl">
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
          <div className="flex flex-col items-center text-center p-6 bg-error-container/10 border border-error/30 rounded-2xl" data-testid="cancelled-booking-card">
            <div className="w-14 h-14 rounded-full bg-error-container/20 text-error flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">event_busy</span>
            </div>
            
            <h2 className="font-bold text-on-surface text-lg mb-1">
              {t.booking?.selfCancel?.cancelledTitle || 'Pemesanan Telah Dibatalkan'}
            </h2>
            
            {booking.cancellationNote && (
              <p className="text-xs font-medium text-error mb-2 bg-error-container/20 px-3 py-1 rounded-full border border-error/20">
                {booking.cancellationNote}
              </p>
            )}

            <p className="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
              {t.booking?.selfCancel?.cancelledDesc ||
                'Slot jadwal armada telah dilepaskan dan tagihan pembayaran ini sudah tidak berlaku.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center">
              <Link
                href="/#vehicles"
                className="flex-1 bg-secondary text-on-secondary font-button py-3 px-4 rounded-lg hover:bg-secondary-fixed transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                data-testid="explore-other-vehicles-btn"
              >
                <span className="material-symbols-outlined text-base">directions_car</span>
                <span>{t.booking?.selfCancel?.exploreFleetBtn || 'Jelajahi Armada Lain'}</span>
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 border border-surface-variant hover:bg-surface-variant/50 text-on-surface font-button py-3 px-4 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                data-testid="dashboard-from-cancelled-btn"
              >
                <span className="material-symbols-outlined text-base">dashboard</span>
                <span>{t.booking?.selfCancel?.myDashboardBtn || 'Lihat Dasbor Saya'}</span>
              </Link>
            </div>
          </div>
        ) : booking.status === 'completed' ? (
          <BookingReviewCard
            bookingId={booking.id}
            vehicleName={vehicleName}
            review={booking.review ? { id: booking.review.id, rating: booking.review.rating, comment: booking.review.comment } : null}
          />
        ) : (
          <PostPaymentKycSection
            bookingId={booking.id}
            branchName={branchName}
            startDateFormatted={startDateFormatted}
            customer={{
              id: booking.customer.id,
              name: booking.customer.name,
              verificationStatus: booking.customer.verificationStatus,
              ktpNumber: booking.customer.ktpNumber,
              simNumber: booking.customer.simNumber,
            }}
            ktpDoc={ktpDoc}
            simDoc={simDoc}
          />
        )}
      </div>
    </div>
  )
}
