'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { DriverStatus, Prisma } from '@prisma/client'

export async function createDriver(data: {
  name: string
  phone: string
  licenseNumber: string
  branchId: string
  dailyFee: number
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Hanya Admin Pusat atau Admin Cabang yang berwenang menambah sopir.' }
    }

    if (!data.name || data.name.trim() === '') {
      return { error: 'Nama sopir wajib diisi' }
    }

    if (!data.phone || data.phone.trim() === '') {
      return { error: 'Nomor telepon sopir wajib diisi' }
    }

    if (!data.licenseNumber || data.licenseNumber.trim() === '') {
      return { error: 'Nomor SIM sopir wajib diisi' }
    }

    const scope = await getStaffScope()
    assertInScope([data.branchId], scope)

    let normalizedLicense = data.licenseNumber.trim().toUpperCase().replace(/\s+/g, '-')
    if (!normalizedLicense.startsWith('SIM-')) {
      normalizedLicense = `SIM-A-${normalizedLicense}`
    }
    if (/^SIM-[AB0-9]+-?$/.test(normalizedLicense) || normalizedLicense.endsWith('-')) {
      return { error: 'Nomor atau indeks SIM wajib diisi lengkap (misal: SIM-A-001)' }
    }

    const driver = await prisma.driver.create({
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        licenseNumber: normalizedLicense,
        branchId: data.branchId,
        dailyFee: new Prisma.Decimal(data.dailyFee),
        status: 'available',
        isActive: true,
      }
    })

    return { success: true, driver: JSON.parse(JSON.stringify(driver)) }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: 'Nomor SIM sudah terdaftar di sistem' }
    }
    console.error('Failed to create driver:', error)
    return { error: 'Terjadi kesalahan sistem' }
  }
}

export async function updateDriver(id: string, data: {
  name: string
  phone: string
  licenseNumber: string
  branchId: string
  dailyFee: number
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak.' }
    }

    if (!data.name || data.name.trim() === '') {
      return { error: 'Nama sopir wajib diisi' }
    }

    if (!data.licenseNumber || data.licenseNumber.trim() === '') {
      return { error: 'Nomor SIM sopir wajib diisi' }
    }

    const existingDriver = await prisma.driver.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { status: { in: ['ongoing', 'confirmed', 'pending_payment'] } }
        }
      }
    })

    if (!existingDriver) return { error: 'Sopir tidak ditemukan' }

    const scope = await getStaffScope()
    assertInScope([existingDriver.branchId, data.branchId], scope)

    if (existingDriver.branchId !== data.branchId && existingDriver.bookings.length > 0) {
      return { error: 'Tidak dapat memindah cabang sopir yang memiliki pesanan aktif' }
    }

    let normalizedLicense = data.licenseNumber.trim().toUpperCase().replace(/\s+/g, '-')
    if (!normalizedLicense.startsWith('SIM-')) {
      normalizedLicense = `SIM-A-${normalizedLicense}`
    }
    if (/^SIM-[AB0-9]+-?$/.test(normalizedLicense) || normalizedLicense.endsWith('-')) {
      return { error: 'Nomor atau indeks SIM wajib diisi lengkap (misal: SIM-A-001)' }
    }

    await prisma.driver.update({
      where: { id },
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        licenseNumber: normalizedLicense,
        branchId: data.branchId,
        dailyFee: new Prisma.Decimal(data.dailyFee),
      }
    })

    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2002') return { error: 'Nomor SIM sudah terdaftar di sistem' }
    console.error('Failed to update driver:', error)
    return { error: 'Terjadi kesalahan sistem' }
  }
}

export async function updateDriverStatus(id: string, newStatus: DriverStatus) {
  try {
    await requireAdminSession()

    const driver = await prisma.driver.findUnique({ where: { id } })
    if (!driver) return { error: 'Sopir tidak ditemukan' }

    const scope = await getStaffScope()
    assertInScope([driver.branchId], scope)

    const result = await prisma.$transaction(async (tx) => {
      // Guard: Cannot set to off_duty or available if driver is currently on_trip
      const activeTrip = await tx.booking.count({
        where: {
          driverId: id,
          status: 'ongoing'
        }
      })

      if (activeTrip > 0 && newStatus !== 'on_trip') {
        throw new Error('Sopir sedang bertugas (on_trip). Status tidak dapat diubah.')
      }

      return tx.driver.update({
        where: { id },
        data: { status: newStatus }
      })
    })

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem' }
  }
}

