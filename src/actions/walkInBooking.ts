'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit'
import { createAdminClient } from '@/utils/supabase/admin'
import { formatIndonesianPhoneNumber } from '@/utils/whatsapp'
import { createWalkInBookingCore } from '@/lib/booking'
import { TURNOVER_BUFFER_MS, isWithinOperatingHoursWIB } from '@/lib/constants'
import { syncCustomerVerificationStatus } from '@/lib/kyc'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { RentalType, WalkInReviewStatus } from '@prisma/client'

/**
 * Mencari pelanggan yang sudah terdaftar berdasarkan nomor telepon atau email.
 */
export async function searchCustomerForWalkIn(query: string) {
  try {
    await requireAdminSession()

    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 3) {
      return { customers: [] }
    }

    const normalizedPhone = formatIndonesianPhoneNumber(trimmed)

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          ...(normalizedPhone ? [{ phone: { contains: normalizedPhone } }] : [{ phone: { contains: trimmed } }]),
          { email: { contains: trimmed, mode: 'insensitive' as const } },
          { name: { contains: trimmed, mode: 'insensitive' as const } },
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        ktpNumber: true,
        simNumber: true,
        verificationStatus: true,
      },
      take: 10
    })

    return { customers }
  } catch (error: any) {
    return { error: error.message || 'Gagal mencari data pelanggan.' }
  }
}

/**
 * Menyelesaikan identitas pelanggan walk-in:
 * 1. Menggunakan pelanggan existing jika nomor HP atau email sudah terdaftar.
 * 2. Jika baru: membuat akun Supabase Auth + Prisma Customer (dual-write dengan rollback compensation).
 *    Password acak aman digenerate otomatis tanpa diperlihatkan ke staf, dan tautan atur password dipicu.
 */
export async function resolveOrCreateWalkInCustomer(data: {
  name: string
  email: string
  phone: string
  ktpNumber?: string | null
  simNumber?: string | null
}) {
  try {
    await requireAdminSession()

    if (!data.name || data.name.trim().length < 2) {
      return { error: 'Nama pelanggan wajib diisi minimal 2 karakter.' }
    }

    if (!data.email || !data.email.includes('@')) {
      return { error: 'Format email pelanggan tidak valid.' }
    }

    const normalizedPhone = formatIndonesianPhoneNumber(data.phone)
    if (!normalizedPhone) {
      return { error: 'Nomor telepon wajib nomor seluler Indonesia yang valid (contoh: 08123456789).' }
    }

    const cleanEmail = data.email.trim().toLowerCase()

    // 1. Cek apakah customer sudah terdaftar
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { phone: normalizedPhone },
        ]
      }
    })

    if (existingCustomer) {
      // Perbarui nomor KTP / SIM jika sebelumnya kosong tapi sekarang disediakan
      const updates: { ktpNumber?: string; simNumber?: string } = {}
      if (!existingCustomer.ktpNumber && data.ktpNumber?.trim()) {
        updates.ktpNumber = data.ktpNumber.trim()
      }
      if (!existingCustomer.simNumber && data.simNumber?.trim()) {
        updates.simNumber = data.simNumber.trim()
      }

      if (Object.keys(updates).length > 0) {
        const updated = await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: updates
        })
        return { success: true, customer: updated, isNew: false }
      }

      return { success: true, customer: existingCustomer, isNew: false }
    }

    // 2. Buat akun baru via Dual-Write Supabase Auth + Prisma
    const supabaseAdmin = createAdminClient()
    const randomPassword = crypto.randomBytes(18).toString('base64') + 'Wk1#'

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        name: data.name.trim(),
        phone: normalizedPhone,
      }
    })

    if (authError) {
      if (
        authError.message?.toLowerCase().includes('already registered') ||
        authError.message?.toLowerCase().includes('duplicate') ||
        (authError as any).status === 422
      ) {
        const fallbackCustomer = await prisma.customer.findUnique({
          where: { email: cleanEmail }
        })
        if (fallbackCustomer) {
          return { success: true, customer: fallbackCustomer, isNew: false }
        }
        return { error: 'Email sudah terdaftar di sistem autentikasi. Gunakan email pelanggan yang berbeda.' }
      }
      return { error: authError.message || 'Gagal mendaftarkan akun di server autentikasi.' }
    }

    // 3. Simpan record Customer di Prisma
    try {
      const newCustomer = await prisma.customer.create({
        data: {
          id: authData.user.id,
          name: data.name.trim(),
          email: cleanEmail,
          phone: normalizedPhone,
          ktpNumber: data.ktpNumber?.trim() || null,
          simNumber: data.simNumber?.trim() || null,
          verificationStatus: 'pending',
        }
      })

      // Kirim link pemulihan / atur password ke email pelanggan secara non-blocking
      supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
      }).catch((err) => {
        console.error('[WALK_IN_PASSWORD_SETUP_ERROR] Gagal men-generate password recovery link:', err)
      })

      return { success: true, customer: newCustomer, isNew: true }
    } catch (dbError: any) {
      console.error('[ROLLBACK] Menghapus Supabase auth user karena insert Prisma gagal:', dbError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(console.error)

      if (dbError.code === 'P2002') {
        return { error: 'Data nomor telepon atau KTP/SIM sudah terdaftar pada pelanggan lain.' }
      }
      return { error: 'Terjadi kesalahan sistem saat menyimpan data pelanggan ke basis data.' }
    }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan saat memproses data pelanggan.' }
  }
}

