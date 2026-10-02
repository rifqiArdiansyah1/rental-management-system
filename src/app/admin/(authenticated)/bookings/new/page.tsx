export const dynamic = 'force-dynamic'

import { requireAdminSession } from '@/actions/admin'
import { getStaffScope } from '@/lib/auth/scope'
import { prisma } from '@/utils/prisma'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import WalkInBookingForm from './WalkInBookingForm'

export default async function NewWalkInBookingPage() {
  const adminUser = await requireAdminSession()
  const scope = await getStaffScope()

  // 1. Ambil data cabang aktif sesuai wewenang
  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
      ...(scope.scope === 'branch' ? { id: scope.branchId } : {})
    },
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
      phone: true
    },
    orderBy: { name: 'asc' }
  })

  // 2. Ambil data kendaraan yang aktif & berstatus available
  const vehicles = await prisma.vehicle.findMany({
    where: {
      isActive: true,
      status: 'available',
      ...(scope.scope === 'branch' ? { branchId: scope.branchId } : {})
    },
    select: {
      id: true,
      name: true,
      plateNumber: true,
      dailyRate: true,
      branchId: true,
      category: {
        select: {
          name: true
        }
      }
    },
    orderBy: { name: 'asc' }
  })

  // Serialisasi data Decimal agar aman dikirim ke Client Component
  const serializedVehicles = vehicles.map((v) => ({
    id: v.id,
    name: v.name,
    plateNumber: v.plateNumber,
    dailyRate: Number(v.dailyRate),
    branchId: v.branchId,
    category: {
      name: v.category.name
    }
  }))

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header & Back Link */}
      <div className="mb-6">
        <Link
          href="/admin/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Kembali ke Antrian Pesanan
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900">
          Pemesanan Offline (Walk-In) & Kasir
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Layanan pembuatan pesanan langsung di tempat untuk pelanggan walk-in dengan pembayaran tunai di meja resepsionis.
        </p>
      </div>

      {/* Form Container */}
      <WalkInBookingForm
        branches={branches}
        vehicles={serializedVehicles}
        userRole={adminUser.role}
        staffBranchId={adminUser.branchId}
      />
    </div>
  )
}
