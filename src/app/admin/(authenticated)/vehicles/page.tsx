import { prisma } from '@/utils/prisma'
import { getStaffScope, buildScopeWhere } from '@/lib/auth/scope'
import { requireAdminSession } from '@/actions/admin'
import { VehicleFilterBar, CreateVehicleButton, VehicleRowActions } from './ClientActions'
import { Prisma } from '@prisma/client'

export default async function AdminVehiclesPage({
  searchParams
}: {
  searchParams: { q?: string; category?: string; branch?: string; showInactive?: string }
}) {
  const adminUser = await requireAdminSession()
  const scope = await getStaffScope()
  
  // Base scope based on auth
  const branchScope = buildScopeWhere(scope, 'branchId')
  
  // Construct Prisma where clause
  const where: Prisma.VehicleWhereInput = {
    ...branchScope
  }

  // Filter: Search Query (plateNumber)
  if (searchParams.q) {
    where.plateNumber = { contains: searchParams.q.replace(/\s+/g, ''), mode: 'insensitive' }
  }

  // Filter: Category
  if (searchParams.category && searchParams.category !== 'all') {
    where.categoryId = searchParams.category
  }

  // Filter: Branch
  if (searchParams.branch && searchParams.branch !== 'all') {
    // Only allow overriding branchId if user is admin_pusat (scope === 'all')
    if (scope.scope === 'all') {
      where.branchId = searchParams.branch
    }
  }

  // Filter: isActive (default to true, unless showInactive is 'true')
  if (searchParams.showInactive !== 'true') {
    where.isActive = true
  }

  const rawVehicles = await prisma.vehicle.findMany({
    where,
    include: {
      category: true,
      branch: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  const vehicles = JSON.parse(JSON.stringify(rawVehicles)) as typeof rawVehicles

  // Get options for filters and forms
  const rawCategories = await prisma.vehicleCategory.findMany({ orderBy: { name: 'asc' } })
  const rawBranches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })

  const categories = JSON.parse(JSON.stringify(rawCategories)) as typeof rawCategories
  const branches = JSON.parse(JSON.stringify(rawBranches)) as typeof rawBranches

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-zinc-900">Manajemen Armada</h1>
        <CreateVehicleButton branches={branches} categories={categories} userRole={adminUser.role} />
      </div>
      
      <VehicleFilterBar branches={branches} categories={categories} userRole={adminUser.role} />

      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {vehicles.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
            Kendaraan tidak ditemukan.
          </div>
        ) : vehicles.map((vehicle) => (
          <div key={vehicle.id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
              <div className="font-bold text-zinc-900 uppercase text-lg">{vehicle.plateNumber}</div>
              <div className="flex items-center gap-2">
                {!vehicle.isActive ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
                    NONAKTIF
                  </span>
                ) : (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                    ${vehicle.status === 'available' ? 'bg-emerald-100 text-emerald-800' : ''}
                    ${vehicle.status === 'rented' ? 'bg-blue-100 text-blue-800' : ''}
                    ${vehicle.status === 'maintenance' ? 'bg-amber-100 text-amber-800' : ''}
                    ${vehicle.status === 'moved' ? 'bg-zinc-100 text-zinc-800' : ''}
                  `}>
                    {vehicle.status.toUpperCase()}
                  </span>
                )}
                <VehicleRowActions vehicle={vehicle} categories={categories} branches={branches} userRole={adminUser.role} />
              </div>
            </div>
            
            <div className="p-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Kategori</span>
                <div className="font-medium text-zinc-900">{vehicle.category.name}</div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Cabang</span>
                <div className="font-medium text-zinc-900">{vehicle.branch.name}</div>
              </div>
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
                <th className="px-6 py-4">Plat Nomor</th>
                <th className="px-6 py-4">Kategori Kendaraan</th>
                {adminUser.role === 'admin_pusat' && <th className="px-6 py-4">Lokasi Cabang</th>}
                <th className="px-6 py-4">Status Saat Ini</th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={adminUser.role === 'admin_pusat' ? 5 : 4} className="px-6 py-8 text-center text-zinc-500">
                    Kendaraan tidak ditemukan.
                  </td>
                </tr>
              ) : vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-900 uppercase">
                    {vehicle.plateNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-zinc-900">{vehicle.category.name}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {vehicle.category.capacity} Kursi • {vehicle.category.transmission}
                    </div>
                  </td>
                  {adminUser.role === 'admin_pusat' && (
                    <td className="px-6 py-4">
                      {vehicle.branch.name}
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {!vehicle.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        NONAKTIF
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${vehicle.status === 'available' ? 'bg-emerald-100 text-emerald-800' : ''}
                        ${vehicle.status === 'rented' ? 'bg-blue-100 text-blue-800' : ''}
                        ${vehicle.status === 'maintenance' ? 'bg-amber-100 text-amber-800' : ''}
                        ${vehicle.status === 'moved' ? 'bg-zinc-100 text-zinc-800' : ''}
                      `}>
                        {vehicle.status.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <VehicleRowActions vehicle={vehicle} categories={categories} branches={branches} userRole={adminUser.role} />
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
