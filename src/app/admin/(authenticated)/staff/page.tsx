import { redirect } from 'next/navigation'
import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { StaffFilterBar, CreateStaffButton, StaffRowActions } from './ClientActions'
import { UserCog, Building2, Mail, ShieldCheck, ShieldAlert, UserCheck } from 'lucide-react'
import { Prisma, UserRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function AdminStaffPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; role?: string; branchId?: string; showInactive?: string }>
}) {
  const adminUser = await requireAdminSession()

  // Strict role guard: only admin_pusat and admin_cabang can access staff management
  if (adminUser.role === 'staff_cabang') {
    redirect('/admin/dashboard')
  }

  const resolvedSearchParams = await searchParams

  const where: Prisma.UserWhereInput = {}

  // Scoping check
  if (adminUser.role === 'admin_cabang') {
    where.branchId = adminUser.branchId
    where.role = 'staff_cabang'
  } else if (adminUser.role === 'admin_pusat') {
    if (resolvedSearchParams.branchId && resolvedSearchParams.branchId !== 'all') {
      where.branchId = resolvedSearchParams.branchId
    }
    if (resolvedSearchParams.role && resolvedSearchParams.role !== 'all') {
      where.role = resolvedSearchParams.role as UserRole
    }
  }

  if (resolvedSearchParams.q) {
    const rawQ = resolvedSearchParams.q.trim()
    where.OR = [
      { name: { contains: rawQ, mode: 'insensitive' } },
      { email: { contains: rawQ, mode: 'insensitive' } }
    ]
  }

  if (resolvedSearchParams.showInactive !== 'true') {
    where.isActive = true
  }

  const rawStaff = await prisma.user.findMany({
    where,
    include: { branch: true },
    orderBy: [
      { role: 'asc' },
      { createdAt: 'desc' }
    ]
  })

  const rawBranches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, city: true },
    orderBy: { name: 'asc' }
  })

  const staffList = JSON.parse(JSON.stringify(rawStaff)) as typeof rawStaff
  const branches = JSON.parse(JSON.stringify(rawBranches)) as typeof rawBranches

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin_pusat':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            Admin Pusat
          </span>
        )
      case 'admin_cabang':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <ShieldAlert className="w-3 h-3 text-blue-600" />
            Admin Cabang
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
            <UserCheck className="w-3 h-3 text-zinc-500" />
            Staf Cabang
          </span>
        )
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Manajemen Staf</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {adminUser.role === 'admin_pusat'
              ? 'Kelola akun staf, admin cabang, dan wewenang pengguna internal di seluruh cabang.'
              : 'Kelola akun staf operasional pada cabang Anda.'}
          </p>
        </div>
        <CreateStaffButton
          branches={branches}
          userRole={adminUser.role}
          currentBranchId={adminUser.branchId}
        />
      </div>

      <StaffFilterBar
        branches={branches}
        userRole={adminUser.role}
      />

      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-4">
        {staffList.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center text-zinc-500">
            Belum ada staf terdaftar.
          </div>
        ) : staffList.map((staff) => (
          <div key={staff.id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-zinc-100 p-2 rounded-full">
                  <UserCog className="w-5 h-5 text-zinc-600" />
                </div>
                <div>
                  <span className="font-bold text-zinc-900 text-base block">{staff.name}</span>
                  <div className="mt-1">{getRoleBadge(staff.role)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  staff.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {staff.isActive ? 'AKTIF' : 'NONAKTIF'}
                </span>
                <StaffRowActions
                  staff={staff}
                  branches={branches}
                  userRole={adminUser.role}
                  currentUserId={adminUser.id}
                />
              </div>
            </div>

            <div className="p-4 space-y-2 bg-zinc-50/50 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-zinc-400" />
                <span className="font-mono">{staff.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-zinc-400" />
                <span>{staff.branch?.name || (staff.role === 'admin_pusat' ? 'Semua Cabang (Pusat)' : 'Belum Ditentukan')}</span>
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
                <th className="px-6 py-4">Nama & Email Staf</th>
                <th className="px-6 py-4">Peran (Role)</th>
                <th className="px-6 py-4">Cabang Penempatan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Belum ada staf terdaftar.
                  </td>
                </tr>
              ) : staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-zinc-100 p-2.5 rounded-full flex-shrink-0">
                        <UserCog className="w-5 h-5 text-zinc-600" />
                      </div>
                      <div>
                        <span className="font-bold text-zinc-900 block text-base">{staff.name}</span>
                        <span className="text-xs text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          {staff.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getRoleBadge(staff.role)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-zinc-800 font-medium text-xs">
                      <Building2 className="w-4 h-4 text-zinc-400" />
                      <span>{staff.branch?.name || (staff.role === 'admin_pusat' ? 'Semua Cabang (Pusat)' : '—')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                      staff.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {staff.isActive ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StaffRowActions
                      staff={staff}
                      branches={branches}
                      userRole={adminUser.role}
                      currentUserId={adminUser.id}
                    />
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
