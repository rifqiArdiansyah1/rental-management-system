'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import { revalidatePath } from 'next/cache'

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
    const adminUser = await requireAdminSession()
    
    // Scoping query: Admin Pusat bisa akses semua, Staf/Admin Cabang hanya cabangnya
    const branchScope = adminUser.branchId ? { pickupBranchId: adminUser.branchId } : {}

    // 1. Dapatkan informasi Booking beserta Customer-nya
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        ...branchScope
      },
      include: { customer: true }
    })

    if (!booking) {
      return { error: 'Pesanan tidak ditemukan atau Anda tidak memiliki akses ke cabang ini.' }
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
    const adminUser = await requireAdminSession()
    
    // Scoping query: Admin Pusat bisa akses semua, Staf/Admin Cabang hanya cabangnya
    // Saat Selesai Sewa, kita biasanya mengembalikan mobil ke `returnBranchId`.
    // Kita filter agar staf cabang pengembalian (atau pengambilan) yang berhak klik "Selesai".
    // Disini kita batasi staf cabang pickup atau return.
    const branchScope = adminUser.branchId ? {
      OR: [
        { pickupBranchId: adminUser.branchId },
        { returnBranchId: adminUser.branchId }
      ]
    } : {}

    // 1. Dapatkan informasi Booking
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        ...branchScope
      }
    })

    if (!booking) {
      return { error: 'Pesanan tidak ditemukan atau Anda tidak memiliki akses ke pesanan ini.' }
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
