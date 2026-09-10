'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { getStaffScope, assertInScope } from '@/lib/auth/scope'
import { VehicleStatus, Prisma, FuelType, UserRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { MIN_VEHICLE_DAILY_RATE, TURNOVER_BUFFER_MS } from '@/lib/constants'
import { checkIntervalOverlap } from '@/lib/booking'

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {
    // Gracefully ignore when invoked outside Next.js request context (e.g. unit/e2e tests)
  }
}

export async function createVehicle(data: {
  name: string
  plateNumber: string
  categoryId: string
  branchId: string
  dailyRate: number
  photos?: string[]
  fuelType?: FuelType
  fuelEfficiencyKmL?: number | null
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

    if (data.fuelEfficiencyKmL != null && data.fuelEfficiencyKmL !== undefined && (isNaN(Number(data.fuelEfficiencyKmL)) || Number(data.fuelEfficiencyKmL) <= 0)) {
      return { error: 'Efisiensi BBM harus berupa angka positif (km/liter).' }
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
        fuelType: data.fuelType || 'pertalite',
        fuelEfficiencyKmL: data.fuelEfficiencyKmL ? new Prisma.Decimal(data.fuelEfficiencyKmL) : null,
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
        dailyRate: Number(vehicle.dailyRate),
        fuelType: vehicle.fuelType,
        fuelEfficiencyKmL: vehicle.fuelEfficiencyKmL ? Number(vehicle.fuelEfficiencyKmL) : null,
      }
    })

    safeRevalidatePath('/admin/vehicles')
    safeRevalidatePath('/admin/dashboard')
    safeRevalidatePath('/')

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
  fuelType?: FuelType
  fuelEfficiencyKmL?: number | null
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

    if (data.fuelEfficiencyKmL != null && data.fuelEfficiencyKmL !== undefined && (isNaN(Number(data.fuelEfficiencyKmL)) || Number(data.fuelEfficiencyKmL) <= 0)) {
      return { error: 'Efisiensi BBM harus berupa angka positif (km/liter).' }
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
        fuelType: data.fuelType || existingVehicle.fuelType || 'pertalite',
        fuelEfficiencyKmL: data.fuelEfficiencyKmL ? new Prisma.Decimal(data.fuelEfficiencyKmL) : (data.fuelEfficiencyKmL === null ? null : existingVehicle.fuelEfficiencyKmL),
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
          dailyRate: Number(existingVehicle.dailyRate),
          fuelType: existingVehicle.fuelType,
          fuelEfficiencyKmL: existingVehicle.fuelEfficiencyKmL ? Number(existingVehicle.fuelEfficiencyKmL) : null,
        },
        after: {
          name: data.name.trim(),
          plateNumber: normalizedPlate,
          categoryId: data.categoryId,
          branchId: data.branchId,
          dailyRate: Number(data.dailyRate),
          fuelType: data.fuelType || existingVehicle.fuelType || 'pertalite',
          fuelEfficiencyKmL: data.fuelEfficiencyKmL ? Number(data.fuelEfficiencyKmL) : (data.fuelEfficiencyKmL === null ? null : (existingVehicle.fuelEfficiencyKmL ? Number(existingVehicle.fuelEfficiencyKmL) : null)),
        }
      }
    })

    safeRevalidatePath('/admin/vehicles')
    safeRevalidatePath('/admin/dashboard')
    safeRevalidatePath('/')
    safeRevalidatePath(`/vehicles/${id}`)
    safeRevalidatePath(`/vehicles/${id}/book`)

    return { success: true }
  } catch (error: any) {
    if (error.code === 'P2002') return { error: 'Plat nomor sudah terdaftar' }
    return { error: 'Terjadi kesalahan sistem' }
  }
}

export type UpdateVehicleStatusOptions = {
  estimatedEndAt?: Date | string | null
  note?: string | null
  targetBranchId?: string | null
  actor?: { id: string; role: UserRole; branchId?: string | null }
}

