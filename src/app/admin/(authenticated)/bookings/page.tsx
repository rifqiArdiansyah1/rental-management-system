export const dynamic = 'force-dynamic'

import { requireAdminSession } from '@/actions/admin'
import { prisma } from '@/utils/prisma'
import Link from 'next/link'
import { StartRentalButton, EndRentalButton } from './BookingActions'
import { getStaffScope } from '@/lib/auth/scope'
import {
  BookingActionTabs,
  BookingFilterBar,
  BookingPagination
} from './ClientComponents'
import {
  buildBookingWhereClause,
  formatWibDateTime,
  formatWibDateOnly,
  parseWibDateBoundary
} from '@/lib/bookingFilters'
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Car,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  RotateCcw
} from 'lucide-react'

export default async function AdminBookingsPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const resolvedParams = await searchParams
  const adminUser = await requireAdminSession()
  const scope = await getStaffScope()

  const currentTab = resolvedParams.tab || 'action_required'
  const page = Math.max(1, parseInt(resolvedParams.page || '1', 10))
  const pageSize = 15
  const skip = (page - 1) * pageSize

  // 1. Fetch live count badges for all tabs concurrently
  const [actionRequiredCount, handoverTodayCount, ongoingCount, allCount] = await Promise.all([
    prisma.booking.count({ where: buildBookingWhereClause({ tab: 'action_required' }, scope) }),
    prisma.booking.count({ where: buildBookingWhereClause({ tab: 'handover_today' }, scope) }),
    prisma.booking.count({ where: buildBookingWhereClause({ tab: 'ongoing' }, scope) }),
    prisma.booking.count({ where: buildBookingWhereClause({ tab: 'all' }, scope) })
  ])

  // 2. Fetch paginated data, total filtered count, and filter dropdown options concurrently
  const where = buildBookingWhereClause(resolvedParams, scope)

  const [bookings, totalFilteredCount, branches, drivers] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        customer: true,
        vehicle: {
          include: { category: true }
        },
        driver: true,
        pickupBranch: true,
        returnBranch: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    prisma.booking.count({ where }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.driver.findMany({
      where: {
        isActive: true,
        ...(scope.scope === 'branch' ? { branchId: scope.branchId } : {})
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
  ])

  const now = new Date()
  const todayWibStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now)
  const startOfTodayWib = parseWibDateBoundary(todayWibStr, false)
  const endOfTodayWib = parseWibDateBoundary(todayWibStr, true)

  return (
    <div className="p-4 md:p-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900">Manajemen Pesanan</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Antrian kerja operasional, penugasan sopir, verifikasi dokumen, dan pemantauan status rental.
        </p>
      </div>

      {/* Preset Action Tabs */}
      <BookingActionTabs
        currentTab={currentTab}
        counts={{
          actionRequired: actionRequiredCount,
          handoverToday: handoverTodayCount,
          ongoing: ongoingCount,
          all: allCount
        }}
      />

      {/* Filter Bar & Export CSV */}
      <BookingFilterBar
        branches={branches}
        drivers={drivers}
        userRole={adminUser.role}
      />

      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {bookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
            Tidak ada pesanan yang sesuai dengan filter.
          </div>
        ) : (
          bookings.map((booking) => {
            const hasSuccessfulPayment = booking.payments.some((p) => p.status === 'success')
            const isRefundNeeded = booking.status === 'cancelled' && hasSuccessfulPayment
            const isKycRejected = booking.customer?.verificationStatus === 'rejected'
            const isKycPending = booking.customer?.verificationStatus === 'pending'
            const isDriverUnassigned = booking.rentalType === 'with_driver' && !booking.driverId
            const isOverdueReturn = booking.status === 'ongoing' && new Date(booking.endDate) < now
            const isOverdueHandover = booking.status === 'confirmed' && new Date(booking.startDate) < startOfTodayWib
            const isHandoverToday =
              booking.status === 'confirmed' &&
              new Date(booking.startDate) >= startOfTodayWib &&
              new Date(booking.startDate) <= endOfTodayWib

            return (
              <div
                key={booking.id}
                className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b border-zinc-100 flex justify-between items-start">
                  <div>
                    <div className="font-bold text-zinc-900 uppercase text-base">
                      {booking.id.substring(0, 8)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {formatWibDateTime(booking.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''
                    } ${booking.status === 'ongoing' ? 'bg-emerald-100 text-emerald-800' : ''} ${
                      booking.status === 'completed' ? 'bg-zinc-100 text-zinc-800' : ''
                    } ${booking.status === 'pending_payment' ? 'bg-amber-100 text-amber-800' : ''} ${
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''
                    }`}
                  >
                    {booking.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Warning Flags */}
                {(isRefundNeeded ||
                  isKycRejected ||
                  isKycPending ||
                  isDriverUnassigned ||
                  isOverdueReturn ||
                  isOverdueHandover ||
                  isHandoverToday) && (
                  <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex flex-wrap gap-1.5 text-xs">
                    {isRefundNeeded && (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                        <RotateCcw className="w-3 h-3" /> Perlu Refund
                      </span>
                    )}
                    {isKycRejected && (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                        <AlertTriangle className="w-3 h-3" /> KYC Ditolak — Follow-up
                      </span>
                    )}
                    {isKycPending && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        <Clock className="w-3 h-3" /> KYC Pending
                      </span>
                    )}
                    {isDriverUnassigned && (
                      <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">
                        <User className="w-3 h-3" /> Sopir Belum Ada
                      </span>
                    )}
                    {isOverdueReturn && (
                      <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold animate-pulse">
                        <AlertCircle className="w-3 h-3" /> Terlambat Kembali
                      </span>
                    )}
                    {isOverdueHandover && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        <AlertCircle className="w-3 h-3" /> Terlewat Serah-Terima
                      </span>
                    )}
                    {isHandoverToday && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                        <Clock className="w-3 h-3" /> Serah-Terima Hari Ini
                      </span>
                    )}
                  </div>
                )}

                <div className="p-4 grid grid-cols-2 gap-4 text-sm bg-zinc-50/30">
                  <div>
                    <span className="text-xs text-zinc-500 block mb-1">Pelanggan</span>
                    <div className="font-medium text-zinc-900">{booking.customer.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">{booking.customer.phone}</div>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 block mb-1">Armada & Sopir</span>
                    <div className="font-medium text-zinc-900">{booking.vehicle.plateNumber}</div>
                    <div className="text-xs text-zinc-500">
                      {booking.rentalType === 'with_driver'
                        ? booking.driver
                          ? `Sopir: ${booking.driver.name}`
                          : 'Sopir: Belum Ditugaskan'
                        : 'Lepas Kunci'}
                    </div>
                  </div>
                  <div className="col-span-2 text-xs text-zinc-600 pt-2 border-t border-zinc-100">
                    <div>
                      <span className="font-medium">Periode Sewa:</span> {formatWibDateTime(booking.startDate)} -{' '}
                      {formatWibDateTime(booking.endDate)}
                    </div>
                    <div className="mt-1">
                      <span className="font-medium">Cabang:</span> {booking.pickupBranch.name}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-2">
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50/50 px-4 py-2.5 rounded-md border border-blue-200 transition-colors text-center"
                  >
                    Detail / Tindak Lanjut &rarr;
                  </Link>
                  {booking.status === 'confirmed' && <StartRentalButton bookingId={booking.id} />}
                  {booking.status === 'ongoing' && <EndRentalButton bookingId={booking.id} />}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Table Layout (>= lg) */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-zinc-200">
        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 text-zinc-900 font-medium border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4">ID & Waktu</th>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Armada & Layanan</th>
                <th className="px-6 py-4">Periode Sewa (WIB)</th>
                <th className="px-6 py-4">Status & Indikator</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    Tidak ada pesanan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const hasSuccessfulPayment = booking.payments.some((p) => p.status === 'success')
                  const isRefundNeeded = booking.status === 'cancelled' && hasSuccessfulPayment
                  const isKycRejected = booking.customer?.verificationStatus === 'rejected'
                  const isKycPending = booking.customer?.verificationStatus === 'pending'
                  const isDriverUnassigned = booking.rentalType === 'with_driver' && !booking.driverId
                  const isOverdueReturn = booking.status === 'ongoing' && new Date(booking.endDate) < now
                  const isOverdueHandover = booking.status === 'confirmed' && new Date(booking.startDate) < startOfTodayWib
                  const isHandoverToday =
                    booking.status === 'confirmed' &&
                    new Date(booking.startDate) >= startOfTodayWib &&
                    new Date(booking.startDate) <= endOfTodayWib

                  return (
                    <tr key={booking.id} className="hover:bg-zinc-50 transition-colors">
                      {/* ID & Creation */}
                      <td className="px-6 py-4 align-top">
                        <div className="font-bold text-zinc-900 uppercase">{booking.id.substring(0, 8)}</div>
                        <div className="text-xs text-zinc-400 mt-1">
                          {formatWibDateTime(booking.createdAt)}
                        </div>
                        <div className="text-xs font-medium text-zinc-500 mt-0.5">
                          {booking.pickupBranch?.name}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-zinc-900">{booking.customer.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{booking.customer.phone}</div>
                        <div className="text-xs text-zinc-400 truncate max-w-[180px]">
                          {booking.customer.email}
                        </div>
                      </td>

                      {/* Vehicle & Driver */}
                      <td className="px-6 py-4 align-top">
                        <div className="font-bold text-zinc-900 font-mono">{booking.vehicle.plateNumber}</div>
                        <div className="text-xs text-zinc-500">
                          {booking.vehicle.name || booking.vehicle.category.name}
                        </div>
                        <div className="mt-1 text-xs">
                          {booking.rentalType === 'with_driver' ? (
                            booking.driver ? (
                              <span className="text-zinc-700">Sopir: {booking.driver.name}</span>
                            ) : (
                              <span className="text-orange-600 font-semibold flex items-center gap-1">
                                <User className="w-3 h-3" /> Belum Ada Sopir
                              </span>
                            )
                          ) : (
                            <span className="text-zinc-400">Lepas Kunci</span>
                          )}
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-6 py-4 align-top">
                        <div className="text-xs text-zinc-900 font-medium">
                          {formatWibDateTime(booking.startDate)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          s.d. {formatWibDateTime(booking.endDate)}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">
                          Total: Rp {Number(booking.totalPrice).toLocaleString('id-ID')}
                        </div>
                      </td>

                      {/* Status & Operational Indicators */}
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                              booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''
                            } ${booking.status === 'ongoing' ? 'bg-emerald-100 text-emerald-800' : ''} ${
                              booking.status === 'completed' ? 'bg-zinc-100 text-zinc-800' : ''
                            } ${booking.status === 'pending_payment' ? 'bg-amber-100 text-amber-800' : ''} ${
                              booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''
                            }`}
                          >
                            {booking.status.replace('_', ' ')}
                          </span>

                          {/* Dynamic Operational Action Badges */}
                          {isRefundNeeded && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                              <RotateCcw className="w-3 h-3" /> Perlu Refund
                            </span>
                          )}
                          {isKycRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3" /> KYC Ditolak — Follow-up
                            </span>
                          )}
                          {isKycPending && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3" /> KYC Pending
                            </span>
                          )}
                          {isDriverUnassigned && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800">
                              <User className="w-3 h-3" /> Belum Ditugaskan
                            </span>
                          )}
                          {isOverdueReturn && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 animate-pulse">
                              <AlertCircle className="w-3 h-3" /> Terlambat Kembali
                            </span>
                          )}
                          {isOverdueHandover && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              <AlertCircle className="w-3 h-3" /> Terlewat Serah-Terima
                            </span>
                          )}
                          {isHandoverToday && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
                              <Clock className="w-3 h-3" /> Siap Hari Ini
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex flex-col items-end gap-2">
                          <Link
                            href={`/admin/bookings/${booking.id}`}
                            className="inline-flex items-center justify-center text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 min-h-[36px] min-w-[130px] rounded border border-blue-200 transition-colors"
                          >
                            Detail / Tindak Lanjut &rarr;
                          </Link>
                          {booking.status === 'confirmed' && <StartRentalButton bookingId={booking.id} />}
                          {booking.status === 'ongoing' && <EndRentalButton bookingId={booking.id} />}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Server-Side Pagination */}
      <BookingPagination
        page={page}
        pageSize={pageSize}
        totalCount={totalFilteredCount}
      />
    </div>
  )
}
