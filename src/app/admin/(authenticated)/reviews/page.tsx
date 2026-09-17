import { requireAdminSession } from '@/actions/admin'
import { getAdminReviews } from '@/actions/adminReview'
import { prisma } from '@/utils/prisma'
import { ReviewRowActions, ReviewFilterBar } from './ClientActions'
import { Star, ShieldAlert, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; branch?: string; status?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const adminUser = await requireAdminSession()

  // Guard eksplisit: staff_cabang dilarang mengakses
  if (adminUser.role === 'staff_cabang') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center" data-testid="staff-restricted-screen">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Akses Terbatas</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">
          Hanya Admin Cabang dan Admin Pusat yang memiliki wewenang untuk melihat dan memoderasi ulasan publik pelanggan.
        </p>
        <Link
          href="/admin/dashboard"
          className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-lg transition-colors"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    )
  }

  const page = parseInt(resolvedSearchParams.page || '1', 10)
  const branchParam = resolvedSearchParams.branch
  const statusParam = resolvedSearchParams.status

  const isPublishedFilter = statusParam === 'published' ? true : statusParam === 'hidden' ? false : undefined

  // Ambil data ulasan (scoping cabang ditegakkan paksa di dalam getAdminReviews)
  const result = await getAdminReviews({
    page,
    pageSize: 15,
    branchId: branchParam,
    isPublished: isPublishedFilter,
  })

  const { reviews, totalCount, totalPages, currentPage, scope } = result
  const isPusat = scope.scope === 'all'

  // Cabang untuk filter dropdown (hanya relevan bagi admin_pusat)
  const branches = isPusat
    ? await prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto" data-testid="admin-reviews-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Moderasi Ulasan Pelanggan
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {isPusat
              ? 'Kelola dan moderasi ulasan publik pelanggan di seluruh cabang Prestige Motion.'
              : `Kelola ulasan publik pelanggan untuk Cabang Anda.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            Total: {totalCount} Ulasan
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <ReviewFilterBar branches={branches} isPusat={isPusat} />

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300" data-testid="admin-reviews-table">
            <thead className="bg-zinc-800/80 text-zinc-400 uppercase font-semibold border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3.5">Armada</th>
                <th className="px-4 py-3.5">Cabang Asal</th>
                <th className="px-4 py-3.5">Pelanggan</th>
                <th className="px-4 py-3.5">Rating</th>
                <th className="px-4 py-3.5 min-w-[240px]">Komentar</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    Tidak ada data ulasan ditemukan.
                  </td>
                </tr>
              ) : (
                reviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-zinc-800/40 transition-colors" data-testid={`admin-review-row-${rev.id}`}>
                    {/* Armada */}
                    <td className="px-4 py-3.5">
                      <strong className="text-white block font-medium">
                        {rev.vehicle.name || rev.vehicle.plateNumber}
                      </strong>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {rev.vehicle.plateNumber}
                      </span>
                    </td>

                    {/* Cabang Asal (Snapshot) */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {rev.branch.name}
                      </span>
                    </td>

                    {/* Pelanggan (Lengkap untuk investigasi staf) */}
                    <td className="px-4 py-3.5">
                      <span className="text-white block font-medium">
                        {rev.customer.name}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {rev.customer.email}
                      </span>
                    </td>

                    {/* Rating */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 font-bold text-amber-400">
                        <span>{rev.rating}</span>
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </div>
                    </td>

                    {/* Komentar */}
                    <td className="px-4 py-3.5">
                      {rev.comment ? (
                        <p className="text-zinc-200 line-clamp-2 leading-relaxed">
                          "{rev.comment}"
                        </p>
                      ) : (
                        <span className="text-zinc-500 italic">Tidak ada catatan</span>
                      )}
                      {rev.hiddenReason && !rev.isPublished && (
                        <div className="mt-1.5 flex items-start gap-1 text-[11px] text-red-300 bg-red-950/40 px-2 py-1 rounded border border-red-900/50">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>Alasan Sembunyi: {rev.hiddenReason}</span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {rev.isPublished ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Terbit (Publik)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                          Disembunyikan
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <ReviewRowActions
                        reviewId={rev.id}
                        isPublished={rev.isPublished}
                        vehicleName={rev.vehicle.name || rev.vehicle.plateNumber}
                        customerName={rev.customer.name}
                        currentReason={rev.hiddenReason}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/admin/reviews?page=${currentPage - 1}${branchParam ? `&branch=${branchParam}` : ''}${statusParam ? `&status=${statusParam}` : ''}`}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
                >
                  Sebelumnya
                </Link>
              )}
              {currentPage < totalPages && (
                <Link
                  href={`/admin/reviews?page=${currentPage + 1}${branchParam ? `&branch=${branchParam}` : ''}${statusParam ? `&status=${statusParam}` : ''}`}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
                >
                  Selanjutnya
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