/**
 * Mengunggah dokumen fisik KTP & SIM untuk pelanggan walk-in.
 * - Staf memfoto/mengunggah dokumen asli di meja kasir.
 * - File disimpan ke Supabase Storage (bucket 'documents').
 * - Record Document dibuat dengan verifiedAt = new Date().
 * - Status agregasi KYC diperbarui melalui syncCustomerVerificationStatus.
 */
export async function uploadWalkInDocumentsAction(formData: FormData) {
  try {
    const adminUser = await requireAdminSession()
    const scope = await getStaffScope()

    const customerId = formData.get('customerId') as string
    if (!customerId) {
      return { error: 'ID pelanggan tidak ditemukan.' }
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })
    if (!customer) {
      return { error: 'Pelanggan tidak ditemukan.' }
    }

    const ktpFile = formData.get('ktpFile') as File | null
    const simFile = formData.get('simFile') as File | null
    const ktpNumber = (formData.get('ktpNumber') as string || '').trim()
    const simNumber = (formData.get('simNumber') as string || '').trim()

    if (!ktpFile && !simFile) {
      return { error: 'Wajib mengunggah minimal satu file foto dokumen fisik (KTP atau SIM).' }
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    const maxSize = 5 * 1024 * 1024 // 5MB

    const supabaseAdmin = createAdminClient()

    const processDoc = async (file: File, type: 'ktp' | 'sim', identityNumber?: string) => {
      if (file.size > maxSize) {
        throw new Error(`Ukuran file ${type.toUpperCase()} maksimal 5MB.`)
      }
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Format file ${type.toUpperCase()} tidak didukung (hanya JPG, PNG, PDF).`)
      }

      const fileExt = file.name.split('.').pop() || 'jpg'
      const filePath = `${customerId}/${Date.now()}_walkin_${type}.${fileExt}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('documents')
        .upload(filePath, file, { upsert: false })

      if (uploadError) {
        console.error(`[WALK_IN_DOC_UPLOAD] Storage error for ${type}:`, uploadError)
      }

      await prisma.$transaction(async (tx) => {
        const existingDoc = await tx.document.findFirst({
          where: { customerId, type }
        })

        if (existingDoc) {
          await tx.document.update({
            where: { id: existingDoc.id },
            data: {
              fileUrl: filePath,
              verifiedAt: new Date(),
              rejectionReason: null,
              updatedAt: new Date(),
            }
          })
        } else {
          await tx.document.create({
            data: {
              customerId,
              type,
              fileUrl: filePath,
              verifiedAt: new Date(),
              rejectionReason: null,
            }
          })
        }

        if (identityNumber) {
          await tx.customer.update({
            where: { id: customerId },
            data: {
              ...(type === 'ktp' ? { ktpNumber: identityNumber } : { simNumber: identityNumber })
            }
          })
        }
      })
    }

    if (ktpFile) {
      await processDoc(ktpFile, 'ktp', ktpNumber)
    }
    if (simFile) {
      await processDoc(simFile, 'sim', simNumber)
    }

    // Single source of truth aggregate KYC sync
    const newVerificationStatus = await syncCustomerVerificationStatus(customerId, prisma)

    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: scope.scope === 'branch' ? scope.branchId : null,
      action: 'document.walk_in_uploaded',
      entityType: 'Customer',
      entityId: customerId,
      metadata: {
        uploadedKtp: Boolean(ktpFile),
        uploadedSim: Boolean(simFile),
        newVerificationStatus,
      }
    })

    return { success: true, verificationStatus: newVerificationStatus }
  } catch (error: any) {
    return { error: error.message || 'Gagal memproses unggah dokumen fisik walk-in.' }
  }
}

