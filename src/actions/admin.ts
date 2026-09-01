'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import { revalidatePath } from 'next/cache'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { sendDriverReassignedEmail } from '@/utils/email'
import { logAudit } from '@/lib/audit'

// Valid roles
const VALID_ROLES = ['staff_cabang', 'admin_cabang', 'admin_pusat']

/**
 * Memastikan sesi admin valid dan mengembalikan data User dari DB
 * (untuk memastikan branchId akurat).
 */
export async function requireAdminSession() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    throw new Error('Unauthorized')
  }

  // Verifikasi JWT Role
  if (!VALID_ROLES.includes(authUser.app_metadata.role)) {
    throw new Error('Forbidden: Invalid Role')
  }

  // Ambil data User dari database untuk mendapatkan branchId yang akurat
  const user = await prisma.user.findUnique({
    where: { id: authUser.id }
  })

  if (!user) {
    throw new Error('User record not found')
  }

  if (!user.isActive) {
    throw new Error('Akun Anda dinonaktifkan. Hubungi Admin Pusat untuk informasi lebih lanjut.')
  }

  return user
}

export async function startRental(bookingId: string) {
  try {
    const scope = await getStaffScope()

    // 1. Dapatkan informasi Booking beserta Customer-nya
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true }
    })

    if (!booking) {
      return { error: 'Pesanan tidak ditemukan.' }
    }

    try {
      assertInScope([booking.pickupBranchId], scope)
    } catch (err: any) {
      return { error: err.message }
    }

    if (booking.status !== 'confirmed') {
      return { error: 'Status pesanan tidak valid untuk memulai sewa.' }
    }

    // 2. Pre-kondisi KYC Customer
    if (booking.customer.verificationStatus !== 'verified') {
      return { error: 'Kunci tidak dapat diserahkan. Identitas pelanggan (KTP/SIM) belum diverifikasi.' }
    }

    // 3. Pre-kondisi Penugasan Sopir
    if (booking.rentalType === 'with_driver') {
      if (!booking.driverId || !['assigned', 'confirmed'].includes(booking.driverAssignmentStatus || '')) {
        return { error: 'Tugaskan sopir terlebih dahulu sebelum memulai sewa.' }
      }
    }

    // 4. Eksekusi Atomik (Transaction + updateMany guards)
    await prisma.$transaction(async (tx) => {
      // Ubah status Booking (Guard: pastikan masih 'confirmed')
      const bookingUpdate = await tx.booking.updateMany({
        where: { id: bookingId, status: 'confirmed' },
        data: { status: 'ongoing' }
      })

      if (bookingUpdate.count === 0) {
        throw new Error('Pesanan sudah diproses oleh staf lain.')
      }

      // Ubah status Kendaraan (Guard: pastikan masih 'available')
      const vehicleUpdate = await tx.vehicle.updateMany({
        where: { id: booking.vehicleId, status: 'available' },
        data: { status: 'rented' }
      })

      if (vehicleUpdate.count === 0) {
        throw new Error('Kendaraan tidak berstatus available (mungkin sedang maintenance atau sudah disewa).')
      }

      // Ubah status Sopir (jika with_driver)
      if (booking.rentalType === 'with_driver' && booking.driverId) {
        const driverUpdate = await tx.driver.updateMany({
          where: { id: booking.driverId, status: 'available' },
          data: { status: 'on_trip' }
        })

        if (driverUpdate.count === 0) {
          throw new Error('Sopir tidak tersedia untuk perjalanan (mungkin sudah on_trip).')
        }
      }
    })

    const adminUser = await requireAdminSession()
    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: booking.pickupBranchId,
      action: 'rental.start',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        vehicleId: booking.vehicleId,
        driverId: booking.driverId,
        startedAt: new Date().toISOString()
      }
    })

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem.' }
  }
}