export async function softDeleteDriver(id: string, isActive: boolean) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak.' }
    }

    const driver = await prisma.driver.findUnique({ where: { id } })
    if (!driver) return { error: 'Sopir tidak ditemukan' }

    const scope = await getStaffScope()
    assertInScope([driver.branchId], scope)

    await prisma.$transaction(async (tx) => {
      if (!isActive) {
        const activeBookings = await tx.booking.count({
          where: {
            driverId: id,
            status: { in: ['ongoing', 'confirmed', 'pending_payment'] }
          }
        })

        if (activeBookings > 0) {
          throw new Error('Tidak dapat menonaktifkan sopir yang memiliki pesanan aktif atau sedang bertugas.')
        }
      }

      return tx.driver.update({
        where: { id },
        data: { isActive }
      })
    })

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem' }
  }
}

export async function createDriverLeave(data: {
  driverId: string
  startDate: string
  endDate: string
  reason?: string
}) {
  try {
    await requireAdminSession()

    const start = new Date(data.startDate)
    const end = new Date(data.endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { error: 'Format tanggal cuti tidak valid' }
    }

    if (end <= start) {
      return { error: 'Tanggal selesai cuti harus setelah tanggal mulai' }
    }

    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } })
    if (!driver) return { error: 'Sopir tidak ditemukan' }

    const scope = await getStaffScope()
    assertInScope([driver.branchId], scope)

    // Transaction with pessimistic row locking on Driver
    await prisma.$transaction(async (tx) => {
      // Lock driver row
      await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${data.driverId} FOR UPDATE`

      // 1. Check for overlapping active bookings assigned to this driver
      const conflictingBooking = await tx.booking.findFirst({
        where: {
          driverId: data.driverId,
          status: { in: ['pending_payment', 'confirmed', 'ongoing'] },
          startDate: { lt: end },
          endDate: { gt: start }
        },
        select: { id: true, startDate: true, endDate: true }
      })

      if (conflictingBooking) {
        throw new Error(
          `Sopir sudah ditugaskan pada pesanan aktif (#${conflictingBooking.id.substring(0, 8)}) pada rentang tanggal tersebut.`
        )
      }

      // 2. Check for overlapping existing leave
      const conflictingLeave = await tx.driverLeave.findFirst({
        where: {
          driverId: data.driverId,
          startDate: { lt: end },
          endDate: { gt: start }
        }
      })

      if (conflictingLeave) {
        throw new Error('Jadwal cuti bertabrakan dengan jadwal cuti lain yang sudah terdaftar.')
      }

      // 3. Create leave record
      await tx.driverLeave.create({
        data: {
          driverId: data.driverId,
          startDate: start,
          endDate: end,
          reason: data.reason?.trim() || null
        }
      })
    })

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan saat mendaftarkan cuti' }
  }
}

export async function deleteDriverLeave(leaveId: string) {
  try {
    await requireAdminSession()

    const leave = await prisma.driverLeave.findUnique({
      where: { id: leaveId },
      include: { driver: true }
    })

    if (!leave) return { error: 'Jadwal cuti tidak ditemukan' }

    const scope = await getStaffScope()
    assertInScope([leave.driver.branchId], scope)

    // Audit protection: Cannot delete past leave (endDate < now)
    const now = new Date()
    if (new Date(leave.endDate) < now) {
      return { error: 'Tidak dapat menghapus riwayat cuti yang sudah selesai/lampau.' }
    }

    await prisma.driverLeave.delete({
      where: { id: leaveId }
    })

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan saat menghapus cuti' }
  }
}

export async function getDriverLeaves(driverId: string) {
  try {
    await requireAdminSession()

    const driver = await prisma.driver.findUnique({ where: { id: driverId } })
    if (!driver) return { error: 'Sopir tidak ditemukan' }

    const scope = await getStaffScope()
    assertInScope([driver.branchId], scope)

    const leaves = await prisma.driverLeave.findMany({
      where: { driverId },
      orderBy: { startDate: 'desc' }
    })

    return { success: true, leaves: JSON.parse(JSON.stringify(leaves)) }
  } catch (error: any) {
    return { error: error.message || 'Gagal memuat daftar cuti' }
  }
}
