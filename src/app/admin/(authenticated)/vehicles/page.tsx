import { requireAdminSession } from '@/actions/admin'
import { prisma } from '@/utils/prisma'

export default async function AdminVehiclesPage() {
  const user = await requireAdminSession()
  
  // Scope vehicles to the user's branch if they are not admin_pusat
  const branchScope = user.branchId ? { branchId: user.branchId } : {}

  const vehicles = await prisma.vehicle.findMany({
    where: branchScope,
    include: {
      category: true,
      branch: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-zinc-900 mb-6">Ketersediaan Armada</h1>
      
      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {vehicles.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
            Belum ada armada terdaftar.
          </div>
        ) : vehicles.map((vehicle) => (
          <div key={vehicle.id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
              <div className="font-bold text-zinc-900 uppercase text-lg">{vehicle.plateNumber}</div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                ${vehicle.status === 'available' ? 'bg-emerald-100 text-emerald-800' : ''}
                ${vehicle.status === 'rented' ? 'bg-blue-100 text-blue-800' : ''}
                ${vehicle.status === 'maintenance' ? 'bg-amber-100 text-amber-800' : ''}
                ${vehicle.status === 'moved' ? 'bg-zinc-100 text-zinc-800' : ''}
              `}>
                {vehicle.status.toUpperCase()}
              </span>
            </div>
            
            <div className="p-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Kategori Kendaraan</span>
                <div className="font-medium text-zinc-900">{vehicle.category.name}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {vehicle.category.capacity} Kursi • {vehicle.category.transmission}
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Lokasi Cabang</span>
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
                <th className="px-6 py-4">Lokasi Cabang</th>
                <th className="px-6 py-4">Status Saat Ini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    Belum ada armada terdaftar.
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
                      Kapasitas: {vehicle.category.capacity} Kursi • {vehicle.category.transmission}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {vehicle.branch.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${vehicle.status === 'available' ? 'bg-emerald-100 text-emerald-800' : ''}
                      ${vehicle.status === 'rented' ? 'bg-blue-100 text-blue-800' : ''}
                      ${vehicle.status === 'maintenance' ? 'bg-amber-100 text-amber-800' : ''}
                      ${vehicle.status === 'moved' ? 'bg-zinc-100 text-zinc-800' : ''}
                    `}>
                      {vehicle.status.toUpperCase()}
                    </span>
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
