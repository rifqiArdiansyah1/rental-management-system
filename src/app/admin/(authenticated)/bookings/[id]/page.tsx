import { requireAdminSession } from '@/actions/admin'
import { prisma } from '@/utils/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileText, CheckCircle2, AlertCircle, XCircle, CreditCard, Clock, Calendar, Car, User, ShieldCheck } from 'lucide-react'
import { 
  VerifyDocumentButton, 
  AssignDriverForm, 
  CancelBookingButton, 
  ViewDocumentButton, 
  MarkRefundedButton,
  StartRentalButton,
  EndRentalButton
} from './ClientActions'
import { getEligibleDrivers } from '@/lib/driverEligibility'

export const dynamic = 'force-dynamic'

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const adminUser = await requireAdminSession()
  const resolvedParams = await params
  
  const branchScope = adminUser.branchId ? { pickupBranchId: adminUser.branchId } : {}
  
  const booking = await prisma.booking.findFirst({
    where: {
      id: resolvedParams.id,
      ...branchScope
    },
    include: {
      customer: {
        include: { documents: true }
      },
      vehicle: { include: { category: true } },
      driver: true,
      pickupBranch: true,
      returnBranch: true,
      payments: {
        orderBy: { createdAt: 'desc' }
      },
      adminCanceler: true,
      adminReassigner: true
    }
  })

  if (!booking) {
    notFound()
  }

  // Durasi sewa dalam hari
  const durationMs = booking.endDate.getTime() - booking.startDate.getTime()
  const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)))

  // Nilai numerik aman dari serialisasi Decimal
  const vehicleDailyRate = Number(booking.vehicle.dailyRate)
  const vehicleSubtotal = vehicleDailyRate * durationDays
  const bookingTotalPrice = Number(booking.totalPrice)
  const isWithDriver = booking.rentalType === 'with_driver'

  // Perhitungan rincian sopir & rekonsiliasi
  const driverEstimatedSubtotal = isWithDriver ? Math.max(0, bookingTotalPrice - vehicleSubtotal) : 0
  const driverEstimatedDaily = isWithDriver ? Math.round(driverEstimatedSubtotal / durationDays) : 0
  const actualDriverDaily = isWithDriver && booking.driver ? Number(booking.driver.dailyFee) : 0
  const actualDriverSubtotal = actualDriverDaily * durationDays
  const driverFeeDiff = actualDriverSubtotal - driverEstimatedSubtotal

  // KYC & Driver Pre-conditions untuk StartRental
  const isKycVerified = booking.customer.verificationStatus === 'verified'
  const isDriverReady = !isWithDriver || Boolean(booking.driverId)
  
  let startRentalDisabledReason: string | undefined = undefined
  if (!isKycVerified) {
    startRentalDisabledReason = 'Identitas pelanggan (KTP/SIM) belum diverifikasi. Harap verifikasi dokumen terlebih dahulu sebelum serah terima armada.'
  } else if (!isDriverReady) {
    startRentalDisabledReason = 'Sopir belum ditugaskan. Tugaskan sopir terlebih dahulu sebelum memulai sewa.'
  }

  // Find available drivers for assignment if needed (strictly confirmed and ongoing)
  let availableDrivers: Array<{id: string, name: string}> = []
  if (isWithDriver && ['confirmed', 'ongoing'].includes(booking.status)) {
    const isOngoing = booking.status === 'ongoing'
    const eligible = await getEligibleDrivers(
      booking.pickupBranchId, 
      booking.startDate, 
      booking.endDate, 
      {
        excludeBookingId: booking.id,
        effectiveStartDate: isOngoing ? new Date() : booking.startDate,
        requireCurrentlyAvailable: isOngoing
      }
    )
    availableDrivers = eligible.map(d => ({ id: d.id, name: `${d.name} (${d.licenseNumber})` }))
  }

  const humanFriendlyId = `BK-${booking.id.slice(0, 8).toUpperCase()}`

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/bookings" className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-zinc-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">Detail Pesanan</h1>
              <span className="font-mono text-sm bg-zinc-100 text-zinc-800 font-bold px-2.5 py-0.5 rounded border border-zinc-200">
                {humanFriendlyId}
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-500 mt-1 select-all">{booking.id}</p>
          </div>
        </div>
        
        {['pending_payment', 'confirmed'].includes(booking.status) && adminUser.role !== 'staff_cabang' && (
          <CancelBookingButton bookingId={booking.id} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Informasi Kendaraan & Jadwal */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 border-b pb-2 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" /> Informasi Kendaraan & Jadwal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Armada Kendaraan</p>
                <p className="font-bold text-zinc-900 text-base mt-0.5">
                  {booking.vehicle.name || `${booking.vehicle.category.name} (${booking.vehicle.plateNumber})`}
                </p>
                <p className="text-xs font-mono text-zinc-500 mt-0.5">
                  {booking.vehicle.plateNumber} • {booking.vehicle.category.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Tipe Layanan</p>
                <p className="font-semibold text-zinc-900 mt-0.5">
                  {isWithDriver ? 'Dengan Sopir (With Driver)' : 'Lepas Kunci (Self Drive)'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Durasi Sewa: {durationDays} Hari</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Lokasi & Waktu Pengambilan</p>
                <p className="font-medium text-zinc-900 mt-0.5">
                  {booking.startDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">{booking.pickupBranch.name} ({booking.pickupBranch.city})</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Lokasi & Waktu Pengembalian</p>
                <p className="font-medium text-zinc-900 mt-0.5">
                  {booking.endDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">{booking.returnBranch.name} ({booking.returnBranch.city})</p>
              </div>
            </div>
          </div>

          {/* 2. Rincian Biaya & Riwayat Pembayaran */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 border-b pb-2 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" /> Rincian Biaya & Riwayat Pembayaran
            </h2>

            {/* Price Breakdown Table */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200 space-y-2 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-600">
                  Sewa Kendaraan ({durationDays} hari × Rp {vehicleDailyRate.toLocaleString('id-ID')})
                </span>
                <span className="font-medium text-zinc-900">Rp {vehicleSubtotal.toLocaleString('id-ID')}</span>
              </div>

              {isWithDriver && (
                <div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-600">
                      Layanan Sopir ({durationDays} hari × Rp {driverEstimatedDaily.toLocaleString('id-ID')})
                    </span>
                    <span className="font-medium text-zinc-900">Rp {driverEstimatedSubtotal.toLocaleString('id-ID')}</span>
                  </div>

                  {/* Rekonsiliasi Tarif Sopir Aktual jika sudah ditugaskan */}
                  {booking.driver && (
                    <div className="mt-2 pt-2 border-t border-zinc-200/80 text-xs text-zinc-500 bg-white p-2.5 rounded border">
                      <div className="flex justify-between items-center font-medium">
                        <span>Tarif Aktual Sopir ({booking.driver.name}):</span>
                        <span>Rp {Number(booking.driver.dailyFee).toLocaleString('id-ID')} / hari</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span>Total Kompensasi Aktual Sopir:</span>
                        <span>Rp {actualDriverSubtotal.toLocaleString('id-ID')}</span>
                      </div>
                      {driverFeeDiff !== 0 && (
                        <div className="mt-1 pt-1 border-t border-zinc-100 flex justify-between items-center text-[11px]">
                          <span className="text-amber-700 font-medium">Selisih Rekonsiliasi Internal:</span>
                          <span className={driverFeeDiff > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                            {driverFeeDiff > 0 ? `+ Rp ${driverFeeDiff.toLocaleString('id-ID')} (Subsidi Operasional)` : `- Rp ${Math.abs(driverFeeDiff).toLocaleString('id-ID')} (Efisiensi)`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-zinc-200 flex justify-between items-center text-base font-bold">
                <span className="text-zinc-900">Total Nilai Sewa</span>
                <span className="text-emerald-700">Rp {bookingTotalPrice.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Riwayat Transaksi Pembayaran */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Riwayat Transaksi Gateway
              </h3>

              {booking.payments.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-2">Belum ada catatan percobaan pembayaran.</p>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100 text-zinc-600 font-medium border-b border-zinc-200">
                      <tr>
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Metode</th>
                        <th className="py-2.5 px-3">Referensi Gateway</th>
                        <th className="py-2.5 px-3">Nominal</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                      {booking.payments.map((p) => {
                        const amountNum = Number(p.amount)
                        return (
                          <tr key={p.id} className="hover:bg-zinc-50">
                            <td className="py-2.5 px-3 text-zinc-500">
                              {p.createdAt.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-zinc-900 uppercase">{p.method}</td>
                            <td className="py-2.5 px-3 font-mono text-zinc-600 truncate max-w-[140px]">
                              {p.gatewayReference || p.id.slice(0, 8)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-zinc-900">
                              Rp {amountNum.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                                ${p.status === 'success' ? 'bg-emerald-100 text-emerald-800' : ''}
                                ${p.status === 'pending' ? 'bg-amber-100 text-amber-800' : ''}
                                ${p.status === 'failed' ? 'bg-red-100 text-red-800' : ''}
                                ${p.status === 'refunded' ? 'bg-blue-100 text-blue-800' : ''}
                              `}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Refund Alert Banner for Cancelled Booking with Success Payment */}
            {booking.status === 'cancelled' && booking.payments.some(p => p.status === 'success') && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-bold text-red-800 flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600" /> Perlu Tindak Lanjut Refund Manual
                </p>
                <p className="text-xs text-red-700 leading-relaxed mb-3">
                  Pesanan ini telah dibatalkan tetapi terdapat pembayaran yang berhasil diverifikasi. Harap lakukan refund manual melalui dasbor Midtrans lalu tandai selesai di bawah ini.
                </p>
                {adminUser.role !== 'staff_cabang' && (
                  <MarkRefundedButton paymentId={booking.payments.find(p => p.status === 'success')!.id} />
                )}
              </div>
            )}
          </div>

          {/* 3. Verifikasi Pelanggan (KYC) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 border-b pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" /> Verifikasi Pelanggan (KYC)
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase
                ${booking.customer.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' : ''}
                ${booking.customer.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                ${booking.customer.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-800' : ''}
              `}>
                Status: {booking.customer.verificationStatus}
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['KTP', 'SIM'].map((docType) => {
                const doc = booking.customer.documents.find(d => d.type.toUpperCase() === docType)
                const isRejected = doc?.rejectionReason && !doc.verifiedAt
                return (
                  <div key={docType} className="border border-zinc-200 rounded-lg p-4 bg-zinc-50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-zinc-500" />
                          <span className="font-bold text-zinc-800">{docType}</span>
                        </div>
                        {doc ? (
                          doc.verifiedAt ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : isRejected ? (
                            <span className="flex items-center gap-1 text-xs text-red-700 font-semibold bg-red-100 px-2 py-0.5 rounded">
                              <XCircle className="w-3.5 h-3.5" /> Ditolak
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                              <AlertCircle className="w-3.5 h-3.5" /> Pending
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Belum diunggah</span>
                        )}
                      </div>

                      {doc?.rejectionReason && (
                        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <p className="font-semibold mb-0.5">Catatan Penolakan:</p>
                          <p>{doc.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                    
                    {doc ? (
                      <div className="mt-2 space-y-2">
                        <ViewDocumentButton fileUrl={doc.fileUrl} />
                        <VerifyDocumentButton documentId={doc.id} currentStatus={doc.verifiedAt ? 'verified' : null} />
                      </div>
                    ) : (
                      <div className="w-full text-center text-xs text-zinc-400 bg-white border border-zinc-200 border-dashed py-6 rounded-md">
                        Menunggu unggahan pelanggan
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Status & Operational Actions */}
        <div className="space-y-6">
          
          {/* Status Pesanan & Operasional Serah Terima */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 border-b pb-2">Status Operasional</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">Status Pesanan</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider
                  ${booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''}
                  ${booking.status === 'ongoing' ? 'bg-emerald-100 text-emerald-800' : ''}
                  ${booking.status === 'completed' ? 'bg-zinc-100 text-zinc-800' : ''}
                  ${booking.status === 'pending_payment' ? 'bg-amber-100 text-amber-800' : ''}
                  ${booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
                `}>
                  {booking.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* Action Buttons: Mulai Sewa & Selesaikan Sewa */}
              <div className="pt-3 border-t border-zinc-100">
                {booking.status === 'confirmed' && (
                  <StartRentalButton 
                    bookingId={booking.id}
                    disabled={!isKycVerified || !isDriverReady}
                    disabledReason={startRentalDisabledReason}
                  />
                )}

                {booking.status === 'ongoing' && (
                  <EndRentalButton bookingId={booking.id} />
                )}

                {booking.status === 'completed' && (
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Masa sewa telah selesai dan armada telah dikembalikan.</span>
                  </div>
                )}
              </div>

              {/* Cancellation Detail Box */}
              {booking.status === 'cancelled' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs">
                  <p className="font-bold text-red-800 mb-1">Dibatalkan Oleh:</p>
                  <p className="text-red-900 mb-2">{booking.adminCanceler?.name || 'Sistem / Pelanggan'}</p>
                  <p className="font-bold text-red-800 mb-1">Alasan Pembatalan:</p>
                  <p className="text-red-900">{booking.cancellationNote || '-'}</p>
                </div>
              )}

              {/* Driver Assignment Section */}
              {isWithDriver && (
                <div className="pt-4 border-t border-zinc-100">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">Penugasan Sopir</p>
                  {booking.driver ? (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <p className="font-bold text-blue-900 text-sm">{booking.driver.name}</p>
                      <p className="text-xs text-blue-700 font-mono mt-0.5">{booking.driver.licenseNumber}</p>
                      <p className="text-xs text-zinc-600 mt-1">Telp: {booking.driver.phone}</p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-center gap-2 text-amber-800 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Belum ada sopir yang ditugaskan</span>
                    </div>
                  )}

                  {booking.reassignedAt && (
                    <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200 rounded-md text-xs">
                      <p className="font-medium text-zinc-500 mb-0.5">Riwayat Pergantian Sopir:</p>
                      <p className="text-zinc-700">
                        Diganti oleh <strong className="text-zinc-900">{booking.adminReassigner?.name || 'Admin'}</strong> pada{' '}
                        {booking.reassignedAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      {booking.reassignmentReason && (
                        <p className="text-zinc-600 mt-1 italic">
                          "{booking.reassignmentReason}"
                        </p>
                      )}
                    </div>
                  )}

                  {['confirmed', 'ongoing'].includes(booking.status) && (
                    <div className="mt-4">
                      <p className="text-xs text-zinc-600 font-medium mb-1">
                        {booking.driverId ? 'Ganti Sopir (Reassignment):' : 'Pilih Sopir:'}
                      </p>
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

          {/* Customer Profile Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 mb-4 border-b pb-2 flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-600" /> Informasi Pemesan
            </h2>
            <div className="space-y-2.5 text-sm">
              <div>
                <span className="text-xs text-zinc-500 block">Nama Lengkap</span>
                <span className="font-semibold text-zinc-900">{booking.customer.name}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Email</span>
                <span className="text-zinc-800">{booking.customer.email}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Nomor Telepon</span>
                <span className="text-zinc-800 font-mono">{booking.customer.phone || '-'}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}