export async function endRental(bookingId: string) {
  try {
    const scope = await getStaffScope()

    // 1. Dapatkan informasi Booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    })

    if (!booking) {
      return { error: 'Pesanan tidak ditemukan.' }
    }

    try {
      assertInScope([booking.pickupBranchId, booking.returnBranchId], scope)
    } catch (err: any) {
      return { error: err.message }
    }

    if (booking.status !== 'ongoing') {
      return { error: 'Hanya pesanan yang sedang berjalan (ongoing) yang dapat diselesaikan.' }
    }

    // 2. Eksekusi Atomik
    await prisma.$transaction(async (tx) => {
      // Ubah status Booking (Guard: pastikan masih 'ongoing')
      const bookingUpdate = await tx.booking.updateMany({
        where: { id: bookingId, status: 'ongoing' },
        data: { status: 'completed' }
      })

      if (bookingUpdate.count === 0) {
        throw new Error('Pesanan sudah diproses oleh staf lain.')
      }

      // Ubah status Kendaraan kembali menjadi 'available'
      // Guard: pastikan statusnya 'rented' sebelum dikembalikan
      const vehicleUpdate = await tx.vehicle.updateMany({
        where: { id: booking.vehicleId, status: 'rented' },
        data: { status: 'available' } // Di real world bisa jadi 'maintenance' dsb.
      })

      if (vehicleUpdate.count === 0) {
        throw new Error('Inkonsistensi data kendaraan (tidak berstatus rented).')
      }

      // Ubah status Sopir kembali menjadi 'available' (jika with_driver)
      if (booking.rentalType === 'with_driver' && booking.driverId) {
        const driverUpdate = await tx.driver.updateMany({
          where: { id: booking.driverId, status: 'on_trip' },
          data: { status: 'available' }
        })

        if (driverUpdate.count === 0) {
          throw new Error('Inkonsistensi data sopir (tidak berstatus on_trip).')
        }
      }
    })

    const adminUser = await requireAdminSession()
    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: booking.returnBranchId ?? booking.pickupBranchId,
      action: 'rental.end',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        vehicleId: booking.vehicleId,
        driverId: booking.driverId,
        endedAt: new Date().toISOString()
      }
    })

    revalidatePath('/admin/bookings')
    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/dashboard')

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem.' }
  }
}


import { sendDocumentStatusEmail } from '@/utils/email'

export async function verifyDocument(documentId: string, status: 'verified' | 'rejected', reason?: string) {
  try {
    const scope = await getStaffScope()
    
    // Find the document and its customer
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { customer: true }
    })
    
    if (!document) return { error: 'Dokumen tidak ditemukan.' }
    
    const customerId = document.customerId
    if (!customerId || !document.customer) return { error: 'Dokumen tidak terkait dengan pelanggan manapun.' }
    
    // Check branch scope: Admin needs to have at least one ACTIVE booking with this customer in their branch
    if (scope.scope === 'branch') {
      const activeBooking = await prisma.booking.findFirst({
        where: { 
          customerId: customerId, 
          pickupBranchId: scope.branchId,
          status: { in: ['pending_payment', 'confirmed', 'ongoing'] }
        }
      })
      if (!activeBooking) {
        return { error: 'Akses ditolak: Anda hanya dapat memverifikasi pelanggan yang sedang memiliki pesanan aktif di cabang Anda.' }
      }
    }
    
    await prisma.$transaction(async (tx) => {
      if (status === 'verified') {
        await tx.document.update({
          where: { id: documentId },
          data: { verifiedAt: new Date() }
        })
      } else {
        await tx.document.update({
          where: { id: documentId },
          data: { verifiedAt: null }
        })
      }
      
      const allCustomerDocs = await tx.document.findMany({
        where: { customerId }
      })
      
      const hasVerifiedKTP = allCustomerDocs.some(d => d.type.toLowerCase() === 'ktp' && d.verifiedAt !== null)
      const hasVerifiedSIM = allCustomerDocs.some(d => d.type.toLowerCase() === 'sim' && d.verifiedAt !== null)
      
      if (hasVerifiedKTP && hasVerifiedSIM) {
        await tx.customer.update({
          where: { id: customerId },
          data: { verificationStatus: 'verified' }
        })
      } else {
        await tx.customer.update({
          where: { id: customerId },
          data: { verificationStatus: status === 'rejected' ? 'rejected' : 'pending' }
        })
      }
    })
    
    try {
      await sendDocumentStatusEmail({
        toEmail: document.customer.email,
        customerName: document.customer.name,
        status: status,
        reason: reason
      })
    } catch (e) {
      console.error('Failed to send document status email:', e)
    }

    const adminUser = await requireAdminSession()
    const targetBooking = await prisma.booking.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' }
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: targetBooking?.pickupBranchId ?? null,
      action: 'document.verify',
      entityType: 'Customer',
      entityId: customerId,
      metadata: {
        documentId: document.id,
        documentType: document.type,
        status,
        reason: reason || null
      }
    })
    
    revalidatePath('/admin/bookings')
    // We will revalidate specific booking ID path in client by calling useRouter().refresh() or we can revalidate all bookings detail
    
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem saat memverifikasi dokumen.' }
  }
}

