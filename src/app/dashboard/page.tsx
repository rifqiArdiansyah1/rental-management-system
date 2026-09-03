import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import DocumentUploadForm from '@/components/DocumentUploadForm'
import BookingList from './BookingList'
import DocumentSection from './DocumentSection'
import EditProfileModal from './EditProfileModal'
import Navbar from '@/components/Navbar'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Enriched query: vehicle name + photos + driver info
  const customer = await prisma.customer.findUnique({
    where: { id: user.id },
    include: {
      documents: {
        select: { id: true, type: true, fileUrl: true }
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
          driver: {
            select: { name: true, phone: true }
          }
        }
      }
    }
  })

  if (!customer) {
    redirect('/')
  }

  const ktpDoc = customer.documents.find(d => d.type === 'ktp') ?? null
  const simDoc = customer.documents.find(d => d.type === 'sim') ?? null

  // Serialize bookings (Dates and Decimals must be serializable for client components)
  const serializedBookings = customer.bookings.map(b => ({
    id: b.id,
    status: b.status,
    rentalType: b.rentalType,
    startDate: b.startDate,
    endDate: b.endDate,
    totalPrice: Number(b.totalPrice),
    vehicle: {
      name: b.vehicle.name,
      plateNumber: b.vehicle.plateNumber,
      photos: b.vehicle.photos,
      category: { name: b.vehicle.category.name }
    },
    driver: b.driver ? { name: b.driver.name, phone: b.driver.phone } : null
  }))

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-grow py-10 px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-on-surface mb-8 tracking-tight">Dashboard Saya</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* ── Left Column: Profile & Docs ── */}
          <div className="flex flex-col gap-6">

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
            />

            {/* Upload Form (anchored for rejected CTA scroll) */}
            <div id="document-upload-form">
              <DocumentUploadForm />
            </div>
          </div>

          {/* ── Right Column: Booking History ── */}
          <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm h-fit">
            <h2 className="font-semibold text-on-surface text-lg mb-6">Riwayat Pemesanan</h2>
            <BookingList bookings={serializedBookings} />
          </div>

        </div>
      </main>
    </div>
  )
}
