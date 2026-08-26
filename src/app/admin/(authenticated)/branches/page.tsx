import { redirect } from 'next/navigation'
import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { BranchFilterBar, CreateBranchButton, BranchRowActions } from './ClientActions'
import { Building2, Clock, Car, Users, UserCheck, CalendarRange } from 'lucide-react'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function AdminBranchesPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; showInactive?: string }>
}) {
  const adminUser = await requireAdminSession()

  // Strict role guard: only admin_pusat can access branch management
  if (adminUser.role !== 'admin_pusat') {
    redirect('/admin/dashboard')
  }

  const resolvedSearchParams = await searchParams

  const where: Prisma.BranchWhereInput = {}

  if (resolvedSearchParams.q) {
    const rawQ = resolvedSearchParams.q.trim()
    where.OR = [
      { name: { contains: rawQ, mode: 'insensitive' } },
      { city: { contains: rawQ, mode: 'insensitive' } },
      { address: { contains: rawQ, mode: 'insensitive' } },
      { phone: { contains: rawQ } }
    ]
  }

  if (resolvedSearchParams.showInactive !== 'true') {
    where.isActive = true
  }

  const rawBranches = await prisma.branch.findMany({
    where,
    include: {
      _count: {
        select: {
          vehicles: { where: { isActive: true } },
          drivers: { where: { isActive: true } },
          users: true,
          pickups: { where: { status: { in: ['pending_payment', 'confirmed', 'ongoing'] } } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const branches = JSON.parse(JSON.stringify(rawBranches)) as typeof rawBranches

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Manajemen Cabang</h1>
          <p className="text-sm text-zinc-500 mt-1">Kelola jaringan cabang, lokasi operasional, dan kapasitas armada perusahaan.</p>
        </div>
        <CreateBranchButton />
      </div>

      <BranchFilterBar />

      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {branches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
            Belum ada cabang terdaftar.
          </div>
        ) : branches.map((branch) => (
          <div key={branch.id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-zinc-100 p-2 rounded-full">
                  <Building2 className="w-5 h-5 text-zinc-600" />
                </div>
                <div>
                  <span className="font-bold text-zinc-900 text-lg block">{branch.name}</span>
                  <span className="text-xs text-zinc-500 font-medium">{branch.city}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  branch.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {branch.isActive ? 'AKTIF' : 'NONAKTIF'}
                </span>
                <BranchRowActions branch={branch} />
              </div>
            </div>

            <div className="p-4 space-y-3 bg-zinc-50/50 text-sm">
              <div>
                <span className="text-xs text-zinc-500 block">Alamat & Kontak</span>
                <p className="text-zinc-800 text-xs mt-0.5">{branch.address}</p>
                <p className="text-zinc-600 text-xs font-mono mt-0.5">{branch.phone}</p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-white p-2 rounded border border-zinc-200">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Jam Buka: <strong>{branch.openTime || '08:00'} - {branch.closeTime || '21:00'}</strong></span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-200 text-center">
                <div className="bg-white p-2 rounded border border-zinc-200">
                  <span className="text-[11px] text-zinc-500 block">Armada</span>
                  <span className="font-bold text-zinc-900">{branch._count.vehicles}</span>
                </div>
                <div className="bg-white p-2 rounded border border-zinc-200">
                  <span className="text-[11px] text-zinc-500 block">Sopir</span>
                  <span className="font-bold text-zinc-900">{branch._count.drivers}</span>
                </div>
                <div className="bg-white p-2 rounded border border-zinc-200">
                  <span className="text-[11px] text-zinc-500 block">Staf</span>
                  <span className="font-bold text-zinc-900">{branch._count.users}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Layout (>= lg) */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-zinc-200">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 text-zinc-900 font-medium border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4">Nama Cabang & Kota</th>
                <th className="px-6 py-4">Alamat & Kontak</th>
                <th className="px-6 py-4">Jam Operasional</th>
                <th className="px-6 py-4">Kapasitas Operasional</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    Belum ada cabang terdaftar.
                  </td>
                </tr>
              ) : branches.map((branch) => (
                <tr key={branch.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-zinc-100 p-2.5 rounded-full flex-shrink-0">
                        <Building2 className="w-5 h-5 text-zinc-600" />
                      </div>
                      <div>
                        <span className="font-bold text-zinc-900 block text-base">{branch.name}</span>
                        <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded inline-block mt-0.5">
                          {branch.city}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <p className="text-zinc-800 line-clamp-2 text-xs">{branch.address}</p>
                      <p className="text-zinc-500 font-mono text-xs mt-1">{branch.phone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-zinc-700 font-medium text-xs">
                      <Clock className="w-4 h-4 text-zinc-400" />
                      <span>{branch.openTime || '08:00'} - {branch.closeTime || '21:00'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5" title="Armada Mobil Aktif">
                        <Car className="w-4 h-4 text-zinc-400" />
                        <span className="font-semibold text-zinc-900">{branch._count.vehicles}</span>
                        <span className="text-zinc-500">Mobil</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Sopir Aktif">
                        <Users className="w-4 h-4 text-zinc-400" />
                        <span className="font-semibold text-zinc-900">{branch._count.drivers}</span>
                        <span className="text-zinc-500">Sopir</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Staf Terdaftar">
                        <UserCheck className="w-4 h-4 text-zinc-400" />
                        <span className="font-semibold text-zinc-900">{branch._count.users}</span>
                        <span className="text-zinc-500">Staf</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                      branch.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {branch.isActive ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <BranchRowActions branch={branch} />
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