/**
 * Membuat Booking Walk-In dengan Pembayaran Tunai di Meja Resepsionis.
 * - Berwenang: staff_cabang, admin_cabang, admin_pusat.
 * - Diskon: HANYA berwenang untuk admin_cabang & admin_pusat (staff_cabang dilarang keras).
 * - Plafon Diskon: Maksimal 30% dari biaya sewa kendaraan, alasan min 10 karakter.
 */
export async function createWalkInBookingAction(payload: {
  customerId: string
  vehicleId: string
  branchId: string
  startDate: Date | string
  endDate: Date | string
  rentalType: RentalType
  discountAmount?: number | null
  discountReason?: string | null
}) {
  try {
    const adminUser = await requireAdminSession()
    const scope = await getStaffScope()

    // 1. Scoping Guard
    try {
      assertInScope([payload.branchId], scope)
    } catch (err: any) {
      return { error: err.message }
    }

    // 2. Diskon Policy Guard
    if (payload.discountAmount !== undefined && payload.discountAmount !== null) {
      const rawDisc = Number(payload.discountAmount)
      if (isNaN(rawDisc) || rawDisc < 0) {
        return { error: 'Nominal diskon tidak boleh bernilai negatif.' }
      }
    }

    const discount = payload.discountAmount && Number(payload.discountAmount) > 0 ? Number(payload.discountAmount) : 0
    if (discount > 0) {
      if (adminUser.role === 'staff_cabang') {
        return { error: 'Akses ditolak: Staf Cabang tidak berwenang memberikan diskon sewa.' }
      }
      if (!payload.discountReason || payload.discountReason.trim().length < 10) {
        return { error: 'Alasan diskon wajib diisi minimal 10 karakter dengan konteks manajerial yang jelas.' }
      }
    }

    const startDate = new Date(payload.startDate)
    const endDate = new Date(payload.endDate)

    // 3. Buffer dan Jam Operasional Guard
    const minStartDate = new Date(Date.now() + TURNOVER_BUFFER_MS)
    if (startDate < minStartDate) {
      return { error: 'Jadwal penjemputan minimal 3 jam dari sekarang untuk persiapan armada.' }
    }

    if (!isWithinOperatingHoursWIB(startDate) || !isWithinOperatingHoursWIB(endDate)) {
      return { error: 'Jadwal penjemputan dan pengembalian wajib dalam jam operasional (08:00–21:00 WIB).' }
    }

    // 4. Eksekusi Core Walk-in Booking (Row Lock + Availability + Pricing + 30% Cap + Cash Payment)
    const booking = await createWalkInBookingCore({
      customerId: payload.customerId,
      vehicleId: payload.vehicleId,
      pickupBranchId: payload.branchId,
      returnBranchId: payload.branchId,
      startDate,
      endDate,
      rentalType: payload.rentalType,
      createdByStaffId: adminUser.id,
      discountAmount: discount > 0 ? discount : null,
      discountReason: discount > 0 ? payload.discountReason?.trim() : null,
      discountAppliedBy: discount > 0 ? adminUser.id : null,
    })

    // 5. Catat Jejak Audit Permanen
    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: payload.branchId,
      action: 'booking.create_walk_in',
      entityType: 'Booking',
      entityId: booking.id,
      metadata: {
        cashReceived: Number(booking.totalPrice),
        discountAmount: discount > 0 ? discount : null,
        discountReason: discount > 0 ? payload.discountReason?.trim() : null,
        discountAppliedBy: discount > 0 ? adminUser.id : null,
        createdByStaffId: adminUser.id,
        customerId: payload.customerId,
        vehicleId: payload.vehicleId,
      }
    })

    revalidatePath('/admin/bookings')
    revalidatePath(`/admin/bookings/${booking.id}`)
    revalidatePath('/admin/dashboard')

    return { success: true, bookingId: booking.id }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem saat membuat booking walk-in.' }
  }
}

/**
 * Meninjau (Review) Transaksi Kas Walk-in Pasca-Transaksi.
 * - Berwenang: admin_cabang (untuk cabangnya), admin_pusat (semua cabang).
 * - staff_cabang dilarang keras mereview transaksi kas.
 * - Anti-Self-Review: Pembuat transaksi dilarang mereview transaksinya sendiri.
 */
