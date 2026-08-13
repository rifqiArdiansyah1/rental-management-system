import { requireAdminSession } from '@/actions/admin'
import { prisma } from '@/utils/prisma'
import { UserCircle2 } from 'lucide-react'

export default async function AdminDriversPage() {
  const user = await requireAdminSession()
  
  const branchScope = user.branchId ? { branchId: user.branchId } : {}

  const drivers = await prisma.driver.findMany({
    where: branchScope,
    include: {
      branch: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-zinc-900 mb-6">Manajemen Sopir</h1>
      
      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {drivers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
            Belum ada data sopir terdaftar.
          </div>
        ) : drivers.map((driver) => (
          <div key={driver.id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-zinc-100 p-2 rounded-full">
                  <UserCircle2 className="w-5 h-5 text-zinc-500" />
                </div>
                <span className="font-bold text-zinc-900 text-lg">{driver.name}</span>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                ${driver.status === 'available' ? 'bg-emerald-100 text-emerald-800' : ''}
                ${driver.status === 'on_trip' ? 'bg-blue-100 text-blue-800' : ''}
                ${driver.status === 'off_duty' ? 'bg-zinc-100 text-zinc-800' : ''}
              `}>
                {driver.status.toUpperCase().replace('_', ' ')}
              </span>
            </div>
            
            <div className="p-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Nomor SIM</span>
                <div className="font-mono text-zinc-900 text-xs">{driver.licenseNumber}</div>
                <div className="mt-3">
                  <span className="text-xs text-zinc-500 block mb-1">Kontak</span>
                  <div className="font-medium text-zinc-900">{driver.phone}</div>
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block mb-1">Lokasi Cabang</span>
                <div className="font-medium text-zinc-900">{driver.branch.name}</div>
                <div className="mt-3">
                  <span className="text-xs text-zinc-500 block mb-1">Tarif Harian</span>
                  <div className="font-medium text-emerald-700">Rp {Number(driver.dailyFee).toLocaleString('id-ID')}</div>
                </div>
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
                <th className="px-6 py-4">Nama Sopir</th>
                <th className="px-6 py-4">Nomor SIM</th>
                <th className="px-6 py-4">Kontak</th>
                <th className="px-6 py-4">Lokasi Cabang</th>
                <th className="px-6 py-4">Tarif Harian</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    Belum ada data sopir terdaftar.
                  </td>
                </tr>
              ) : drivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-zinc-100 p-2 rounded-full">
                        <UserCircle2 className="w-5 h-5 text-zinc-500" />
                      </div>
                      <span className="font-medium text-zinc-900">{driver.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {driver.licenseNumber}
                  </td>
                  <td className="px-6 py-4">
                    {driver.phone}
                  </td>
                  <td className="px-6 py-4">
                    {driver.branch.name}
                  </td>
                  <td className="px-6 py-4">
                    Rp {Number(driver.dailyFee).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${driver.status === 'available' ? 'bg-emerald-100 text-emerald-800' : ''}
                      ${driver.status === 'on_trip' ? 'bg-blue-100 text-blue-800' : ''}
                      ${driver.status === 'off_duty' ? 'bg-zinc-100 text-zinc-800' : ''}
                    `}>
                      {driver.status.toUpperCase().replace('_', ' ')}
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
