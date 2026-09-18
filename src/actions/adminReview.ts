'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope, buildScopeWhere } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

export interface GetAdminReviewsOptions {
  page?: number
  pageSize?: number
  branchId?: string
  isPublished?: boolean
  search?: string
}

/**
 * Mengambil daftar ulasan untuk keperluan moderasi admin.
 * Mengamankan otorisasi baca secara simetris:
 * - Ditolak jika pemanggil adalah staff_cabang.
 * - Untuk admin_cabang, parameter options.branchId dari client DIABAIKAN dan di-override mutlak ke scope.branchId miliknya.
 * - Hanya admin_pusat yang diizinkan memilih filter cabang bebas.
 */
export async function getAdminReviews(options?: GetAdminReviewsOptions) {
  const adminUser = await requireAdminSession()

  if (adminUser.role === 'staff_cabang') {
    throw new Error('Akses ditolak: Staf cabang tidak memiliki wewenang mengakses data moderasi ulasan.')
  }

  const scope = await getStaffScope()

  // Base scope based on auth (Enforced on read!)
  const branchScope = buildScopeWhere(scope, 'branchId')

  const where: Prisma.ReviewWhereInput = {
    ...branchScope
  }

  // Client branch filter is ONLY allowed if admin_pusat (scope.scope === 'all')
  if (options?.branchId && options.branchId !== 'all') {
    if (scope.scope === 'all') {
      where.branchId = options.branchId
    }
    // Jika admin_cabang, input client branchId DIABAIKAN secara paksa
  }

  if (options?.isPublished !== undefined) {
    where.isPublished = options.isPublished
  }

  if (options?.search && options.search.trim()) {
    const rawSearch = options.search.trim()
    where.OR = [
      { comment: { contains: rawSearch, mode: 'insensitive' } },
      { customer: { name: { contains: rawSearch, mode: 'insensitive' } } },
      { vehicle: { name: { contains: rawSearch, mode: 'insensitive' } } },
      { vehicle: { plateNumber: { contains: rawSearch.replace(/\s+/g, ''), mode: 'insensitive' } } },
    ]
  }

  const page = Math.max(1, options?.page || 1)
  const pageSize = Math.max(1, options?.pageSize || 10)
  const skip = (page - 1) * pageSize

  const [reviews, totalCount] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        vehicle: { select: { id: true, name: true, plateNumber: true, branchId: true } },
        branch: { select: { id: true, name: true, city: true } },
        moderator: { select: { id: true, name: true, role: true } },
      }
    }),
    prisma.review.count({ where })
  ])

  return {
    reviews,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
    scope
  }
}

export interface ModerateReviewParams {
  reviewId: string
  action: 'hide' | 'unhide'
  reason?: string
}

/**
 * Server Action moderasi ulasan (sembunyikan / tampilkan kembali).
 * - Dibatasi ketat hanya untuk admin_cabang dan admin_pusat.
 * - Memeriksa wewenang cabang pada review.branchId via assertInScope.
 * - Wajib menyertakan alasan non-kosong saat menyembunyikan ulasan (hide).
 * - Dicatat resilient ke AuditLog.
 */
