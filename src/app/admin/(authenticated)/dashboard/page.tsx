import { requireAdminSession } from '@/actions/admin'
import { prisma } from '@/utils/prisma'
import { Car, CalendarCheck, CalendarClock } from 'lucide-react'

export default async function AdminDashboardPage() {
  const user = await requireAdminSession()
  const branchScope = user.branchId ? { branchId: user.branchId } : {}
  const pickupBranchScope = user.branchId ? { pickupBranchId: user.branchId } : {}

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

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-zinc-900 mb-2">Dashboard</h1>
      <p className="text-zinc-500 mb-8">
        {user.branchId 
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
    </div>
  )
}
