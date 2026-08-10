import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import DocumentUploadForm from '@/components/DocumentUploadForm'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch customer details and documents
  const customer = await prisma.customer.findUnique({
    where: { id: user.id },
    include: {
      documents: true,
      bookings: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { vehicle: true }
      }
    }
  })

  if (!customer) {
    // If not a customer, redirect or show error
    redirect('/')
  }

  const ktpDoc = customer.documents.find(d => d.type === 'ktp')
  const simDoc = customer.documents.find(d => d.type === 'sim')

  return (
    <div className="flex-grow flex flex-col items-center bg-background min-h-screen py-10 px-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Profile & Docs */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm">
            <h2 className="font-display-sm text-on-surface mb-2">Profil Pelanggan</h2>
            <div className="flex flex-col gap-2">
              <p><span className="text-on-surface-variant">Nama:</span> {customer.name}</p>
              <p><span className="text-on-surface-variant">Email:</span> {customer.email}</p>
              <p><span className="text-on-surface-variant">Telepon:</span> {customer.phone}</p>
              
              <div className="mt-4 pt-4 border-t border-surface-variant">
                <p className="text-sm font-medium text-on-surface-variant mb-2">Status Verifikasi Identitas</p>
                {customer.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 bg-success/20 text-success px-3 py-1 rounded-full text-sm font-medium">
                    <span className="material-symbols-outlined text-sm">check_circle</span> Verified
                  </span>
                )}
                {customer.verificationStatus === 'pending' && (
                  <span className="inline-flex items-center gap-1 bg-secondary/20 text-secondary-fixed px-3 py-1 rounded-full text-sm font-medium">
                    <span className="material-symbols-outlined text-sm">schedule</span> Pending Review
                  </span>
                )}
                {customer.verificationStatus === 'rejected' && (
                  <span className="inline-flex items-center gap-1 bg-error/20 text-error px-3 py-1 rounded-full text-sm font-medium">
                    <span className="material-symbols-outlined text-sm">cancel</span> Rejected
                  </span>
                )}
              </div>
            </div>
          </div>

          <DocumentUploadForm />
          
          {(ktpDoc || simDoc) && (
            <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm">
              <h3 className="font-headline-sm text-on-surface mb-4">Dokumen Tersimpan</h3>
              <ul className="flex flex-col gap-3">
                {ktpDoc && (
                  <li className="flex justify-between items-center bg-surface-variant p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">badge</span>
                      <span className="font-medium text-on-surface">KTP</span>
                    </div>
                    <span className="text-sm text-on-surface-variant">{customer.ktpNumber}</span>
                  </li>
                )}
                {simDoc && (
                  <li className="flex justify-between items-center bg-surface-variant p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">directions_car</span>
                      <span className="font-medium text-on-surface">SIM</span>
                    </div>
                    <span className="text-sm text-on-surface-variant">{customer.simNumber}</span>
                  </li>
                )}
              </ul>
              {customer.verificationStatus === 'rejected' && (
                <p className="text-xs text-error mt-4">
                  * Dokumen Anda ditolak. Silakan unggah ulang dokumen yang valid melalui form di atas.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Recent Bookings */}
        <div className="bg-surface p-6 rounded-xl border border-surface-variant shadow-sm h-fit">
          <h2 className="font-display-sm text-on-surface mb-6">Riwayat Pemesanan</h2>
          
          {customer.bookings.length === 0 ? (
            <p className="text-on-surface-variant text-center py-10">Belum ada pemesanan.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {customer.bookings.map(booking => (
                <a 
                  key={booking.id} 
                  href={`/booking/${booking.id}`}
                  className="block p-4 rounded-lg border border-surface-variant hover:border-primary transition-colors group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-on-surface group-hover:text-primary transition-colors">
                      {booking.vehicle.plateNumber}
                    </h4>
                    <span className="text-xs font-label-caps uppercase bg-surface-variant px-2 py-1 rounded text-on-surface-variant">
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm text-on-surface-variant flex gap-4">
                    <span>Mulai: {booking.startDate.toLocaleDateString()}</span>
                    <span>Selesai: {booking.endDate.toLocaleDateString()}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