export async function updateVehicleStatus(
  id: string,
  newStatus: VehicleStatus,
  options?: UpdateVehicleStatusOptions
) {
  try {
    const adminUser = (process.env.NODE_ENV !== 'production' && options?.actor)
      ? options.actor
      : await requireAdminSession()
    
    // 1. Larangan mutlak transisi manual ke status 'rented'
    if (newStatus === 'rented') {
      return { error: 'Status "Disewa (Rented)" dikelola otomatis oleh sistem saat Mulai Sewa di Manajemen Pesanan.' }
    }

    // 2. Check scope first
    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return { error: 'Kendaraan tidak ditemukan' }
    
    const scope = (process.env.NODE_ENV !== 'production' && options?.actor)
      ? (options.actor.role === 'admin_pusat' ? { scope: 'all' as const } : { scope: 'branch' as const, branchId: options.actor.branchId! })
      : await getStaffScope()
    assertInScope([vehicle.branchId], scope)

    if (options?.targetBranchId) {
      assertInScope([options.targetBranchId], scope)
    }

    const parsedEstimatedEndAt = options?.estimatedEndAt
      ? (typeof options.estimatedEndAt === 'string' ? new Date(options.estimatedEndAt) : options.estimatedEndAt)
      : null

    // 3. Eksekusi atomik anti-TOCTOU dengan validasi ketat dan row lock
    await prisma.$transaction(async (tx) => {
      // Row lock on vehicle
      await tx.$queryRawUnsafe('SELECT id FROM "Vehicle" WHERE id = $1 FOR UPDATE', id)

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

      const now = new Date()

      // Guard Unbounded untuk 'moved':
      // Unit yang dimutasi tidak boleh memiliki pesanan aktif di masa depan sama sekali
      if (newStatus === 'moved') {
        const futureActiveBookings = await tx.booking.count({
          where: {
            vehicleId: id,
            status: { in: ['pending_payment', 'confirmed', 'ongoing'] },
            endDate: { gte: now }
          }
        })

        if (futureActiveBookings > 0) {
          throw new Error('Kendaraan memiliki jadwal pesanan aktif di masa depan. Selesaikan atau alihkan pesanan terlebih dahulu sebelum memindahkan kendaraan.')
        }
      }

      // Guard Windowed untuk 'maintenance':
      if (newStatus === 'maintenance') {
        const rolling24h = new Date(Date.now() + 24 * 60 * 60 * 1000)

        // 1. Guard jendela bergulir 24 jam eksisting (Issue #26)
        // Hanya divalidasi saat pertama kali masuk ke status maintenance dari status lain
        if (currentVehicle.status !== 'maintenance') {
          const conflicting24h = await tx.booking.count({
            where: {
              vehicleId: id,
              status: { in: ['confirmed', 'pending_payment'] },
              startDate: { lte: rolling24h },
              endDate: { gte: now }
            }
          })

          if (conflicting24h > 0) {
            throw new Error('Kendaraan memiliki jadwal sewa (confirmed/pending) dalam 24 jam ke depan. Selesaikan atau alihkan pesanan terlebih dahulu.')
          }
        }

        // 2. Guard windowed maintenance jika ada estimasi selesai
        if (parsedEstimatedEndAt) {
          const unavailEndWithBuffer = new Date(parsedEstimatedEndAt.getTime() + TURNOVER_BUFFER_MS)
          const conflictingInWindow = await tx.booking.count({
            where: {
              vehicleId: id,
              status: { in: ['confirmed', 'pending_payment'] },
              startDate: { lt: unavailEndWithBuffer },
              endDate: { gt: now }
            }
          })

          if (conflictingInWindow > 0) {
            throw new Error('Kendaraan memiliki jadwal sewa yang bertabrakan dengan rentang waktu perbaikan hingga estimasi selesai.')
          }
        } else {
          // Indefinite maintenance: periksa seluruh jadwal booking di masa depan
          const futureBookings = await tx.booking.count({
            where: {
              vehicleId: id,
              status: { in: ['confirmed', 'pending_payment'] },
              endDate: { gte: now }
            }
          })

          if (futureBookings > 0) {
            throw new Error('Kendaraan memiliki jadwal sewa di masa depan. Tentukan estimasi selesai perbaikan atau alihkan pesanan terlebih dahulu.')
          }
        }
      }

      // Cari record VehicleUnavailability aktif saat ini
      const activeUnavail = await tx.vehicleUnavailability.findFirst({
        where: {
          vehicleId: id,
          actualEndAt: null
        }
      })

      if (newStatus === currentVehicle.status) {
        // Idempotent update: perbarui record aktif jika ada
        if (activeUnavail) {
          await tx.vehicleUnavailability.update({
            where: { id: activeUnavail.id },
            data: {
              estimatedEndAt: options?.estimatedEndAt !== undefined ? parsedEstimatedEndAt : activeUnavail.estimatedEndAt,
              note: options?.note !== undefined ? options.note : activeUnavail.note
            }
          })
        } else if (newStatus === 'maintenance' || newStatus === 'moved') {
          // Jika status sudah maintenance/moved tapi tidak ada baris aktif (anomali)
          await tx.vehicleUnavailability.create({
            data: {
              vehicleId: id,
              reason: newStatus as any,
              startAt: now,
              estimatedEndAt: newStatus === 'maintenance' ? parsedEstimatedEndAt : null,
              note: options?.note ?? null,
              createdBy: adminUser.id
            }
          })
        }
      } else {
        // Transisi ke status baru:
        // Tutup record unavailability lama jika ada
        if (activeUnavail) {
          await tx.vehicleUnavailability.update({
            where: { id: activeUnavail.id },
            data: { actualEndAt: now }
          })
        }

        if (newStatus === 'available') {
          const updateData: Prisma.VehicleUpdateInput = { status: newStatus }
          if (options?.targetBranchId) {
            const targetBranch = await tx.branch.findUnique({
              where: { id: options.targetBranchId }
            })
            if (!targetBranch || !targetBranch.isActive) {
              throw new Error('Cabang tujuan tidak valid atau tidak aktif.')
            }
            updateData.branch = { connect: { id: options.targetBranchId } }
          }
          await tx.vehicle.update({
            where: { id },
            data: updateData
          })
        } else if (newStatus === 'maintenance' || newStatus === 'moved') {
          await tx.vehicleUnavailability.create({
            data: {
              vehicleId: id,
              reason: newStatus as any,
              startAt: now,
              estimatedEndAt: newStatus === 'maintenance' ? parsedEstimatedEndAt : null,
              note: options?.note ?? null,
              createdBy: adminUser.id
            }
          })
          await tx.vehicle.update({
            where: { id },
            data: { status: newStatus }
          })
        }
      }
    }, {
      maxWait: 10000,
      timeout: 20000
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: options?.targetBranchId || vehicle.branchId,
      action: 'vehicle.status_change',
      entityType: 'Vehicle',
      entityId: id,
      metadata: {
        plateNumber: vehicle.plateNumber,
        oldStatus: vehicle.status,
        newStatus,
        estimatedEndAt: parsedEstimatedEndAt,
        note: options?.note,
        targetBranchId: options?.targetBranchId,
      }
    })

    // 4. Revalidasi cache mendalam
    safeRevalidatePath('/admin/vehicles')
    safeRevalidatePath('/admin/dashboard')
    safeRevalidatePath('/admin/bookings')
    safeRevalidatePath('/')
    safeRevalidatePath(`/vehicles/${id}`)
    safeRevalidatePath(`/vehicles/${id}/book`)

    return { success: true }
  } catch (error: any) {
    return { error: error.message || 'Terjadi kesalahan sistem' }
  }
}