export async function reviewWalkInBookingAction(
  bookingId: string,
  decision: 'confirmed' | 'flagged',
  note?: string
) {
  try {
    const adminUser = await requireAdminSession()
    const scope = await getStaffScope()

    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Staf Cabang tidak berwenang mereview penerimaan kas walk-in.' }
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    })

    if (!booking) {
      return { error: 'Pesanan tidak ditemukan.' }
    }

    if (booking.bookingChannel !== 'walk_in') {
      return { error: 'Pesanan ini bukan transaksi pemesanan walk-in.' }
    }

    // Guard Anti-Self-Review (Four-Eyes Principle)
    if (booking.createdByStaffId === adminUser.id) {
      return {
        error: 'Akses ditolak: Anda tidak dapat mereview atau mengonfirmasi penerimaan kas untuk transaksi yang Anda buat sendiri demi kepatuhan pemisahan wewenang (four-eyes principle).'
      }
    }

    try {
      assertInScope([booking.pickupBranchId], scope)
    } catch (err: any) {
      return { error: err.message }
    }

    // Eksekusi atomik anti-race condition
    const updateResult = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        walkInReviewStatus: 'pending_review'
      },
      data: {
        walkInReviewStatus: decision as WalkInReviewStatus,
        walkInReviewedBy: adminUser.id,
        walkInReviewedAt: new Date(),
        walkInReviewNote: note?.trim() || null,
      }
    })

    if (updateResult.count === 0) {
      return { error: 'Status review pesanan telah berubah oleh proses lain. Silakan muat ulang halaman.' }
    }

    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: booking.pickupBranchId,
      action: decision === 'flagged' ? 'booking.walk_in_flagged' : 'booking.walk_in_confirmed',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        decision,
        note: note?.trim() || null,
        reviewedBy: adminUser.id,
        reviewedRole: adminUser.role,
      }
    })

    revalidatePath('/admin/bookings')
    revalidatePath(`/admin/bookings/${bookingId}`)
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem saat meninjau transaksi.' }
  }
}

/**
 * Menyelesaikan Transaksi Walk-In yang Telah Di-Flag (Eskalasi ke Admin Pusat).
 * - Berwenang: HANYA admin_pusat.
 * - Pembatalan hanya diizinkan bila booking masih 'confirmed'/'pending_payment'.
 * - Jika sudah 'ongoing'/'completed', sistem menjaga integritas riwayat rental fisik dan hanya menyelesaikan review note / audit.
 */
export async function resolveFlaggedWalkInAction(
  bookingId: string,
  resolutionNote: string,
  resolutionAction: 'confirm_cash' | 'cancel_booking' = 'confirm_cash'
) {
  try {
    const adminUser = await requireAdminSession()

    if (adminUser.role !== 'admin_pusat') {
      return { error: 'Akses ditolak: Hanya Admin Pusat yang berwenang menyelesaikan eskalasi flag transaksi.' }
    }

    if (!resolutionNote || resolutionNote.trim().length < 5) {
      return { error: 'Catatan resolusi wajib diisi minimal 5 karakter.' }
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    })

    if (!booking) {
      return { error: 'Pesanan tidak ditemukan.' }
    }

    if (booking.walkInReviewStatus !== 'flagged') {
      return { error: 'Pesanan ini tidak sedang dalam status di-flag.' }
    }

    // Penanganan Batasan Lifecycle Booking (Issue #18 Guard):
    if (resolutionAction === 'cancel_booking') {
      if (booking.status !== 'confirmed' && booking.status !== 'pending_payment') {
        return {
          error: `Pesanan berstatus '${booking.status}' tidak dapat dibatalkan secara sistemik karena unit telah/sedang disewakan. Resolusi harus berupa tindakan administratif/disipliner internal.`
        }
      }

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
          walkInReviewStatus: 'confirmed',
          walkInReviewNote: `${booking.walkInReviewNote ? `${booking.walkInReviewNote}\n` : ''}[Dibatalkan Pusat Karena Fraud oleh ${adminUser.name}]: ${resolutionNote.trim()}`,
          walkInReviewedBy: adminUser.id,
          walkInReviewedAt: new Date(),
        }
      })
    } else {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          walkInReviewStatus: 'confirmed',
          walkInReviewNote: `${booking.walkInReviewNote ? `${booking.walkInReviewNote}\n` : ''}[Resolusi Admin Pusat oleh ${adminUser.name}]: ${resolutionNote.trim()}`,
          walkInReviewedBy: adminUser.id,
          walkInReviewedAt: new Date(),
        }
      })
    }

    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: booking.pickupBranchId,
      action: resolutionAction === 'cancel_booking' ? 'booking.walk_in_flag_cancelled' : 'booking.walk_in_flag_resolved',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        resolutionAction,
        resolutionNote: resolutionNote.trim(),
        resolvedBy: adminUser.id,
        bookingStatus: booking.status,
      }
    })

    revalidatePath('/admin/bookings')
    revalidatePath(`/admin/bookings/${bookingId}`)
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem saat menyelesaikan eskalasi.' }
  }
}
