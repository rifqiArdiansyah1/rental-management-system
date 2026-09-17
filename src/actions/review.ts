'use server'

import { prisma } from '@/utils/prisma'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SubmitReviewParams {
  bookingId: string
  rating: number
  comment?: string | null
}

export interface ReviewActionResult {
  success?: boolean
  reviewId?: string
  error?: string
  errorCode?: string
}

/**
 * Server Action bagi customer untuk mengirimkan ulasan armada rental.
 * Dibatasi ketat hanya untuk booking yang berstatus 'completed' dan belum pernah diulas.
 * Mengimplementasikan pertahanan TOCTOU dengan menangkap constraint P2002.
 */
export async function submitCustomerReview(params: SubmitReviewParams): Promise<ReviewActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Silakan masuk ke akun Anda terlebih dahulu.', errorCode: 'AUTH_REQUIRED' }
    }

    const { bookingId, rating, comment } = params

    if (!bookingId) {
      return { error: 'ID Pesanan wajib diisi.', errorCode: 'INVALID_INPUT' }
    }

    // Validasi rating (integer 1 s/d 5)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { error: 'Rating harus berupa angka 1 sampai 5 bintang.', errorCode: 'INVALID_RATING' }
    }

    const sanitizedComment = comment?.trim() ? comment.trim().slice(0, 1000) : null

    // 1. Pre-check kelayakan booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        review: { select: { id: true } }
      }
    })

    if (!booking) {
      return { error: 'Pesanan tidak ditemukan.', errorCode: 'NOT_FOUND' }
    }

    if (booking.customerId !== user.id) {
      return { error: 'Akses ditolak: Anda hanya dapat mengulas pesanan milik Anda sendiri.', errorCode: 'FORBIDDEN' }
    }

    if (booking.status !== 'completed') {
      return { error: 'Ulasan hanya dapat diberikan setelah masa sewa armada selesai (completed).', errorCode: 'NOT_COMPLETED' }
    }

    if (booking.review) {
      return { error: 'Anda sudah memberikan ulasan untuk pesanan ini.', errorCode: 'DUPLICATE_REVIEW' }
    }

    // 2. Insert ke Database dengan Snapshot branchId & Pertahanan TOCTOU
    try {
      const review = await prisma.review.create({
        data: {
          bookingId: booking.id,
          customerId: user.id,
          vehicleId: booking.vehicleId,
          branchId: booking.pickupBranchId, // Snapshot cabang tempat rental berlangsung
          rating,
          comment: sanitizedComment,
          isPublished: true, // Auto-terbit langsung
        }
      })

      // 3. Revalidasi halaman terkait
      revalidatePath(`/vehicles/${booking.vehicleId}`)
      revalidatePath(`/booking/${booking.id}`)
      revalidatePath('/dashboard')
      revalidatePath('/admin/reviews')

      return { success: true, reviewId: review.id }
    } catch (dbError: any) {
      // Tangkap pelanggaran unique constraint bookingId (P2002) dari Prisma
      if (dbError.code === 'P2002' || dbError.message?.includes('Unique constraint failed')) {
        return { error: 'Anda sudah memberikan ulasan untuk pesanan ini.', errorCode: 'DUPLICATE_REVIEW' }
      }
      throw dbError
    }
  } catch (error: any) {
    console.error('[SUBMIT_CUSTOMER_REVIEW_ERROR]', error)
    return { error: error.message || 'Terjadi kesalahan sistem saat mengirimkan ulasan.', errorCode: 'INTERNAL_ERROR' }
  }
}

/**
 * Mengambil ulasan existing untuk booking tertentu (digunakan oleh dashboard & booking detail).
 */
export async function getCustomerBookingReview(bookingId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    const review = await prisma.review.findUnique({
      where: { bookingId },
      include: {
        branch: { select: { name: true, city: true } }
      }
    })

    if (!review || review.customerId !== user.id) {
      return null
    }

    return review
  } catch (error) {
    console.error('[GET_BOOKING_REVIEW_ERROR]', error)
    return null
  }
}