export async function assignDriver(bookingId: string, driverId: string, reason?: string) {
  try {
    const adminUser = await requireAdminSession()
    const scope = await getStaffScope()
    
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        driver: true
      }
    })
    
    if (!booking) return { error: 'Pesanan tidak ditemukan.' }

    try {
      assertInScope([booking.pickupBranchId], scope)
    } catch (err: any) {
      return { error: err.message }
    }

    // 1. Guard tipe sewa
    if (booking.rentalType !== 'with_driver') {
      return { error: 'Pesanan ini bertipe Lepas Kunci (self-drive) dan tidak memerlukan sopir.' }
    }

    // 2. Guard status pesanan
    if (booking.status === 'pending_payment') {
      return { error: 'Sopir hanya dapat ditugaskan setelah pembayaran pesanan terkonfirmasi (status confirmed).' }
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return { error: 'Tidak dapat menugaskan atau mengganti sopir pada pesanan yang sudah selesai atau dibatalkan.' }
    }

    // 3. Guard identitas sopir yang sama
    if (booking.driverId === driverId) {
      return { error: 'Sopir ini sudah ditugaskan pada pesanan ini.' }
    }

    const isReassignment = !!booking.driverId
    const oldDriverId = booking.driverId
    const oldDriverName = booking.driver?.name
    let newDriverInfo: { name: string; phone: string } | null = null

    // 4. Eksekusi transaksi atomik anti-TOCTOU & deadlock-free
    await prisma.$transaction(async (tx) => {
      // a. Verifikasi status terkini dari Booking (optimistic concurrency guard)
      const currentBooking = await tx.booking.findUnique({
        where: { id: bookingId }
      })
      if (!currentBooking) throw new Error('Pesanan tidak ditemukan.')
      if (!['confirmed', 'ongoing'].includes(currentBooking.status)) {
        throw new Error('Status pesanan telah berubah oleh proses lain. Silakan muat ulang halaman.')
      }

      // b. Deadlock-free deterministic row locking
      const idsToLock = [oldDriverId, driverId].filter(Boolean) as string[]
      idsToLock.sort()
      for (const id of idsToLock) {
        await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${id} FOR UPDATE`
      }

      // c. Ambil dan validasi sopir baru
      const newDriver = await tx.driver.findUnique({
        where: { id: driverId }
      })

      if (!newDriver) throw new Error('Sopir tidak ditemukan.')
      if (!newDriver.isActive) throw new Error('Sopir berstatus nonaktif dan tidak dapat ditugaskan.')
      if (newDriver.branchId !== currentBooking.pickupBranchId) {
        throw new Error('Akses ditolak: Sopir tidak berada di cabang yang sama dengan lokasi pengambilan pesanan.')
      }

      // d. Jika booking ongoing, sopir baru WAJIB saat ini berstatus 'available'
      if (currentBooking.status === 'ongoing' && newDriver.status !== 'available') {
        throw new Error('Sopir baru tidak dalam status tersedia (available) untuk langsung melakukan perjalanan.')
      }

      newDriverInfo = { name: newDriver.name, phone: newDriver.phone }

      // e. Hitung rentang waktu efektif
      // Untuk booking ongoing, perjalanan sudah berjalan, evaluasi dari 'now' ke endDate
      const effectiveStart = currentBooking.status === 'ongoing' ? new Date() : currentBooking.startDate
      const bufferEnd = new Date(currentBooking.endDate.getTime() + 3 * 60 * 60 * 1000)
      const bufferStart = new Date(effectiveStart.getTime() - 3 * 60 * 60 * 1000)

      // f. Cek overlap DriverLeave menggunakan effectiveStart
      const conflictingLeave = await tx.driverLeave.findFirst({
        where: {
          driverId: driverId,
          startDate: { lt: currentBooking.endDate },
          endDate: { gt: effectiveStart }
        }
      })

      if (conflictingLeave) {
        throw new Error('Sopir sedang dalam jadwal cuti/libur pada rentang waktu pesanan ini.')
      }

      // g. Cek overlap booking aktif lain menggunakan buffer 3 jam
      const conflictingBooking = await tx.booking.findFirst({
        where: {
          id: { not: bookingId },
          driverId: driverId,
          status: { in: ['pending_payment', 'confirmed', 'ongoing'] },
          startDate: { lt: bufferEnd },
          endDate: { gt: bufferStart }
        }
      })

      if (conflictingBooking) {
        throw new Error('Sopir ini sudah ditugaskan pada pesanan lain di jadwal yang beririsan.')
      }

      // h. Sinkronisasi status operasional Driver
      if (currentBooking.status === 'ongoing') {
        // Sopir lama dikembalikan ke 'available' jika tadinya 'on_trip'
        if (oldDriverId) {
          await tx.driver.updateMany({
            where: { id: oldDriverId, status: 'on_trip' },
            data: { status: 'available' }
          })
        }

        // Sopir baru dialihkan menjadi 'on_trip'
        const newDriverUpdate = await tx.driver.updateMany({
          where: { id: driverId, status: 'available' },
          data: { status: 'on_trip' }
        })

        if (newDriverUpdate.count === 0) {
          throw new Error('Gagal memperbarui status sopir baru (sopir mungkin sudah tidak berstatus available).')
        }
      }
      // Jika status confirmed: kedua sopir tetap berstatus 'available' (startRental nanti yang akan mengubah status ke on_trip)

      // i. Update Booking row secara atomik dengan optimistic locking
      const updateResult = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: currentBooking.status,
          driverId: currentBooking.driverId
        },
        data: {
          driverId: driverId,
          driverAssignmentStatus: 'assigned',
          ...(isReassignment ? {
            reassignedBy: adminUser.id,
            reassignmentReason: reason?.trim() || null,
            reassignedAt: new Date()
          } : {})
        }
      })

      if (updateResult.count === 0) {
        throw new Error('Status pesanan atau sopir telah berubah oleh proses lain. Silakan muat ulang halaman.')
      }
    }, {
      maxWait: 10000,
      timeout: 20000
    })

    // 5. Notifikasi Email ke Pelanggan (khusus reassignment atau booking ongoing)
    if (isReassignment && booking.customer && newDriverInfo) {
      const driverData = newDriverInfo as { name: string; phone: string }
      // Non-blocking fire-and-forget email so network latency doesn't stall the UI response
      sendDriverReassignedEmail({
        toEmail: booking.customer.email,
        customerName: booking.customer.name,
        bookingId: booking.id,
        oldDriverName: oldDriverName,
        newDriverName: driverData.name,
        newDriverPhone: driverData.phone,
        isOngoing: booking.status === 'ongoing',
        reason: reason?.trim()
      }).catch((err) => {
        console.error('[Email Error] Failed to send driver reassigned email:', err)
      })
    }

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: booking.pickupBranchId,
      action: isReassignment ? 'driver.reassign' : 'driver.assign',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        oldDriverId: oldDriverId || null,
        newDriverId: driverId,
        reason: reason?.trim() || null,
        isReassignment,
        bookingStatus: booking.status
      }
    })

    // 6. Revalidasi Cache Mendalam (Admin dan Customer)
    revalidatePath('/admin/bookings')
    revalidatePath('/admin/bookings/[id]', 'page')
    revalidatePath(`/admin/bookings/${bookingId}`)
    revalidatePath('/admin/drivers')
    revalidatePath(`/booking/${bookingId}`)
    revalidatePath('/dashboard')

    return { success: true }
  } catch (error: any) {
    if (error.message && error.message.includes('booking_driver_no_overlap')) {
      return { error: 'Sopir ini sudah ditugaskan pada pesanan lain di jadwal yang beririsan.' }
    }
    return { error: error.message || 'Terjadi kesalahan saat menugaskan sopir.' }
  }
}

export async function adminCancelBooking(bookingId: string, reason: string, rejectCustomerDoc: boolean = false, sendEmail: boolean = true) {
  try {
    const adminUser = await requireAdminSession()
    
    // RBAC: Only admin_cabang or admin_pusat can manually cancel
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Hanya Admin Cabang atau Admin Pusat yang berwenang membatalkan pesanan.' }
    }

    if (!reason || reason.trim().length === 0) {
      return { error: 'Alasan pembatalan wajib diisi.' }
    }

    const scope = await getStaffScope()
    
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    })
    
    if (!booking) return { error: 'Pesanan tidak ditemukan.' }

    try {
      assertInScope([booking.pickupBranchId], scope)
    } catch (err: any) {
      return { error: err.message }
    }
    
    // Gunakan updateMany untuk menjamin atomisitas dan mencegah race condition
    const updateResult = await prisma.booking.updateMany({
      where: { 
        id: bookingId,
        status: { in: ['pending_payment', 'confirmed'] }
      },
      data: { 
        status: 'cancelled',
        cancellationNote: reason.trim(),
        cancelledBy: adminUser.id
      }
    })

    if (updateResult.count === 0) {
      return { error: 'Pembatalan gagal: Pesanan sedang berjalan, sudah selesai, sudah dibatalkan, atau Anda tidak memiliki akses.' }
    }

    // Optional: Reject customer verification
    if (rejectCustomerDoc && booking.customerId) {
      await prisma.customer.update({
        where: { id: booking.customerId },
        data: { verificationStatus: 'rejected' }
      })
    }
    
    // Optional: Send email
    if (sendEmail) {
      // Di sini idealnya memanggil servis email, misalnya sendDocumentStatusEmail
      // Untuk MVP kita abaikan implementasi aktual pengiriman email, cukup beri penanda
      console.log(`[Email Mock] Sending cancellation email to customer ${booking.customerId} for booking ${bookingId}`)
    }

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: booking.pickupBranchId,
      action: 'booking.cancel',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        reason: reason.trim(),
        previousStatus: booking.status,
        rejectCustomerDoc
      }
    })
    
    revalidatePath('/admin/bookings')
    revalidatePath(`/admin/bookings/${bookingId}`)
    
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan saat membatalkan pesanan.' }
  }
}

export async function markPaymentRefunded(paymentId: string) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Hanya Admin Cabang atau Admin Pusat yang berwenang menandai refund.' }
    }

    const scope = await getStaffScope()

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true }
    })

    if (!payment) return { error: 'Pembayaran tidak ditemukan.' }

    try {
      assertInScope([payment.booking.pickupBranchId], scope)
    } catch (err: any) {
      return { error: err.message }
    }

    if (payment.status !== 'success') {
      return { error: 'Hanya pembayaran yang berhasil (success) yang dapat di-refund.' }
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded' }
    })

    revalidatePath('/admin/bookings')
    revalidatePath(`/admin/bookings/${payment.bookingId}`)

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan saat memproses refund.' }
  }
}

