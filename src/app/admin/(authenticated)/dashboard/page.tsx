import { prisma } from '@/utils/prisma'
import { getStaffScope, buildScopeWhere } from '@/lib/auth/scope'
import { Car, CalendarCheck, CalendarClock } from 'lucide-react'

export default async function AdminDashboardPage() {
  const scope = await getStaffScope()
  const branchScope = buildScopeWhere(scope, 'branchId')
  const pickupBranchScope = buildScopeWhere(scope, 'pickupBranchId')

  // 1. Total Kendaraan
  const totalVehicles = await prisma.vehicle.count({
    where: branchScope
  })

  const availableVehicles = await prisma.vehicle.count({
    where: { ...branchScope, status: 'available' }
  })

  // 2. Total Booking Aktif (Confirmed & Ongoing)
  const activeBookings = await prisma.booking.count({
    where: {
      ...pickupBranchScope,
      status: { in: ['confirmed', 'ongoing'] }
    }
  })

  // 3. Menunggu Pembayaran
  const pendingBookings = await prisma.booking.count({
    where: {
      ...pickupBranchScope,
      status: 'pending_payment'
    }
  })

  let branchBreakdowns: any[] = []
  if (scope.scope === 'all') {
    // Breakdown for admin_pusat
    const branches = await prisma.branch.findMany()
    const vehiclesByBranch = await prisma.vehicle.groupBy({
      by: ['branchId'],
      _count: { id: true }
    })
    const activeBookingsByBranch = await prisma.booking.groupBy({
      by: ['pickupBranchId'],
      where: { status: { in: ['confirmed', 'ongoing'] } },
      _count: { id: true }
    })
    const pendingBookingsByBranch = await prisma.booking.groupBy({
      by: ['pickupBranchId'],
      where: { status: 'pending_payment' },
      _count: { id: true }
    })

    branchBreakdowns = branches.map(branch => ({
      name: branch.name,
      vehicles: vehiclesByBranch.find(v => v.branchId === branch.id)?._count.id || 0,
      activeBookings: activeBookingsByBranch.find(b => b.pickupBranchId === branch.id)?._count.id || 0,
      pendingBookings: pendingBookingsByBranch.find(b => b.pickupBranchId === branch.id)?._count.id || 0,
    }))
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-zinc-900 mb-2">Dashboard</h1>
      <p className="text-zinc-500 mb-8">
        {scope.scope === 'branch' 
          ? `Menampilkan statistik untuk cabang Anda.` 
          : `Menampilkan statistik keseluruhan semua cabang.`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Active Bookings */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Pesanan Aktif</p>
              <h3 className="text-3xl font-bold text-zinc-900 mt-2">{activeBookings}</h3>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
              <CalendarCheck className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 mt-4">Pesanan berstatus <b>Confirmed</b> atau <b>Ongoing</b>.</p>
        </div>

        {/* Card 2: Pending Bookings */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Menunggu Pembayaran</p>
              <h3 className="text-3xl font-bold text-zinc-900 mt-2">{pendingBookings}</h3>
            </div>
            <div className="bg-amber-100 p-3 rounded-lg text-amber-600">
              <CalendarClock className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 mt-4">Pemesanan belum dilunasi.</p>
        </div>

        {/* Card 3: Vehicles */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Armada Tersedia</p>
              <h3 className="text-3xl font-bold text-zinc-900 mt-2">
                {availableVehicles} <span className="text-lg text-zinc-400 font-normal">/ {totalVehicles}</span>
              </h3>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
              <Car className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 mt-4">Jumlah unit yang berstatus <b>Available</b>.</p>
        </div>

      </div>

      {scope.scope === 'all' && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6 border-b border-zinc-200 bg-zinc-50">
            <h3 className="text-lg font-bold text-zinc-900">Rincian Per Cabang</h3>
            <p className="text-sm text-zinc-500">Rekapitulasi beban kerja dan utilisasi di setiap cabang operasional.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-zinc-50 text-zinc-900 font-medium border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-4">Cabang</th>
                  <th className="px-6 py-4">Total Armada</th>
                  <th className="px-6 py-4">Pesanan Aktif</th>
                  <th className="px-6 py-4">Menunggu Pembayaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {branchBreakdowns.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                      Belum ada data cabang.
                    </td>
                  </tr>
                ) : branchBreakdowns.map((branch, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-zinc-900">{branch.name}</td>
                    <td className="px-6 py-4">{branch.vehicles} unit</td>
                    <td className="px-6 py-4">{branch.activeBookings} pesanan</td>
                    <td className="px-6 py-4">{branch.pendingBookings} pesanan</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
