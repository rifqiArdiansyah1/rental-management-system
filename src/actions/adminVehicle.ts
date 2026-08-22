'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { VehicleStatus, Prisma } from '@prisma/client'

export async function createVehicle(data: {
  plateNumber: string
  categoryId: string
  branchId: string
  dailyRate: number
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak: Hanya Admin Pusat atau Admin Cabang yang berwenang menambah kendaraan.' }
    }

    const scope = await getStaffScope()
    assertInScope([data.branchId], scope)

    const normalizedPlate = data.plateNumber.replace(/\s+/g, '').toUpperCase()

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber: normalizedPlate,
        categoryId: data.categoryId,
        branchId: data.branchId,
        dailyRate: new Prisma.Decimal(data.dailyRate),
        status: 'available',
        isActive: true,
      }
    })

    return { success: true, vehicle }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: 'Plat nomor sudah terdaftar' }
    }
    console.error('Failed to create vehicle:', error)
    return { error: 'Terjadi kesalahan sistem' }
  }
}

export async function updateVehicle(id: string, data: {
  plateNumber: string
  categoryId: string
  branchId: string
  dailyRate: number
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role === 'staff_cabang') {
      return { error: 'Akses ditolak.' }
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

    await prisma.vehicle.update({
      where: { id },
      data: {
        plateNumber: normalizedPlate,
        categoryId: data.categoryId,
        branchId: data.branchId,
        dailyRate: new Prisma.Decimal(data.dailyRate),
      }
    })

    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2002') return { error: 'Plat nomor sudah terdaftar' }
    return { error: 'Terjadi kesalahan sistem' }
  }
}

export async function updateVehicleStatus(id: string, newStatus: VehicleStatus) {
  try {
    const adminUser = await requireAdminSession()
    
    // Check scope first
    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return { error: 'Kendaraan tidak ditemukan' }
    
    const scope = await getStaffScope()
    assertInScope([vehicle.branchId], scope)

    // Transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Find if there are active bookings
      const activeBookings = await tx.booking.count({
        where: {
          vehicleId: id,
          status: 'ongoing'
        }
      })

      if (activeBookings > 0 && newStatus !== 'rented') {
        throw new Error('Kendaraan sedang disewa (ongoing). Tidak dapat diubah statusnya.')
      }

      const updated = await tx.vehicle.update({
        where: { id },
        data: { status: newStatus }
      })

      return updated
    })

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

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem' }
  }
}
