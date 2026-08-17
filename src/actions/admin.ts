'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import { revalidatePath } from 'next/cache'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'

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
    
    revalidatePath('/admin/bookings')
    // We will revalidate specific booking ID path in client by calling useRouter().refresh() or we can revalidate all bookings detail
    
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem saat memverifikasi dokumen.' }
  }
}

export async function assignDriver(bookingId: string, driverId: string) {
  try {
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

    // SERVER-SIDE CROSS-BRANCH VALIDATION: Ensure driver belongs to the same branch as the booking
    const driver = await prisma.driver.findUnique({
      where: { id: driverId }
    })

    if (!driver) return { error: 'Sopir tidak ditemukan.' }
    if (driver.branchId !== booking.pickupBranchId) {
      return { error: 'Akses ditolak: Sopir tidak berada di cabang yang sama dengan lokasi pengambilan pesanan.' }
    }
    
    if (booking.rentalType !== 'with_driver') return { error: 'Pesanan ini tidak memerlukan sopir.' }
    if (booking.status === 'ongoing' || booking.status === 'completed') {
      return { error: 'Tidak dapat menugaskan sopir pada pesanan yang sudah berjalan/selesai.' }
    }
    
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        driverId: driverId,
        driverAssignmentStatus: 'assigned'
      }
    })
    
    revalidatePath('/admin/bookings')
    
    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2010' || (error.message && (error.message.includes('23P01') || error.message.includes('booking_driver_no_overlap')))) {
      return { error: 'Sopir ini sudah ditugaskan di jadwal yang beririsan.' }
    }
    return { error: error.message || 'Terjadi kesalahan saat menugaskan sopir.' }
  }
}

export async function cancelBooking(bookingId: string) {
  try {
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
    
    if (booking.status === 'ongoing' || booking.status === 'completed' || booking.status === 'cancelled') {
      return { error: 'Hanya pesanan yang belum berjalan yang dapat dibatalkan.' }
    }
    
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'cancelled' }
    })
    
    revalidatePath('/admin/bookings')
    
    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan saat membatalkan pesanan.' }
  }
}

