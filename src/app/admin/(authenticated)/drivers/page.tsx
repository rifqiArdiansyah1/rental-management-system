import { prisma } from '@/utils/prisma'
import { getStaffScope, buildScopeWhere } from '@/lib/auth/scope'
import { requireAdminSession } from '@/actions/admin'
import { DriverFilterBar, CreateDriverButton, DriverRowActions } from './ClientActions'
import { UserCircle2, Calendar } from 'lucide-react'
import { Prisma } from '@prisma/client'

export default async function AdminDriversPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; branch?: string; status?: string; showInactive?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const adminUser = await requireAdminSession()
  const scope = await getStaffScope()
  
  const branchScope = buildScopeWhere(scope, 'branchId')

  const where: Prisma.DriverWhereInput = {
    ...branchScope
  }

  // Filter: Search Query (name OR licenseNumber)
  if (resolvedSearchParams.q) {
    const rawQ = resolvedSearchParams.q.trim()
    where.OR = [
      { name: { contains: rawQ, mode: 'insensitive' } },
      { licenseNumber: { contains: rawQ.toUpperCase(), mode: 'insensitive' } },
      { phone: { contains: rawQ } }
    ]
  }

  // Filter: Status (available, on_trip, off_duty)
  if (resolvedSearchParams.status && resolvedSearchParams.status !== 'all') {
    where.status = resolvedSearchParams.status as any
  }

  // Filter: Branch (admin_pusat only)
  if (resolvedSearchParams.branch && resolvedSearchParams.branch !== 'all') {
    if (scope.scope === 'all') {
      where.branchId = resolvedSearchParams.branch
    }
  }

  // Filter: isActive (default true)
  if (resolvedSearchParams.showInactive !== 'true') {
    where.isActive = true
  }

  const now = new Date()

  const rawDrivers = await prisma.driver.findMany({
    where,
    include: {
      branch: true,
      leaves: {
        where: {
          endDate: { gte: now }
        },
        orderBy: { startDate: 'asc' },
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const drivers = JSON.parse(JSON.stringify(rawDrivers)) as typeof rawDrivers
  const rawBranches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  const branches = JSON.parse(JSON.stringify(rawBranches)) as typeof rawBranches

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Manajemen Sopir</h1>
          <p className="text-sm text-zinc-500 mt-1">Kelola data armada sopir, tarif penugasan, dan jadwal cuti terencana.</p>
        </div>
        <CreateDriverButton branches={branches} userRole={adminUser.role} />
      </div>

      <DriverFilterBar branches={branches} userRole={adminUser.role} />
      
      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {drivers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
            Belum ada data sopir terdaftar.
          </div>
        ) : drivers.map((driver) => {
          const upcomingLeave = driver.leaves && driver.leaves.length > 0 ? driver.leaves[0] : null
          const isCurrentlyOnLeave = upcomingLeave 
            ? (new Date(upcomingLeave.startDate) <= now && new Date(upcomingLeave.endDate) >= now) 
            : false

          return (
            <div key={driver.id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-100 p-2 rounded-full">
                    <UserCircle2 className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 text-lg block">{driver.name}</span>
                    <span className="font-mono text-zinc-500 text-xs">{driver.licenseNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!driver.isActive ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800">
                      NONAKTIF
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                      ${driver.status === 'available' ? 'bg-emerald-100 text-emerald-800' : ''}
                      ${driver.status === 'on_trip' ? 'bg-blue-100 text-blue-800' : ''}
                      ${driver.status === 'off_duty' ? 'bg-zinc-100 text-zinc-800' : ''}
                    `}>
                      {driver.status.toUpperCase().replace('_', ' ')}
                    </span>
                  )}
                  <DriverRowActions driver={driver} branches={branches} userRole={adminUser.role} />
                </div>
              </div>
              
              <div className="p-4 grid grid-cols-2 gap-4 text-sm bg-zinc-50/50">
                <div>
                  <span className="text-xs text-zinc-500 block mb-1">Kontak & Cabang</span>
                  <div className="font-medium text-zinc-900">{driver.phone}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{driver.branch.name}</div>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 block mb-1">Tarif Harian</span>
                  <div className="font-semibold text-emerald-700">Rp {Number(driver.dailyFee).toLocaleString('id-ID')}</div>
                  
                  {upcomingLeave && (
                    <div className={`mt-2 text-[11px] px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                      isCurrentlyOnLeave ? 'bg-amber-100 text-amber-800 font-semibold' : 'bg-blue-50 text-blue-700'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      <span>
                        {isCurrentlyOnLeave ? 'Sedang Cuti' : 'Cuti: ' + new Date(upcomingLeave.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop Table Layout (>= lg) */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 text-zinc-900 font-medium border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4">Nama Sopir</th>
                <th className="px-6 py-4">Nomor SIM</th>
                <th className="px-6 py-4">Kontak Telepon</th>
                {adminUser.role === 'admin_pusat' && <th className="px-6 py-4">Lokasi Cabang</th>}
                <th className="px-6 py-4">Tarif Harian</th>
                <th className="px-6 py-4">Status & Jadwal Cuti</th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={adminUser.role === 'admin_pusat' ? 7 : 6} className="px-6 py-8 text-center text-zinc-500">
                    Belum ada data sopir terdaftar.
                  </td>
                </tr>
              ) : drivers.map((driver) => {
                const upcomingLeave = driver.leaves && driver.leaves.length > 0 ? driver.leaves[0] : null
                const isCurrentlyOnLeave = upcomingLeave 
                  ? (new Date(upcomingLeave.startDate) <= now && new Date(upcomingLeave.endDate) >= now) 
                  : false

                return (
                  <tr key={driver.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-zinc-100 p-2 rounded-full flex-shrink-0">
                          <UserCircle2 className="w-5 h-5 text-zinc-500" />
                        </div>
                        <span className="font-bold text-zinc-900">{driver.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-zinc-800">
                      {driver.licenseNumber}
                    </td>
                    <td className="px-6 py-4">
                      {driver.phone}
                    </td>
                    {adminUser.role === 'admin_pusat' && (
                      <td className="px-6 py-4">
                        {driver.branch.name}
                      </td>
                    )}
                    <td className="px-6 py-4 font-medium text-emerald-700">
                      Rp {Number(driver.dailyFee).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {!driver.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            NONAKTIF
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${driver.status === 'available' ? 'bg-emerald-100 text-emerald-800' : ''}
                            ${driver.status === 'on_trip' ? 'bg-blue-100 text-blue-800' : ''}
                            ${driver.status === 'off_duty' ? 'bg-zinc-100 text-zinc-800' : ''}
                          `}>
                            {driver.status.toUpperCase().replace('_', ' ')}
                          </span>
                        )}

                        {upcomingLeave && (
                          <div className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1.5 ${
                            isCurrentlyOnLeave 
                              ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold' 
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                            <Calendar className="w-3 h-3" />
                            <span>
                              {isCurrentlyOnLeave 
                                ? 'Sedang Cuti s/d ' + new Date(upcomingLeave.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                                : 'Cuti: ' + new Date(upcomingLeave.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' - ' + new Date(upcomingLeave.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <DriverRowActions driver={driver} branches={branches} userRole={adminUser.role} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
