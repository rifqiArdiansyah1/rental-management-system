import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { parseWibDateBoundary, formatWibDateTime } from '@/lib/bookingFilters'
import { AuditLogFilterBar, MetadataViewerButton } from './ClientActions'
import { ShieldCheck, User, Calendar, FileText, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getActionBadgeStyle(action: string) {
  if (action.includes('denied') || action.includes('cancel') || action.includes('delete') || action.includes('deactivate')) {
    return 'bg-red-100 text-red-800 border-red-200'
  }
  if (action.includes('create') || action.includes('start') || action.includes('verify')) {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  }
  if (action.includes('update') || action.includes('status') || action.includes('reassign')) {
    return 'bg-amber-100 text-amber-800 border-amber-200'
  }
  if (action.includes('view')) {
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }
  return 'bg-zinc-100 text-zinc-800 border-zinc-200'
}

function getRoleBadgeStyle(role: string) {
  switch (role) {
    case 'admin_pusat':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'admin_cabang':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'staff_cabang':
      return 'bg-zinc-100 text-zinc-700 border-zinc-200'
    default:
      return 'bg-zinc-100 text-zinc-800 border-zinc-200'
  }
}

export default async function AuditLogsPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const adminUser = await requireAdminSession()

  // Guard RBAC: Staf cabang tidak memiliki akses ke audit log
  if (adminUser.role === 'staff_cabang') {
    redirect('/admin/dashboard')
  }

  const resolvedSearchParams = await searchParams
  const q = (resolvedSearchParams.q as string) || ''
  const category = (resolvedSearchParams.category as string) || 'all'
  const entityType = (resolvedSearchParams.entityType as string) || 'all'
  const branchId = (resolvedSearchParams.branchId as string) || 'all'
  const dateFrom = (resolvedSearchParams.dateFrom as string) || ''
  const dateTo = (resolvedSearchParams.dateTo as string) || ''
  const currentPage = Math.max(1, parseInt((resolvedSearchParams.page as string) || '1', 10))
  const pageSize = 20

  // 1. Ambil data cabang untuk filter & label lookup
  const rawBranches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, city: true }
  })
  const branches = JSON.parse(JSON.stringify(rawBranches)) as typeof rawBranches
  const branchMap = new Map(branches.map(b => [b.id, b.name]))

  // 2. Bangun Prisma Where Input
  const where: Prisma.AuditLogWhereInput = {}

  // Scoping: admin_cabang strictly locked to their branch
  if (adminUser.role === 'admin_cabang') {
    where.branchId = adminUser.branchId
  } else if (adminUser.role === 'admin_pusat' && branchId !== 'all') {
    where.branchId = branchId
  }

  // Category Filter (menggunakan startsWith action code)
  if (category && category !== 'all') {
    where.action = { startsWith: `${category}.` }
  }

  // Entity Type Filter
  if (entityType && entityType !== 'all') {
    where.entityType = entityType
  }

  // Date Range Filter (WIB-aligned)
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) {
      where.createdAt.gte = parseWibDateBoundary(dateFrom, false)
    }
    if (dateTo) {
      where.createdAt.lte = parseWibDateBoundary(dateTo, true)
    }
  }

  // Keyword Search
  if (q.trim()) {
    where.OR = [
      { actor: { name: { contains: q.trim(), mode: 'insensitive' } } },
      { actor: { email: { contains: q.trim(), mode: 'insensitive' } } },
      { entityId: { contains: q.trim(), mode: 'insensitive' } },
      { action: { contains: q.trim(), mode: 'insensitive' } }
    ]
  }

  // 3. Query Data & Count Paralel
  const [rawLogs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * pageSize,
      take: pageSize
    }),
    prisma.auditLog.count({ where })
  ])

  const logs = JSON.parse(JSON.stringify(rawLogs)) as typeof rawLogs
  const totalPages = Math.ceil(totalCount / pageSize) || 1

  // Helper untuk membuat link navigasi pagination dengan mempertahankan parameter query
  const createPageUrl = (targetPage: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (category !== 'all') params.set('category', category)
    if (entityType !== 'all') params.set('entityType', entityType)
    if (adminUser.role === 'admin_pusat' && branchId !== 'all') params.set('branchId', branchId)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    params.set('page', targetPage.toString())
    return `/admin/audit-logs?${params.toString()}`
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900">Audit Log & Jejak Aktivitas</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Immutable
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            {adminUser.role === 'admin_pusat'
              ? 'Pemantauan komprehensif seluruh mutasi data sensitif, konfigurasi sistem, dan akses dokumen lintas cabang.'
              : `Pemantauan jejak aktivitas operasional dan akses dokumen untuk ${branchMap.get(adminUser.branchId || '') || 'Cabang Anda'}.`}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <AuditLogFilterBar
        branches={branches}
        userRole={adminUser.role}
        userBranchId={adminUser.branchId}
      />

      {/* Info Status Total */}
      <div className="flex justify-between items-center mb-3 text-xs text-zinc-500">
        <span>Menampilkan <strong>{logs.length}</strong> dari <strong>{totalCount}</strong> catatan aktivitas</span>
        <span>Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong></span>
      </div>

      {/* Table Desktop (lg+) */}
      <div className="hidden lg:block bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Waktu (WIB)</th>
                <th className="px-5 py-3.5">Aktor (Snapshot Role)</th>
                <th className="px-5 py-3.5">Cabang Target</th>
                <th className="px-5 py-3.5">Aksi</th>
                <th className="px-5 py-3.5">Entitas Target</th>
                <th className="px-5 py-3.5 text-right">Detail Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-zinc-400">
                    Tidak ada catatan audit log yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const targetBranchName = log.branchId ? (branchMap.get(log.branchId) || log.branchId.substring(0, 8)) : 'Pusat / Global'
                  const isDenied = log.action.includes('denied')

                  return (
                    <tr key={log.id} className={`hover:bg-zinc-50/75 transition-colors ${isDenied ? 'bg-red-50/30' : ''}`}>
                      {/* Waktu */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <div className="font-mono text-zinc-900 font-medium">{formatWibDateTime(log.createdAt)}</div>
                      </td>

                      {/* Aktor */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="bg-zinc-100 p-1.5 rounded-full text-zinc-600">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900 text-xs">{log.actor?.name || 'Unknown'}</div>
                            <div className="text-[11px] text-zinc-400 font-mono">{log.actor?.email || log.actorId.substring(0, 8)}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeStyle(log.actorRole)}`}>
                            {log.actorRole.replace('_', ' ')}
                          </span>
                        </div>
                      </td>

                      {/* Cabang Target */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {targetBranchName}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-semibold border ${getActionBadgeStyle(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Entitas Target */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <div className="font-medium text-zinc-900">{log.entityType}</div>
                        <div className="font-mono text-[11px] text-zinc-400">{log.entityId}</div>
                      </td>

                      {/* Detail */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <MetadataViewerButton
                          action={log.action}
                          entityType={log.entityType}
                          entityId={log.entityId}
                          metadata={log.metadata}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout (< lg) */}
      <div className="lg:hidden flex flex-col gap-3 mb-6">
        {logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-400 text-sm">
            Tidak ada catatan audit log yang sesuai dengan filter.
          </div>
        ) : (
          logs.map(log => {
            const targetBranchName = log.branchId ? (branchMap.get(log.branchId) || log.branchId.substring(0, 8)) : 'Pusat / Global'
            const isDenied = log.action.includes('denied')

            return (
              <div
                key={log.id}
                className={`bg-white rounded-xl border border-zinc-200 p-4 shadow-sm space-y-3 ${isDenied ? 'border-l-4 border-l-red-500 bg-red-50/20' : ''}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border ${getActionBadgeStyle(log.action)}`}>
                    {log.action}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {formatWibDateTime(log.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-100">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-0.5">Aktor</span>
                    <div className="font-medium text-zinc-900">{log.actor?.name || 'Unknown'}</div>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${getRoleBadgeStyle(log.actorRole)}`}>
                      {log.actorRole.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-0.5">Target</span>
                    <div className="font-medium text-zinc-900">{log.entityType}</div>
                    <div className="font-mono text-[10px] text-zinc-400 truncate">{log.entityId}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                    {targetBranchName}
                  </span>
                  <MetadataViewerButton
                    action={log.action}
                    entityType={log.entityType}
                    entityId={log.entityId}
                    metadata={log.metadata}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-1">
            {currentPage > 1 ? (
              <Link
                href={createPageUrl(currentPage - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-50 rounded-lg cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </span>
            )}
          </div>

          <div className="text-xs text-zinc-500 font-medium">
            Halaman {currentPage} dari {totalPages}
          </div>

          <div className="flex items-center gap-1">
            {currentPage < totalPages ? (
              <Link
                href={createPageUrl(currentPage + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-50 rounded-lg cursor-not-allowed">
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