export async function updateVehicleUnavailabilityEstimate(
  vehicleId: string,
  data: {
    estimatedEndAt: Date | string | null
    note?: string | null
    actor?: { id: string; role: UserRole; branchId?: string | null }
  }
) {
  try {
    const adminUser = (process.env.NODE_ENV !== 'production' && data?.actor)
      ? data.actor
      : await requireAdminSession()
    
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, branchId: true, plateNumber: true, status: true, isActive: true }
    })
    if (!vehicle) return { error: 'Kendaraan tidak ditemukan' }

    const scope = (process.env.NODE_ENV !== 'production' && data?.actor)
      ? (data.actor.role === 'admin_pusat' ? { scope: 'all' as const } : { scope: 'branch' as const, branchId: data.actor.branchId! })
      : await getStaffScope()
    assertInScope([vehicle.branchId], scope)

    const parsedEstimatedEndAt = data.estimatedEndAt
      ? (typeof data.estimatedEndAt === 'string' ? new Date(data.estimatedEndAt) : data.estimatedEndAt)
      : null

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM "Vehicle" WHERE id = $1 FOR UPDATE', vehicleId)

      const currentVehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } })
      if (!currentVehicle || !currentVehicle.isActive) {
        throw new Error('Kendaraan tidak ditemukan atau nonaktif.')
      }

      const activeUnavail = await tx.vehicleUnavailability.findFirst({
        where: {
          vehicleId,
          actualEndAt: null,
          reason: 'maintenance'
        }
      })

      if (!activeUnavail || currentVehicle.status !== 'maintenance') {
        throw new Error('Kendaraan tidak sedang dalam status maintenance.')
      }

      const updated = await tx.vehicleUnavailability.update({
        where: { id: activeUnavail.id },
        data: {
          estimatedEndAt: parsedEstimatedEndAt,
          note: data.note !== undefined ? data.note : activeUnavail.note
        }
      })

      // Immediate schedule conflict detection
      let conflictWarning = false
      let conflictingBookings: Array<{ id: string; startDate: Date; endDate: Date; status: string; customerName?: string }> = []

      if (parsedEstimatedEndAt) {
        const unavailEndWithBuffer = new Date(parsedEstimatedEndAt.getTime() + TURNOVER_BUFFER_MS)
        const bookings = await tx.booking.findMany({
          where: {
            vehicleId,
            status: { in: ['confirmed', 'pending_payment'] },
            startDate: { lt: unavailEndWithBuffer },
            endDate: { gt: activeUnavail.startAt }
          },
          include: { customer: { select: { name: true } } }
        })

        if (bookings.length > 0) {
          conflictWarning = true
          conflictingBookings = bookings.map(b => ({
            id: b.id,
            startDate: b.startDate,
            endDate: b.endDate,
            status: b.status,
            customerName: b.customer?.name
          }))
        }
      }

      return { updated, conflictWarning, conflictingBookings }
    })

    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: vehicle.branchId,
      action: 'vehicle.unavailability_update',
      entityType: 'VehicleUnavailability',
      entityId: result.updated.id,
      metadata: {
        plateNumber: vehicle.plateNumber,
        newEstimatedEndAt: parsedEstimatedEndAt,
        note: data.note,
        conflictWarning: result.conflictWarning,
        conflictingBookingIds: result.conflictingBookings.map(b => b.id)
      }
    })

    safeRevalidatePath('/admin/vehicles')
    safeRevalidatePath('/admin/dashboard')
    safeRevalidatePath('/admin/bookings')
    safeRevalidatePath('/')
    safeRevalidatePath(`/vehicles/${vehicleId}`)
    safeRevalidatePath(`/vehicles/${vehicleId}/book`)

    return { 
      success: true, 
      conflictWarning: result.conflictWarning, 
      conflictingBookings: result.conflictingBookings 
    }
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
