'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { VehicleStatus, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { MIN_VEHICLE_DAILY_RATE } from '@/lib/constants'

export async function createVehicle(data: {
  name: string
  plateNumber: string
  categoryId: string
  branchId: string
  dailyRate: number
  photos?: string[]
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Hanya Admin Pusat atau Admin Cabang yang berwenang menambah kendaraan.' }
    }

    if (!data.name || data.name.trim() === '') {
      return { error: 'Nama kendaraan wajib diisi' }
    }

    if (!data.dailyRate || Number(data.dailyRate) < MIN_VEHICLE_DAILY_RATE) {
      return { 
        error: `Tarif harian minimal ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(MIN_VEHICLE_DAILY_RATE)} per hari` 
      }
    }

    const scope = await getStaffScope()
    assertInScope([data.branchId], scope)

    const normalizedPlate = data.plateNumber.replace(/\s+/g, '').toUpperCase()

    const vehicle = await prisma.vehicle.create({
      data: {
        name: data.name.trim(),
        plateNumber: normalizedPlate,
        categoryId: data.categoryId,
        branchId: data.branchId,
        dailyRate: new Prisma.Decimal(data.dailyRate),
        photos: data.photos || [],
        status: 'available',
        isActive: true,
      }
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: data.branchId,
      action: 'vehicle.create',
      entityType: 'Vehicle',
      entityId: vehicle.id,
      metadata: {
        name: vehicle.name,
        plateNumber: vehicle.plateNumber,
        categoryId: vehicle.categoryId,
        branchId: vehicle.branchId,
        dailyRate: Number(vehicle.dailyRate)
      }
    })

    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/dashboard')
    revalidatePath('/')

    return { success: true, vehicle: JSON.parse(JSON.stringify(vehicle)) }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: 'Plat nomor sudah terdaftar' }
    }
    console.error('Failed to create vehicle:', error)
    return { error: 'Terjadi kesalahan sistem' }
  }
}

export async function updateVehicle(id: string, data: {
  name: string
  plateNumber: string
  categoryId: string
  branchId: string
  dailyRate: number
  photos?: string[]
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak.' }
    }

    if (!data.name || data.name.trim() === '') {
      return { error: 'Nama kendaraan wajib diisi' }
    }

    if (!data.dailyRate || Number(data.dailyRate) < MIN_VEHICLE_DAILY_RATE) {
      return { 
        error: `Tarif harian minimal ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(MIN_VEHICLE_DAILY_RATE)} per hari` 
      }
    }

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { 
        bookings: { 
          where: { status: { in: ['ongoing', 'confirmed', 'pending_payment'] } } 
        } 
      }
    })

    if (!existingVehicle) return { error: 'Kendaraan tidak ditemukan' }

    const scope = await getStaffScope()
    assertInScope([existingVehicle.branchId, data.branchId], scope)

    if (existingVehicle.branchId !== data.branchId && existingVehicle.bookings.length > 0) {
      return { error: 'Tidak dapat memindah cabang kendaraan yang memiliki pesanan aktif' }
    }

    const normalizedPlate = data.plateNumber.replace(/\s+/g, '').toUpperCase()

    // Note: status is strictly omitted from data update to prevent status bypass
    await prisma.vehicle.update({
      where: { id },
      data: {
        name: data.name.trim(),
        plateNumber: normalizedPlate,
        categoryId: data.categoryId,
        branchId: data.branchId,
        dailyRate: new Prisma.Decimal(data.dailyRate),
        photos: data.photos || [],
      }
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: data.branchId ?? existingVehicle.branchId,
      action: 'vehicle.update',
      entityType: 'Vehicle',
      entityId: id,
      metadata: {
        before: {
          name: existingVehicle.name,
          plateNumber: existingVehicle.plateNumber,
          categoryId: existingVehicle.categoryId,
          branchId: existingVehicle.branchId,
          dailyRate: Number(existingVehicle.dailyRate)
        },
        after: {
          name: data.name.trim(),
          plateNumber: normalizedPlate,
          categoryId: data.categoryId,
          branchId: data.branchId,
          dailyRate: Number(data.dailyRate)
        }
      }
    })

    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/dashboard')
    revalidatePath('/')
    revalidatePath(`/vehicles/${id}`)
    revalidatePath(`/vehicles/${id}/book`)

    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2002') return { error: 'Plat nomor sudah terdaftar' }
    return { error: 'Terjadi kesalahan sistem' }
  }
}

