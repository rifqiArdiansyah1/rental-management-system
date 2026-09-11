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

function isPlateUniqueViolation(error: any): boolean {
  return Boolean(
    error?.code === 'P2002' ||
    error?.code === '23505' ||
    error?.message?.includes('Vehicle_plateNumber_active_unique') ||
    error?.message?.includes('Vehicle_plateNumber_key') ||
    (typeof error?.message === 'string' && error.message.toLowerCase().includes('unique constraint'))
  )
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
  actor?: { id: string; role: UserRole; branchId?: string | null }
}) {
  try {
    const adminUser = (process.env.NODE_ENV !== 'production' && data.actor)
      ? data.actor
      : await requireAdminSession()
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

    const scope = (process.env.NODE_ENV !== 'production' && data.actor)
      ? (data.actor.role === 'admin_pusat' ? { scope: 'all' as const } : { scope: 'branch' as const, branchId: data.actor.branchId! })
      : await getStaffScope()
    assertInScope([data.branchId], scope)

    const normalizedPlate = data.plateNumber.replace(/\s+/g, '').toUpperCase()

    // Pre-check active plate number to prevent duplicates
    const activeExisting = await prisma.vehicle.findFirst({
      where: { plateNumber: normalizedPlate, isActive: true }
    })
    if (activeExisting) {
      return { error: 'Plat nomor sudah terdaftar pada armada aktif lain.' }
    }

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
    if (isPlateUniqueViolation(error)) {
      return { error: 'Plat nomor sudah terdaftar pada armada aktif lain.' }
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

    const activeExisting = await prisma.vehicle.findFirst({
      where: { plateNumber: normalizedPlate, isActive: true, id: { not: id } }
    })
    if (activeExisting) {
      return { error: 'Plat nomor sudah terdaftar pada armada aktif lain.' }
    }

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
    if (isPlateUniqueViolation(error)) return { error: 'Plat nomor sudah terdaftar pada armada aktif lain.' }
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
    
    // 1. Larangan mutlak transisi manual ke status 'rented' dan 'moved'
    if (newStatus === 'rented') {
      return { error: 'Status "Disewa (Rented)" dikelola otomatis oleh sistem saat Mulai Sewa di Manajemen Pesanan.' }
    }
    if (newStatus === 'moved') {
      return { error: 'Status "Dipindahkan (Moved)" hanya dapat dilakukan melalui fitur Relokasi Armada antar cabang.' }
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
        } else if (newStatus === 'maintenance') {
          // Jika status sudah maintenance tapi tidak ada baris aktif (anomali)
          await tx.vehicleUnavailability.create({
            data: {
              vehicleId: id,
              reason: 'maintenance',
              startAt: now,
              estimatedEndAt: parsedEstimatedEndAt,
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
          await tx.vehicle.update({
            where: { id },
            data: updateData
          })
        } else if (newStatus === 'maintenance') {
          await tx.vehicleUnavailability.create({
            data: {
              vehicleId: id,
              reason: 'maintenance',
              startAt: now,
              estimatedEndAt: parsedEstimatedEndAt,
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
      } else {
        const activeExisting = await tx.vehicle.findFirst({
          where: { plateNumber: vehicle.plateNumber, isActive: true, id: { not: id } }
        })
        if (activeExisting) {
          throw new Error('Tidak dapat mengaktifkan armada: Plat nomor ini sudah aktif pada armada di cabang lain. Lakukan mutasi kembali jika ingin memindahkan unit.')
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
    if (isPlateUniqueViolation(error)) {
      return { error: 'Plat nomor sudah terdaftar pada armada aktif lain.' }
    }
    return { error: error.message || 'Terjadi kesalahan sistem' }
  }
}

export async function relocateVehicle(
  sourceVehicleId: string,
  targetBranchId: string,
  options?: {
    transitUntil?: Date | string | null
    note?: string | null
    actor?: { id: string; role: UserRole; branchId?: string | null }
  }
): Promise<{ success?: boolean; newVehicleId?: string; error?: string }> {
  try {
    const adminUser = (process.env.NODE_ENV !== 'production' && options?.actor)
      ? options.actor
      : await requireAdminSession()

    if (adminUser.role !== 'admin_pusat') {
      return { error: 'Akses ditolak: Hanya Admin Pusat yang berwenang memindahkan armada antar cabang.' }
    }

    const targetBranch = await prisma.branch.findUnique({
      where: { id: targetBranchId }
    })
    if (!targetBranch || !targetBranch.isActive) {
      return { error: 'Cabang tujuan tidak valid atau tidak aktif.' }
    }

    const parsedTransitUntil = options?.transitUntil
      ? (typeof options.transitUntil === 'string' ? new Date(options.transitUntil) : options.transitUntil)
      : null

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock source vehicle
      await tx.$queryRawUnsafe('SELECT id FROM "Vehicle" WHERE id = $1 FOR UPDATE', sourceVehicleId)

      const sourceVehicle = await tx.vehicle.findUnique({
        where: { id: sourceVehicleId },
        include: {
          branch: { select: { id: true, name: true } },
          unavailabilities: {
            where: { actualEndAt: null }
          }
        }
      })

      if (!sourceVehicle) {
        throw new Error('Kendaraan asal tidak ditemukan.')
      }
      if (!sourceVehicle.isActive) {
        throw new Error('Kendaraan nonaktif tidak dapat dimutasi.')
      }
      if (sourceVehicle.status === 'rented') {
        throw new Error('Kendaraan sedang dalam masa sewa aktif (ongoing). Selesaikan sewa terlebih dahulu sebelum mutasi.')
      }
      if (sourceVehicle.branchId === targetBranchId) {
        throw new Error('Cabang tujuan harus berbeda dengan cabang armada saat ini.')
      }

      const now = new Date()

      // 2. Strict guard against active or future bookings
      const activeBookings = await tx.booking.count({
        where: {
          vehicleId: sourceVehicleId,
          status: { in: ['pending_payment', 'confirmed', 'ongoing'] },
          endDate: { gte: now }
        }
      })

      if (activeBookings > 0) {
        throw new Error('Kendaraan memiliki jadwal pesanan aktif di masa depan. Selesaikan atau alihkan pesanan terlebih dahulu sebelum memindahkan kendaraan.')
      }

      // 3. Handle open unavailability on source vehicle with audit preservation
      const activeUnavail = sourceVehicle.unavailabilities[0]
      if (activeUnavail) {
        const preservedNote = (activeUnavail.note ? activeUnavail.note + ' | ' : '') + `Ditutup otomatis karena mutasi ke Cabang ${targetBranch.name}.`
        await tx.vehicleUnavailability.update({
          where: { id: activeUnavail.id },
          data: {
            actualEndAt: now,
            note: preservedNote
          }
        })
      }

      // 4. Decommission source vehicle (isActive = false, status = moved)
      await tx.vehicle.update({
        where: { id: sourceVehicleId },
        data: {
          isActive: false,
          status: 'moved'
        }
      })

      // 5. Commission new vehicle at target branch (Linked Record)
      const newVehicle = await tx.vehicle.create({
        data: {
          name: sourceVehicle.name,
          plateNumber: sourceVehicle.plateNumber,
          categoryId: sourceVehicle.categoryId,
          branchId: targetBranchId,
          dailyRate: sourceVehicle.dailyRate,
          photos: sourceVehicle.photos,
          fuelType: sourceVehicle.fuelType,
          fuelEfficiencyKmL: sourceVehicle.fuelEfficiencyKmL,
          status: 'available',
          isActive: true,
          previousVehicleId: sourceVehicle.id
        }
      })

      // 6. Handle transit / maintenance continuity
      let createdUnavail: any = null
      if (parsedTransitUntil && parsedTransitUntil > now) {
        const transitNote = options?.note
          ? options.note
          : (activeUnavail ? `Transit mutasi dari Cabang ${sourceVehicle.branch.name}. Lanjutan perbaikan: ${activeUnavail.note || 'Pemeriksaan unit'}` : `Transit pengiriman armada dari Cabang ${sourceVehicle.branch.name}`)

        createdUnavail = await tx.vehicleUnavailability.create({
          data: {
            vehicleId: newVehicle.id,
            reason: 'maintenance',
            startAt: now,
            estimatedEndAt: parsedTransitUntil,
            note: transitNote,
            createdBy: adminUser.id
          }
        })

        await tx.vehicle.update({
          where: { id: newVehicle.id },
          data: { status: 'maintenance' }
        })
      } else if (sourceVehicle.status === 'maintenance' && activeUnavail) {
        const contNote = `Lanjutan perbaikan dari Cabang ${sourceVehicle.branch.name}: ${activeUnavail.note || '-'}`
        createdUnavail = await tx.vehicleUnavailability.create({
          data: {
            vehicleId: newVehicle.id,
            reason: 'maintenance',
            startAt: now,
            estimatedEndAt: (activeUnavail.estimatedEndAt && activeUnavail.estimatedEndAt > now) ? activeUnavail.estimatedEndAt : null,
            note: contNote,
            createdBy: adminUser.id
          }
        })

        await tx.vehicle.update({
          where: { id: newVehicle.id },
          data: { status: 'maintenance' }
        })
      }

      return { sourceVehicle, newVehicle, activeUnavail, createdUnavail }
    }, {
      maxWait: 10000,
      timeout: 20000
    })

    // 7. Structured Audit Log
    logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      branchId: targetBranchId,
      action: 'vehicle.relocated',
      entityType: 'Vehicle',
      entityId: result.newVehicle.id,
      metadata: {
        sourceVehicleId,
        newVehicleId: result.newVehicle.id,
        fromBranchId: result.sourceVehicle.branchId,
        fromBranchName: result.sourceVehicle.branch.name,
        toBranchId: targetBranchId,
        toBranchName: targetBranch.name,
        plateNumber: result.sourceVehicle.plateNumber,
        closedUnavailability: result.activeUnavail ? {
          id: result.activeUnavail.id,
          reason: result.activeUnavail.reason,
          originalNote: result.activeUnavail.note,
          closedAt: new Date().toISOString()
        } : null,
        createdUnavailability: result.createdUnavail ? {
          id: result.createdUnavail.id,
          estimatedEndAt: result.createdUnavail.estimatedEndAt?.toISOString() || null,
          note: result.createdUnavail.note
        } : null,
        transitUntil: parsedTransitUntil ? parsedTransitUntil.toISOString() : null,
        note: options?.note || null
      }
    })

    safeRevalidatePath('/admin/vehicles')
    safeRevalidatePath('/admin/dashboard')
    safeRevalidatePath('/admin/bookings')
    safeRevalidatePath('/')
    safeRevalidatePath(`/vehicles/${result.newVehicle.id}`)
    safeRevalidatePath(`/vehicles/${sourceVehicleId}`)

    return { success: true, newVehicleId: result.newVehicle.id }
  } catch (error: any) {
    if (isPlateUniqueViolation(error)) {
      return { error: 'Plat nomor sudah terdaftar pada armada aktif lain.' }
    }
    return { error: error.message || 'Terjadi kesalahan sistem saat memindahkan armada.' }
  }
}
