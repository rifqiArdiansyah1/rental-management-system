import { requireAdminSession } from '@/actions/admin'
import { getAdminReviews } from '@/actions/adminReview'
import { prisma } from '@/utils/prisma'
import { ReviewRowActions, ReviewFilterBar } from './ClientActions'
import { Star, ShieldAlert, AlertTriangle, Building2, User } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; branch?: string; status?: string; search?: string; q?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const adminUser = await requireAdminSession()

  // Guard eksplisit: staff_cabang dilarang mengakses
  if (adminUser.role === 'staff_cabang') {
    return (
      <div className="p-4 md:p-8" data-testid="admin-reviews-page">
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 flex flex-col items-center justify-center min-h-[50vh] text-center" data-testid="staff-restricted-screen">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Akses Terbatas</h2>
          <p className="text-sm text-zinc-500 max-w-md mb-6 leading-relaxed">
            Hanya Admin Cabang dan Admin Pusat yang memiliki wewenang untuk melihat dan memoderasi ulasan publik pelanggan.
          </p>
          <Link
            href="/admin/dashboard"
            className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const page = parseInt(resolvedSearchParams.page || '1', 10)
  const branchParam = resolvedSearchParams.branch
  const statusParam = resolvedSearchParams.status
  const searchParam = resolvedSearchParams.search || resolvedSearchParams.q

  const isPublishedFilter = statusParam === 'published' ? true : statusParam === 'hidden' ? false : undefined

  // Ambil data ulasan (scoping cabang ditegakkan paksa di dalam getAdminReviews)
  const result = await getAdminReviews({
    page,
    pageSize: 15,
    branchId: branchParam,
    isPublished: isPublishedFilter,
    search: searchParam,
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
    <div className="p-4 md:p-8" data-testid="admin-reviews-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">
            Moderasi Ulasan Pelanggan
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isPusat
              ? 'Kelola dan moderasi ulasan publik pelanggan di seluruh cabang Prestige Motion.'
              : 'Kelola ulasan publik pelanggan untuk Cabang Anda.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-zinc-700 border border-zinc-200 shadow-sm">
            Total: {totalCount} Ulasan
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <ReviewFilterBar branches={branches} isPusat={isPusat} />

      {/* Reviews Table View */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-sm text-zinc-600" data-testid="admin-reviews-table">
            <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Armada</th>
                <th className="px-5 py-3.5">Cabang Asal</th>
                <th className="px-5 py-3.5">Pelanggan</th>
                <th className="px-5 py-3.5">Rating</th>
                <th className="px-5 py-3.5 min-w-[260px]">Komentar</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-sm">
                    Tidak ada data ulasan ditemukan.
                  </td>
                </tr>
              ) : (
                reviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-zinc-50/75 transition-colors" data-testid={`admin-review-row-${rev.id}`}>
                    {/* Armada */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-semibold text-zinc-900 block text-sm">
                        {rev.vehicle.name || rev.vehicle.plateNumber}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        {rev.vehicle.plateNumber}
                      </span>
                    </td>

                    {/* Cabang Asal (Snapshot) */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {rev.branch.name}
                      </span>
                    </td>

                    {/* Pelanggan (Lengkap untuk investigasi staf) */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-medium text-zinc-900 block text-xs">
                        {rev.customer.name}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {rev.customer.email}
                      </span>
                    </td>

                    {/* Rating */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 font-semibold text-amber-500 text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-zinc-800">{rev.rating}.0</span>
                      </div>
                    </td>

                    {/* Komentar */}
                    <td className="px-5 py-4">
                      {rev.comment ? (
                        <p className="text-zinc-700 text-xs line-clamp-2 leading-relaxed">
                          "{rev.comment}"
                        </p>
                      ) : (
                        <span className="text-zinc-400 text-xs italic">Tidak ada catatan</span>
                      )}
                      {rev.hiddenReason && !rev.isPublished && (
                        <div className="mt-1.5 flex items-start gap-1 text-[11px] text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                          <span>Alasan Sembunyi: {rev.hiddenReason}</span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        {rev.isPublished ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Terbit (Publik)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                            Disembunyikan
                          </span>
                        )}
                        {rev.isFeatured && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-sm"
                            data-testid={`featured-badge-${rev.id}`}
                          >
                            <Star className="w-3 h-3 fill-amber-500 text-amber-600" />
                            <span>Unggulan Beranda</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <ReviewRowActions
                        reviewId={rev.id}
                        isPublished={rev.isPublished}
                        isFeatured={rev.isFeatured}
                        hasComment={Boolean(rev.comment && rev.comment.trim())}
                        isPusat={isPusat}
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
          <div className="p-4 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500 bg-zinc-50/50">
            <span>
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/admin/reviews?page=${currentPage - 1}${branchParam ? `&branch=${branchParam}` : ''}${statusParam ? `&status=${statusParam}` : ''}${searchParam ? `&search=${searchParam}` : ''}`}
                  className="px-3 py-1.5 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-medium rounded-lg shadow-sm transition-colors"
                >
                  Sebelumnya
                </Link>
              )}
              {currentPage < totalPages && (
                <Link
                  href={`/admin/reviews?page=${currentPage + 1}${branchParam ? `&branch=${branchParam}` : ''}${statusParam ? `&status=${statusParam}` : ''}${searchParam ? `&search=${searchParam}` : ''}`}
                  className="px-3 py-1.5 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-medium rounded-lg shadow-sm transition-colors"
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
