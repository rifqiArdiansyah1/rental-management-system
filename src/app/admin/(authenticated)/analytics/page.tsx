import { redirect } from 'next/navigation'
import { requireAdminSession } from '@/actions/admin'
import { getAnalyticsData } from '@/actions/adminAnalytics'
import { prisma } from '@/utils/prisma'
import { AnalyticsClient } from './AnalyticsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminAnalyticsPage() {
  const adminUser = await requireAdminSession()

  // Strict role guard: only admin_pusat and admin_cabang can access financial analytics
  if (adminUser.role === 'staff_cabang') {
    redirect('/admin/dashboard')
  }

  // Ambil data analitik awal (Default: 20 hari terakhir)
  const initialData = await getAnalyticsData()

  if ('error' in initialData) {
    return (
      <div className="p-8">
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <h2 className="text-lg font-bold">Terjadi Kesalahan Memuat Data</h2>
          <p className="text-sm mt-1">{initialData.error}</p>
        </div>
      </div>
    )
  }

  let branches: { id: string; name: string }[] | undefined = undefined
  if (adminUser.role === 'admin_pusat') {
    branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <AnalyticsClient
        initialData={initialData}
        branches={branches}
        userRole={adminUser.role}
      />
    </div>
  )
}