export async function moderateReview(params: ModerateReviewParams) {
  try {
    const adminUser = await requireAdminSession()

    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf cabang tidak memiliki wewenang memoderasi ulasan publik.' }
    }

    const { reviewId, action, reason } = params

    if (!reviewId) {
      return { error: 'ID Ulasan wajib diisi.' }
    }

    // Validasi alasan wajib non-kosong saat aksi 'hide'
    if (action === 'hide') {
      if (!reason || !reason.trim()) {
        return { error: 'Alasan penyembunyian ulasan wajib diisi.' }
      }
    }

    // 1. Dapatkan data review beserta snapshot branchId
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        branchId: true,
        vehicleId: true,
        bookingId: true,
        isPublished: true,
        hiddenReason: true,
      }
    })

    if (!review) {
      return { error: 'Ulasan tidak ditemukan.' }
    }

    // 2. Otorisasi cabang berbasis helper resmi assertInScope
    const scope = await getStaffScope()
    try {
      assertInScope([review.branchId], scope)
    } catch (err: any) {
      return { error: err.message || 'Akses ditolak: Anda hanya berwenang memoderasi ulasan untuk cabang Anda.' }
    }

    const isPublished = action === 'unhide'
    const trimmedReason = action === 'hide' ? reason!.trim() : null

    // 3. Update database secara atomik menggunakan updateMany
    const updateResult = await prisma.review.updateMany({
      where: { id: reviewId },
      data: {
        isPublished,
        isFeatured: action === 'hide' ? false : undefined,
        featuredAt: action === 'hide' ? null : undefined,
        hiddenBy: action === 'hide' ? adminUser.id : null,
        hiddenReason: trimmedReason,
      }
    })

    if (updateResult.count === 0) {
      return { error: 'Gagal memperbarui status ulasan: Data tidak ditemukan.' }
    }

    // 4. Catat Audit Log
    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: review.branchId, // Snapshot branch yang akurat
      action: action === 'hide' ? 'review.hide' : 'review.unhide',
      entityType: 'Review',
      entityId: review.id,
      metadata: {
        bookingId: review.bookingId,
        vehicleId: review.vehicleId,
        branchId: review.branchId,
        reason: trimmedReason,
        previousStatus: review.isPublished ? 'published' : 'hidden'
      }
    })

    // 5. Revalidasi halaman
    revalidatePath('/')
    revalidatePath(`/vehicles/${review.vehicleId}`)
    revalidatePath('/admin/reviews')

    return { success: true }
  } catch (error: any) {
    console.error('[MODERATE_REVIEW_ERROR]', error)
    return { error: error.message || 'Terjadi kesalahan sistem saat memoderasi ulasan.' }
  }
}

export interface ToggleFeaturedReviewParams {
  reviewId: string
  isFeatured: boolean
}

/**
 * Server Action kurasi ulasan unggulan beranda (Featured Testimonials).
 * - Dibatasi ketat HANYA untuk admin_pusat (representasi citra brand utama perusahaan).
 * - Validasi kelayakan: ulasan wajib isPublished === true dan memiliki teks komentar non-kosong.
 * - Mencatat featuredAt DateTime saat di-feature dan mereset ke null saat dilepas.
 * - Dicatat ke AuditLog (review.feature / review.unfeature).
 * - Revalidasi '/' dan '/admin/reviews'.
 */
export async function toggleFeaturedReview(params: ToggleFeaturedReviewParams) {
  try {
    const adminUser = await requireAdminSession()

    if (adminUser.role !== 'admin_pusat') {
      return { error: 'Akses ditolak: Hanya Admin Pusat yang memiliki wewenang mengelola ulasan unggulan di beranda.' }
    }

    const { reviewId, isFeatured } = params
    if (!reviewId) {
      return { error: 'ID Ulasan wajib diisi.' }
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        branchId: true,
        vehicleId: true,
        bookingId: true,
        isPublished: true,
        comment: true,
        isFeatured: true,
      }
    })

    if (!review) {
      return { error: 'Ulasan tidak ditemukan.' }
    }

    if (isFeatured) {
      if (!review.isPublished) {
        return { error: 'Hanya ulasan yang berstatus terbit (publik) yang dapat diunggulkan di beranda.' }
      }
      if (!review.comment || !review.comment.trim()) {
        return { error: 'Ulasan tanpa komentar teks tidak dapat diunggulkan di beranda.' }
      }
    }

    const featuredAt = isFeatured ? new Date() : null

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        isFeatured,
        featuredAt,
      }
    })

    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: review.branchId,
      action: isFeatured ? 'review.feature' : 'review.unfeature',
      entityType: 'Review',
      entityId: review.id,
      metadata: {
        bookingId: review.bookingId,
        vehicleId: review.vehicleId,
        branchId: review.branchId,
        previousFeatured: review.isFeatured,
        featuredAt: featuredAt ? featuredAt.toISOString() : null,
      }
    })

    revalidatePath('/')
    revalidatePath('/admin/reviews')

    return { success: true }
  } catch (error: any) {
    console.error('[TOGGLE_FEATURED_REVIEW_ERROR]', error)
    return { error: error.message || 'Terjadi kesalahan sistem saat memperbarui ulasan unggulan.' }
  }
}
