import { requireAdminSession } from '@/actions/admin'
import { prisma } from '@/utils/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileCheck2, AlertCircle, FileText, CheckCircle2 } from 'lucide-react'
import { VerifyDocumentButton, AssignDriverForm, CancelBookingButton, ViewDocumentButton } from './ClientActions'

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const adminUser = await requireAdminSession()
  
  const branchScope = adminUser.branchId ? { pickupBranchId: adminUser.branchId } : {}
  
  const booking = await prisma.booking.findFirst({
    where: {
      id: params.id,
      ...branchScope
    },
    include: {
      customer: {
        include: { documents: true }
      },
      vehicle: { include: { category: true } },
      driver: true,
      pickupBranch: true,
      returnBranch: true
    }
  })

  if (!booking) {
    notFound()
  }

  // Find available drivers for assignment if needed
  let availableDrivers: Array<{id: string, name: string}> = []
  if (booking.rentalType === 'with_driver' && ['pending_payment', 'confirmed'].includes(booking.status)) {
    // Basic pre-check: drivers in the same branch that are active
    availableDrivers = await prisma.driver.findMany({
      where: { branchId: booking.pickupBranchId, status: { not: 'off_duty' } },
      select: { id: true, name: true }
    })
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/bookings" className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-zinc-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Detail Pesanan</h1>
            <p className="text-zinc-500 mt-1 uppercase font-mono">{booking.id}</p>
          </div>
        </div>
        
        {['pending_payment', 'confirmed'].includes(booking.status) && (
          <CancelBookingButton bookingId={booking.id} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 border-b pb-2">Informasi Kendaraan & Jadwal</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-zinc-500">Armada</p>
                <p className="font-medium text-zinc-900">{booking.vehicle.plateNumber} ({booking.vehicle.category.name})</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Tipe Sewa</p>
                <p className="font-medium text-zinc-900">{booking.rentalType === 'with_driver' ? 'Dengan Sopir' : 'Lepas Kunci (Self Drive)'}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Tanggal Pengambilan</p>
                <p className="font-medium text-zinc-900">{booking.startDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-sm text-zinc-600 mt-1">{booking.pickupBranch.name}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Tanggal Pengembalian</p>
                <p className="font-medium text-zinc-900">{booking.endDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-sm text-zinc-600 mt-1">{booking.returnBranch.name}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 border-b pb-2">Verifikasi Pelanggan (KYC)</h2>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-zinc-600 font-medium">Status Keseluruhan:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                ${booking.customer.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' : ''}
                ${booking.customer.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                ${booking.customer.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-800' : ''}
              `}>
                {booking.customer.verificationStatus.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['KTP', 'SIM'].map((docType) => {
                const doc = booking.customer.documents.find(d => d.type.toUpperCase() === docType)
                return (
                  <div key={docType} className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-zinc-400" />
                        <span className="font-bold text-zinc-700">{docType}</span>
                      </div>
                      {doc ? (
                        doc.verifiedAt ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-100 px-2 py-1 rounded">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium bg-amber-100 px-2 py-1 rounded">
                            <AlertCircle className="w-3.5 h-3.5" /> Pending
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Belum diunggah</span>
                      )}
                    </div>
                    
                    {doc ? (
                      <div>
                        <ViewDocumentButton fileUrl={doc.fileUrl} />
                        <VerifyDocumentButton documentId={doc.id} currentStatus={doc.verifiedAt ? 'verified' : null} />
                      </div>
                    ) : (
                      <div className="w-full text-center text-sm text-zinc-400 bg-white border border-zinc-200 border-dashed py-6 rounded-md">
                        Menunggu unggahan
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Status & Assignment */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 border-b pb-2">Status Pesanan</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-zinc-500 mb-1">Status Pembayaran / Sewa</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold
                  ${booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''}
                  ${booking.status === 'ongoing' ? 'bg-emerald-100 text-emerald-800' : ''}
                  ${booking.status === 'completed' ? 'bg-zinc-100 text-zinc-800' : ''}
                  ${booking.status === 'pending_payment' ? 'bg-amber-100 text-amber-800' : ''}
                  ${booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
                `}>
                  {booking.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              
              {booking.rentalType === 'with_driver' && (
                <div className="pt-4 border-t border-zinc-100">
                  <p className="text-sm text-zinc-500 mb-2">Penugasan Sopir</p>
                  {booking.driver ? (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <p className="font-bold text-blue-900">{booking.driver.name}</p>
                      <p className="text-xs text-blue-700 font-mono mt-1">{booking.driver.licenseNumber}</p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-center gap-2 text-amber-800">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Belum ditugaskan</span>
                    </div>
                  )}

                  {['pending_payment', 'confirmed'].includes(booking.status) && (
                    <div className="mt-4">
                      <p className="text-xs text-zinc-500 mb-2">Pilih / Ubah Sopir:</p>
                      <AssignDriverForm 
                        bookingId={booking.id} 
                        availableDrivers={availableDrivers} 
                        currentDriverId={booking.driverId} 
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
