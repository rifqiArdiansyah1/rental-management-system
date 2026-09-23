import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import DocumentUploadForm from '@/components/DocumentUploadForm'
import BookingList from './BookingList'
import DocumentSection from './DocumentSection'
import EditProfileModal from './EditProfileModal'
import UrgentKycBanner from '@/components/dashboard/UrgentKycBanner'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Enriched query: vehicle name + photos + driver info + documents with verifiedAt
  const customer = await prisma.customer.findUnique({
    where: { id: user.id },
    include: {
      documents: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, fileUrl: true, verifiedAt: true, rejectionReason: true, createdAt: true }
      },
      bookings: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          vehicle: {
            select: {
              name: true,
              plateNumber: true,
              photos: true,
              category: { select: { name: true } }
            }
          },
          pickupBranch: {
            select: { name: true }
          },
          driver: {
            select: { name: true, phone: true }
          },
          payments: {
            select: { id: true, method: true, status: true, amount: true }
          },
          review: {
            select: { id: true, rating: true, comment: true }
          }
        }
      }
    }
  })

  if (!customer) {
    redirect('/')
  }

  const docs = customer.documents || []
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

  const isKtpVerified = Boolean(ktpDoc?.verifiedAt)
  const isSimVerified = Boolean(simDoc?.verifiedAt)
  const isKtpRejected = Boolean(ktpDoc?.rejectionReason && !ktpDoc?.verifiedAt)
  const isSimRejected = Boolean(simDoc?.rejectionReason && !simDoc?.verifiedAt)
  const hasKtp = Boolean(ktpDoc)
  const hasSim = Boolean(simDoc)

  // Prioritas Deterministik: rejected > missing_both > missing_ktp > missing_sim > pending > verified
  let kycReason: 'rejected' | 'missing_both' | 'missing_ktp' | 'missing_sim' | 'pending' | 'verified' = 'verified'
  if (isKtpRejected || isSimRejected) {
    kycReason = 'rejected'
  } else if (!hasKtp && !hasSim) {
    kycReason = 'missing_both'
  } else if (!hasKtp) {
    kycReason = 'missing_ktp'
  } else if (!hasSim) {
    kycReason = 'missing_sim'
  } else if (!isKtpVerified || !isSimVerified) {
    kycReason = 'pending'
  } else {
    kycReason = 'verified'
  }

  const activeConfirmedBooking = customer.bookings.find(b => b.status === 'confirmed')
  const showUrgentBanner = Boolean(activeConfirmedBooking && kycReason !== 'verified')
  const urgentVehicleName = activeConfirmedBooking ? (activeConfirmedBooking.vehicle.name || activeConfirmedBooking.vehicle.category.name) : ''
  const urgentBranchName = activeConfirmedBooking?.pickupBranch?.name || 'Prestige Motion'
  const urgentStartDateFormatted = activeConfirmedBooking ? new Date(activeConfirmedBooking.startDate).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) : ''
  const activeRejectionReason = ktpDoc?.rejectionReason || simDoc?.rejectionReason || null

  // Serialize bookings (Dates and Decimals must be serializable for client components)
  const serializedBookings = customer.bookings.map(b => ({
    id: b.id,
    status: b.status,
    rentalType: b.rentalType,
    startDate: b.startDate,
    endDate: b.endDate,
    totalPrice: Number(b.totalPrice),
    actualReturnAt: b.actualReturnAt ? b.actualReturnAt.toISOString() : null,
    lateMinutes: b.lateMinutes,
    lateFeeAmount: b.lateFeeAmount ? Number(b.lateFeeAmount) : null,
    lateFeeWaived: b.lateFeeWaived,
    lateFeeNote: b.lateFeeNote,
    odometerStart: b.odometerStart,
    odometerEnd: b.odometerEnd,
    vehicle: {
      name: b.vehicle.name,
      plateNumber: b.vehicle.plateNumber,
      photos: b.vehicle.photos,
      category: { name: b.vehicle.category.name }
    },
    driver: b.driver ? { name: b.driver.name, phone: b.driver.phone } : null,
    payments: b.payments.map(p => ({
      id: p.id,
      method: p.method,
      status: p.status,
      amount: Number(p.amount)
    })),
    review: b.review ? { id: b.review.id, rating: b.review.rating, comment: b.review.comment } : null,
    kycStatus: {
      isCustomerVerified: customer.verificationStatus === 'verified',
      isKtpVerified,
      isSimVerified,
      isKtpRejected,
      isSimRejected,
      hasKtp,
      hasSim,
      kycReason,
    }
  }))

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-grow py-10 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full">
        <h1 className="text-2xl font-bold text-on-surface mb-8 tracking-tight">Dashboard Saya</h1>

        {/* Proactive Urgent KYC Banner */}
        {showUrgentBanner && (
          <UrgentKycBanner
            vehicleName={urgentVehicleName}
            startDateFormatted={urgentStartDateFormatted}
            branchName={urgentBranchName}
            reason={kycReason}
            rejectionReason={activeRejectionReason}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── Left Column: Profile & Docs ── */}
          <div className="lg:col-span-5 flex flex-col gap-6">

            {/* Profile Card */}
            <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm">
              <h2 className="font-semibold text-on-surface text-lg mb-4">Profil Pelanggan</h2>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Nama</span>
                  <span className="text-on-surface font-medium">{customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Email</span>
                  <span className="text-on-surface">{customer.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Telepon</span>
                  <span className={customer.phone && customer.phone !== '-' ? 'text-on-surface' : 'text-zinc-500 italic'}>
                    {customer.phone && customer.phone !== '-' ? customer.phone : 'Belum diisi'}
                  </span>
                </div>
              </div>
              <EditProfileModal initialName={customer.name} initialPhone={customer.phone ?? '-'} />
            </div>

            {/* Verification Status + Document View */}
            <DocumentSection
              verificationStatus={customer.verificationStatus}
              ktpDoc={ktpDoc ? { id: ktpDoc.id, type: ktpDoc.type } : null}
              simDoc={simDoc ? { id: simDoc.id, type: simDoc.type } : null}
              rejectionNote={ktpDoc?.rejectionReason || simDoc?.rejectionReason || null}
            />

            {/* Upload Form (anchored for rejected / urgent CTA scroll) */}
            <div id="document-upload-form">
              <DocumentUploadForm
                initialKtpNumber={customer.ktpNumber}
                initialSimNumber={customer.simNumber}
                ktpDoc={ktpDoc}
                simDoc={simDoc}
                verificationStatus={customer.verificationStatus}
              />
            </div>
          </div>

          {/* ── Right Column: Booking History ── */}
          <div className="lg:col-span-7 bg-surface p-6 sm:p-8 rounded-xl border border-surface-variant shadow-sm h-fit">
            <h2 className="font-semibold text-on-surface text-lg mb-6">Riwayat Pemesanan</h2>
            <BookingList bookings={serializedBookings} />
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