export async function updateVehicleStatus(id: string, newStatus: VehicleStatus) {
  try {
    const adminUser = await requireAdminSession()
    
    // 1. Larangan mutlak transisi manual ke status 'rented'
    if (newStatus === 'rented') {
      return { error: 'Status "Disewa (Rented)" dikelola otomatis oleh sistem saat Mulai Sewa di Manajemen Pesanan.' }
    }

    // 2. Check scope first
    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return { error: 'Kendaraan tidak ditemukan' }
    
    const scope = await getStaffScope()
    assertInScope([vehicle.branchId], scope)

    // 3. Eksekusi atomik anti-TOCTOU dengan validasi ketat
    await prisma.$transaction(async (tx) => {
      const currentVehicle = await tx.vehicle.findUnique({ where: { id } })
      if (!currentVehicle) {
        throw new Error('Kendaraan tidak ditemukan.')
      }

      // Guard mobil nonaktif
      if (!currentVehicle.isActive) {
        throw new Error('Kendaraan nonaktif tidak dapat diubah status operasionalnya. Aktifkan kendaraan terlebih dahulu.')
      }

      // Guard mobil sedang disewa (ongoing booking OR status DB saat ini rented)
      const activeOngoing = await tx.booking.count({
        where: {
          vehicleId: id,
          status: 'ongoing'
        }
      })

      if (activeOngoing > 0 || currentVehicle.status === 'rented') {
        throw new Error('Kendaraan sedang dalam masa sewa aktif (ongoing). Status tidak dapat diubah secara manual.')
      }

      // Guard jendela bergulir 24 jam untuk status maintenance atau moved
      if (newStatus === 'maintenance' || newStatus === 'moved') {
        const now = new Date()
        const rolling24h = new Date(Date.now() + 24 * 60 * 60 * 1000)

        const conflictingBookings = await tx.booking.count({
          where: {
            vehicleId: id,
            status: { in: ['confirmed', 'pending_payment'] },
            startDate: { lte: rolling24h },
            endDate: { gte: now }
          }
        })

        if (conflictingBookings > 0) {
          throw new Error('Kendaraan memiliki jadwal sewa (confirmed/pending) dalam 24 jam ke depan. Selesaikan atau alihkan pesanan terlebih dahulu.')
        }
      }

      // Update bersyarat atomik (mencegah TOCTOU race condition)
      const updateResult = await tx.vehicle.updateMany({
        where: { id, status: currentVehicle.status },
        data: { status: newStatus }
      })

      if (updateResult.count === 0) {
        throw new Error('Status kendaraan telah berubah oleh proses lain. Silakan muat ulang halaman.')
      }
    }, {
      maxWait: 10000,
      timeout: 20000
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: vehicle.branchId,
      action: 'vehicle.status_change',
      entityType: 'Vehicle',
      entityId: id,
      metadata: {
        plateNumber: vehicle.plateNumber,
        oldStatus: vehicle.status,
        newStatus
      }
    })

    // 4. Revalidasi cache mendalam
    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/bookings')
    revalidatePath('/')
    revalidatePath(`/vehicles/${id}`)
    revalidatePath(`/vehicles/${id}/book`)

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem' }
  }
}

export async function softDeleteVehicle(id: string, isActive: boolean) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak.' }
    }
    
    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return { error: 'Kendaraan tidak ditemukan' }
    
    const scope = await getStaffScope()
    assertInScope([vehicle.branchId], scope)

    const result = await prisma.$transaction(async (tx) => {
      if (!isActive) {
        const activeBookings = await tx.booking.count({
          where: {
            vehicleId: id,
            status: { in: ['ongoing', 'confirmed', 'pending_payment'] }
          }
        })
  
        if (activeBookings > 0) {
          throw new Error('Tidak dapat menonaktifkan kendaraan yang memiliki pesanan aktif.')
        }
      }

      const updated = await tx.vehicle.update({
        where: { id },
        data: { isActive }
      })

      return updated
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: vehicle.branchId,
      action: 'vehicle.delete',
      entityType: 'Vehicle',
      entityId: id,
      metadata: {
        plateNumber: vehicle.plateNumber,
        name: vehicle.name,
        isActive
      }
    })

    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/bookings')
    revalidatePath('/')
    revalidatePath(`/vehicles/${id}`)
    revalidatePath(`/vehicles/${id}/book`)

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem' }
  }
}
