'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'

export async function createBranch(data: {
  name: string
  city: string
  address: string
  phone: string
  openTime?: string
  closeTime?: string
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role !== 'admin_pusat') {
      return { error: 'Akses ditolak: Hanya Admin Pusat yang berwenang menambah cabang baru.' }
    }

    if (!data.name || data.name.trim() === '') {
      return { error: 'Nama cabang wajib diisi' }
    }

    if (!data.city || data.city.trim() === '') {
      return { error: 'Kota cabang wajib diisi' }
    }

    if (!data.address || data.address.trim() === '') {
      return { error: 'Alamat lengkap cabang wajib diisi' }
    }

    if (!data.phone || data.phone.trim() === '') {
      return { error: 'Nomor telepon cabang wajib diisi' }
    }

    const branch = await prisma.branch.create({
      data: {
        name: data.name.trim(),
        city: data.city.trim(),
        address: data.address.trim(),
        phone: data.phone.trim(),
        openTime: data.openTime?.trim() || '08:00',
        closeTime: data.closeTime?.trim() || '21:00',
        isActive: true,
      }
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: branch.id,
      action: 'branch.create',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: {
        name: branch.name,
        city: branch.city,
        address: branch.address,
        phone: branch.phone
      }
    })

    revalidatePath('/admin/branches')
    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/drivers')

    return { success: true, branch: JSON.parse(JSON.stringify(branch)) }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: 'Nama cabang sudah terdaftar di sistem' }
    }
    console.error('Failed to create branch:', error)
    return { error: 'Terjadi kesalahan sistem saat membuat cabang' }
  }
}

export async function updateBranch(id: string, data: {
  name: string
  city: string
  address: string
  phone: string
  openTime?: string
  closeTime?: string
}) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role !== 'admin_pusat') {
      return { error: 'Akses ditolak: Hanya Admin Pusat yang berwenang mengubah data cabang.' }
    }

    if (!data.name || data.name.trim() === '') {
      return { error: 'Nama cabang wajib diisi' }
    }

    if (!data.city || data.city.trim() === '') {
      return { error: 'Kota cabang wajib diisi' }
    }

    if (!data.address || data.address.trim() === '') {
      return { error: 'Alamat lengkap cabang wajib diisi' }
    }

    if (!data.phone || data.phone.trim() === '') {
      return { error: 'Nomor telepon cabang wajib diisi' }
    }

    const existing = await prisma.branch.findUnique({ where: { id } })
    if (!existing) return { error: 'Cabang tidak ditemukan' }

    await prisma.branch.update({
      where: { id },
      data: {
        name: data.name.trim(),
        city: data.city.trim(),
        address: data.address.trim(),
        phone: data.phone.trim(),
        openTime: data.openTime?.trim() || existing.openTime,
        closeTime: data.closeTime?.trim() || existing.closeTime,
      }
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: id,
      action: 'branch.update',
      entityType: 'Branch',
      entityId: id,
      metadata: {
        before: {
          name: existing.name,
          city: existing.city,
          address: existing.address,
          phone: existing.phone,
          openTime: existing.openTime,
          closeTime: existing.closeTime
        },
        after: {
          name: data.name.trim(),
          city: data.city.trim(),
          address: data.address.trim(),
          phone: data.phone.trim(),
          openTime: data.openTime?.trim() || existing.openTime,
          closeTime: data.closeTime?.trim() || existing.closeTime
        }
      }
    })

    revalidatePath('/admin/branches')
    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/drivers')

    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: 'Nama cabang sudah terdaftar di sistem' }
    }
    console.error('Failed to update branch:', error)
    return { error: 'Terjadi kesalahan sistem saat memperbarui cabang' }
  }
}

export async function softDeleteBranch(id: string, isActive: boolean) {
  try {
    const adminUser = await requireAdminSession()
    if (adminUser.role !== 'admin_pusat') {
      return { error: 'Akses ditolak: Hanya Admin Pusat yang berwenang menonaktifkan cabang.' }
    }

    const existing = await prisma.branch.findUnique({ where: { id } })
    if (!existing) return { error: 'Cabang tidak ditemukan' }

    // Execute atomic transaction for cascade validation guard
    await prisma.$transaction(async (tx) => {
      if (!isActive) {
        // 1. Check active vehicles
        const activeVehicles = await tx.vehicle.count({
          where: { branchId: id, isActive: true }
        })
        if (activeVehicles > 0) {
          throw new Error(`Tidak dapat menonaktifkan cabang. Masih ada ${activeVehicles} unit armada mobil aktif di cabang ini. Pindahkan atau nonaktifkan armada terlebih dahulu.`)
        }

        // 2. Check active drivers
        const activeDrivers = await tx.driver.count({
          where: { branchId: id, isActive: true }
        })
        if (activeDrivers > 0) {
          throw new Error(`Tidak dapat menonaktifkan cabang. Masih ada ${activeDrivers} orang sopir aktif di cabang ini. Pindahkan atau nonaktifkan sopir terlebih dahulu.`)
        }

        // 3. Check active bookings (pickup or return)
        const activeBookings = await tx.booking.count({
          where: {
            OR: [
              { pickupBranchId: id },
              { returnBranchId: id }
            ],
            status: { in: ['pending_payment', 'confirmed', 'ongoing'] }
          }
        })
        if (activeBookings > 0) {
          throw new Error(`Tidak dapat menonaktifkan cabang. Masih ada ${activeBookings} pesanan aktif yang melibatkan cabang ini sebagai lokasi pengambilan/pengembalian.`)
        }

        // 4. Check assigned staff/users
        const assignedStaff = await tx.user.count({
          where: { branchId: id }
        })
        if (assignedStaff > 0) {
          throw new Error(`Tidak dapat menonaktifkan cabang. Masih ada ${assignedStaff} staf terdaftar pada cabang ini. Pindahkan staf terlebih dahulu.`)
        }
      }

      return tx.branch.update({
        where: { id },
        data: { isActive }
      })
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: id,
      action: 'branch.status_change',
      entityType: 'Branch',
      entityId: id,
      metadata: {
        name: existing.name,
        city: existing.city,
        isActive
      }
    })

    revalidatePath('/admin/branches')
    revalidatePath('/admin/vehicles')
    revalidatePath('/admin/drivers')

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem' }
  }
}
