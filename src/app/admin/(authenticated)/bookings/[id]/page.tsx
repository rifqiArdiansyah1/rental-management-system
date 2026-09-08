import { requireAdminSession } from '@/actions/admin'
import { prisma } from '@/utils/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileText, CheckCircle2, AlertCircle, AlertTriangle, XCircle, CreditCard, Clock, Calendar, Car, User, ShieldCheck, Gauge } from 'lucide-react'
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
import { detectScheduleConflict } from '@/lib/scheduleConflict'
import { formatWibDateTime } from '@/lib/bookingFilters'
import { getFuelPrices } from '@/actions/fuelPrice'
import { calculateTripOdometer } from '@/lib/fuelEstimation'
import { FUEL_TYPE_LABELS } from '@/lib/constants'
import { FuelType } from '@prisma/client'

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
  const agreedDailyRate = Number(booking.agreedDailyRate || booking.vehicle.dailyRate)
  const vehicleDailyRate = agreedDailyRate
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

  const conflict = await detectScheduleConflict(booking.id)
  const hasUnpaidLateFee = Boolean(
    booking.lateFeeAmount &&
    Number(booking.lateFeeAmount) > 0 &&
    !booking.lateFeeWaived &&
    !booking.payments.some(p => (p.method === 'cash_late_fee' || p.method === 'midtrans_late_fee') && p.status === 'success')
  )

  const fuelPrices = await getFuelPrices()
  const activeFuelPrice = fuelPrices.find(p => p.fuelType === booking.vehicle.fuelType)?.pricePerLiter || 10_000

  const tripOdo = calculateTripOdometer({
    odometerStart: booking.odometerStart,
    odometerEnd: booking.odometerEnd,
    efficiencyKmL: booking.vehicle.fuelEfficiencyKmL ? Number(booking.vehicle.fuelEfficiencyKmL) : null,
    pricePerLiter: activeFuelPrice
  })

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

      {/* Schedule Conflict Alert Banner */}
      {conflict.hasConflict && (
        <div className={`p-4 rounded-xl border mb-6 flex items-start gap-3 ${
          conflict.type === 'ongoing_risk' ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            conflict.type === 'ongoing_risk' ? 'text-purple-600' : 'text-rose-600'
          }`} />
          <div>
            <p className="font-bold text-sm">
              {conflict.type === 'ongoing_risk' ? '⚠️ Berisiko Bentrok Jadwal Armada' : '⚠️ Unit Terancam Terlambat'}
            </p>
            <p className="text-xs mt-0.5">
              {conflict.message}
              {conflict.conflictedBooking && (
                <span className="ml-1 font-semibold">
                  (Pesanan #{conflict.conflictedBooking.id.slice(0, 8).toUpperCase()}: {formatWibDateTime(conflict.conflictedBooking.startDate)} - {formatWibDateTime(conflict.conflictedBooking.endDate)})
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Unpaid Late Fee Banner */}
      {hasUnpaidLateFee && (
        <div className="p-4 rounded-xl border mb-6 bg-amber-50 border-amber-300 text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">💰 Tagihan Denda Keterlambatan Belum Lunas</p>
            <p className="text-xs mt-0.5">
              Pesanan ini memiliki tagihan denda keterlambatan sebesar <strong>Rp {Number(booking.lateFeeAmount).toLocaleString('id-ID')}</strong> ({booking.lateMinutes || 0} menit keterlambatan) yang belum diselesaikan oleh pelanggan.
            </p>
          </div>
        </div>
      )}

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
                  Rencana: {booking.endDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">{booking.returnBranch.name} ({booking.returnBranch.city})</p>
                {booking.actualReturnAt && (
                  <div className="mt-2 pt-2 border-t border-zinc-100 text-xs">
                    <span className="text-zinc-500">Waktu Aktual Kembali: </span>
                    <span className="font-semibold text-zinc-800">{formatWibDateTime(booking.actualReturnAt)}</span>
                    {booking.lateMinutes && booking.lateMinutes > 0 ? (
                      <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        booking.lateMinutes > 45 ? 'bg-red-100 text-red-800' : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        Terlambat {booking.lateMinutes} Menit
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Tepat Waktu
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pencatatan Odometer & Estimasi Perjalanan (Opsi A) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-600" /> Pencatatan Odometer & Estimasi Perjalanan
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                Opsi A (BBM Mandiri)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Odometer Awal</p>
                <p className="font-mono font-bold text-zinc-900 text-base mt-1">
                  {booking.odometerStart != null ? `${booking.odometerStart.toLocaleString('id-ID')} km` : '-'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Saat serah terima kunci</p>
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Odometer Akhir</p>
                <p className="font-mono font-bold text-zinc-900 text-base mt-1">
                  {booking.odometerEnd != null
                    ? `${booking.odometerEnd.toLocaleString('id-ID')} km`
                    : booking.status === 'ongoing'
                    ? 'Menunggu pengembalian'
                    : '-'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Saat armada kembali</p>
              </div>

              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Jarak Tempuh Trip</p>
                <p className="font-mono font-bold text-blue-700 text-base mt-1">
                  {tripOdo.distanceKm != null ? `${tripOdo.distanceKm.toLocaleString('id-ID')} km` : '-'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {tripOdo.isAnomaly ? 'Anomali terdeteksi' : 'Total jarak pemakaian'}
                </p>
              </div>
            </div>

            {tripOdo.isAnomaly && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Peringatan: Nilai Odometer Terbalik</p>
                  <p className="mt-0.5">
                    Odometer akhir tercatat lebih rendah dari odometer awal. Data tetap disimpan dalam sistem, namun kalkulasi estimasi konsumsi BBM otomatis dilewati.
                  </p>
                </div>
              </div>
            )}

            {tripOdo.distanceKm != null && !tripOdo.isAnomaly && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Spesifikasi BBM Kendaraan:</span>
                  <span className="font-medium text-zinc-900">
                    {FUEL_TYPE_LABELS[booking.vehicle.fuelType as FuelType] || booking.vehicle.fuelType}
                    {booking.vehicle.fuelEfficiencyKmL ? ` • ${Number(booking.vehicle.fuelEfficiencyKmL)} km/L` : ' (Efisiensi belum diatur)'}
                  </span>
                </div>
                {tripOdo.litersNeeded != null && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Estimasi Konsumsi BBM:</span>
                    <span className="font-semibold text-zinc-900">
                      ~{tripOdo.litersNeeded.toFixed(1)} Liter
                    </span>
                  </div>
                )}
                {tripOdo.estimatedCost != null && (
                  <div className="flex justify-between pt-1 border-t border-blue-200/50">
                    <span className="text-zinc-700 font-medium">Estimasi Biaya BBM:</span>
                    <span className="font-bold text-blue-900 text-sm font-mono">
                      ~{tripOdo.formattedCost || new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(tripOdo.estimatedCost)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-zinc-500 leading-relaxed bg-zinc-50 p-2.5 rounded border border-zinc-200/60">
              ℹ️ <strong>Kebijakan Opsi A:</strong> Biaya bahan bakar dan tol tidak ditagihkan ke dalam invoice rental dan ditanggung langsung oleh penyewa di lapangan. Informasi di atas murni untuk referensi operasional dan analisis efisiensi trip.
            </p>
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

              {/* Denda Keterlambatan Row */}
              {booking.lateFeeAmount && Number(booking.lateFeeAmount) > 0 ? (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-zinc-200/60">
                  <div>
                    <span className="text-red-700 font-semibold block">
                      Denda Keterlambatan ({booking.lateMinutes || 0} menit)
                    </span>
                    {booking.lateFeeNote && (
                      <span className="text-[11px] text-zinc-500 block italic">{booking.lateFeeNote}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-red-700 block">
                      + Rp {Number(booking.lateFeeAmount).toLocaleString('id-ID')}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      hasUnpaidLateFee ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {hasUnpaidLateFee ? 'Belum Lunas' : 'Lunas'}
                    </span>
                  </div>
                </div>
              ) : booking.lateFeeWaived ? (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-zinc-200/60">
                  <div>
                    <span className="text-emerald-700 font-semibold block">
                      Denda Keterlambatan: Dibebaskan (Rp 0)
                    </span>
                    {booking.lateFeeNote && (
                      <span className="text-[11px] text-zinc-500 block italic">Alasan: {booking.lateFeeNote}</span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    WAIVED
                  </span>
                </div>
              ) : null}

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
                  <EndRentalButton
                    bookingId={booking.id}
                    endDate={booking.endDate.toISOString()}
                    agreedDailyRate={agreedDailyRate}
                    vehicleName={booking.vehicle.name || booking.vehicle.category.name}
                    userRole={adminUser.role}
                    odometerStart={booking.odometerStart}
                    fuelEfficiencyKmL={booking.vehicle.fuelEfficiencyKmL ? Number(booking.vehicle.fuelEfficiencyKmL) : null}
                    fuelType={booking.vehicle.fuelType}
                    fuelPricePerLiter={activeFuelPrice}
                  />
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