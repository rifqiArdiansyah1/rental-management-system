import { requireAdminSession } from '@/actions/admin'
import { prisma } from '@/utils/prisma'
import Link from 'next/link'
import { StartRentalButton, EndRentalButton } from './BookingActions'
import { getStaffScope, buildScopeWhere } from '@/lib/auth/scope'

export default async function AdminBookingsPage() {
  const scope = await getStaffScope()
  
  // Scope bookings to the user's branch (pickupBranch) if they are not admin_pusat
  const branchScope = buildScopeWhere(scope, 'pickupBranchId')

  const bookings = await prisma.booking.findMany({
    where: {
      ...branchScope,
      // Only show relevant bookings in the admin dashboard (exclude pending_payment usually, but let's show all for completeness, sorted by date)
    },
    include: {
      customer: true,
      vehicle: { include: { category: true } },
      driver: true,
      pickupBranch: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-zinc-900 mb-6">Manajemen Pesanan</h1>

      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {bookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
            Belum ada data pesanan.
          </div>
        ) : bookings.map((booking) => (
          <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-start">
              <div>
                <div className="font-bold text-zinc-900 uppercase text-lg">{booking.id.substring(0, 8)}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {booking.startDate.toLocaleDateString('id-ID')} - {booking.endDate.toLocaleDateString('id-ID')}
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                ${booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''}
                ${booking.status === 'ongoing' ? 'bg-emerald-100 text-emerald-800' : ''}
                ${booking.status === 'completed' ? 'bg-zinc-100 text-zinc-800' : ''}
                ${booking.status === 'pending_payment' ? 'bg-amber-100 text-amber-800' : ''}
                ${booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
              `}>
                {booking.status.replace('_', ' ')}
              </span>
            </div>
            
            <div className="p-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Pelanggan</span>
                <div className="font-medium text-zinc-900">{booking.customer.name}</div>
                <div className="text-xs text-zinc-500">{booking.customer.phone}</div>
                <div className="mt-1 text-xs">
                  KYC: {booking.customer.verificationStatus === 'verified' 
                    ? <span className="text-emerald-600 font-medium">Verified</span> 
                    : <span className="text-amber-600">Pending</span>}
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Armada</span>
                <div className="font-medium text-zinc-900">{booking.vehicle.plateNumber}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {booking.rentalType === 'with_driver' 
                    ? (booking.driver ? `Sopir: ${booking.driver.name}` : <span className="text-amber-600 font-medium">Sopir: Unassigned</span>)
                    : 'Self Drive'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-2">
              <Link href={`/admin/bookings/${booking.id}`} className="flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50/50 px-4 py-3 min-h-[44px] rounded-md border border-blue-200 transition-colors">
                Detail / Verifikasi
              </Link>
              {booking.status === 'confirmed' && (
                <StartRentalButton bookingId={booking.id} />
              )}
              {booking.status === 'ongoing' && (
                <EndRentalButton bookingId={booking.id} />
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Desktop Table Layout (>= lg) */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 text-zinc-900 font-medium border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4">ID & Tanggal</th>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Armada & Sopir</th>
                <th className="px-6 py-4">Status & KYC</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Belum ada data pesanan.
                  </td>
                </tr>
              ) : bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-zinc-900 uppercase">{booking.id.substring(0, 8)}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {booking.startDate.toLocaleDateString('id-ID')} - {booking.endDate.toLocaleDateString('id-ID')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-zinc-900">{booking.customer.name}</div>
                    <div className="text-xs text-zinc-500 mt-1">{booking.customer.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-zinc-900">{booking.vehicle.plateNumber}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {booking.rentalType === 'with_driver' 
                        ? (booking.driver ? `Sopir: ${booking.driver.name}` : <span className="text-amber-600 font-medium">Sopir: Unassigned</span>)
                        : 'Self Drive'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex w-max items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''}
                        ${booking.status === 'ongoing' ? 'bg-emerald-100 text-emerald-800' : ''}
                        ${booking.status === 'completed' ? 'bg-zinc-100 text-zinc-800' : ''}
                        ${booking.status === 'pending_payment' ? 'bg-amber-100 text-amber-800' : ''}
                        ${booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
                      `}>
                        {booking.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-zinc-500">
                        KYC: {booking.customer.verificationStatus === 'verified' 
                          ? <span className="text-emerald-600 font-medium">Verified</span> 
                          : <span className="text-amber-600">Pending</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 flex flex-col items-end gap-2">
                    <Link href={`/admin/bookings/${booking.id}`} className="flex items-center justify-center text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 min-h-[36px] min-w-[120px] rounded border border-blue-200 w-full text-center transition-colors">
                      Detail / Verifikasi
                    </Link>
                    {booking.status === 'confirmed' && (
                      <StartRentalButton bookingId={booking.id} />
                    )}
                    {booking.status === 'ongoing' && (
                      <EndRentalButton bookingId={booking.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
