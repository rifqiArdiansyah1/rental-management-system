'use server'

import { prisma } from '@/utils/prisma'
import { requireAdminSession } from '@/actions/admin'
import { logAudit } from '@/lib/audit'
import { DEFAULT_FUEL_PRICES } from '@/lib/constants'
import { FuelType } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export interface FuelPriceItem {
  fuelType: FuelType
  pricePerLiter: number
  updatedAt: string
  updatedBy: string | null
  updaterName: string | null
}

const ALL_FUEL_TYPES: FuelType[] = [
  'pertalite',
  'pertamax',
  'pertamax_turbo',
  'solar',
  'dexlite',
]

/**
 * Mengambil daftar harga BBM dari basis data dengan fallback aman ke konstanta DEFAULT_FUEL_PRICES.
 */
export async function getFuelPrices(): Promise<FuelPriceItem[]> {
  try {
    const dbPrices = await prisma.fuelPrice.findMany({
      include: {
        updater: {
          select: { name: true }
        }
      }
    })

    const dbMap = new Map(dbPrices.map(p => [p.fuelType, p]))

    return ALL_FUEL_TYPES.map(fuelType => {
      const existing = dbMap.get(fuelType)
      if (existing) {
        return {
          fuelType: existing.fuelType,
          pricePerLiter: Number(existing.pricePerLiter),
          updatedAt: existing.updatedAt.toISOString(),
          updatedBy: existing.updatedBy,
          updaterName: existing.updater?.name || null,
        }
      }

      // Fallback acuan awal di level kode jika baris belum ada di database
      return {
        fuelType,
        pricePerLiter: DEFAULT_FUEL_PRICES[fuelType] || 10_000,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        updaterName: 'Sistem (Default Baseline)',
      }
    })
  } catch (error) {
    console.error('Failed to get fuel prices:', error)
    // Fallback murni jika koneksi DB bermasalah
    return ALL_FUEL_TYPES.map(fuelType => ({
      fuelType,
      pricePerLiter: DEFAULT_FUEL_PRICES[fuelType] || 10_000,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      updaterName: 'Sistem (Fallback)',
    }))
  }
}

/**
 * Memperbarui harga acuan per liter bahan bakar.
 * Guard: Hanya Admin Pusat yang diizinkan (Allowlist Security).
 */
export async function updateFuelPrice(fuelType: FuelType, pricePerLiter: number) {
  try {
    const adminUser = await requireAdminSession()

    // Otorisasi Allowlist: Hanya admin_pusat
    const normalizedRole = (adminUser.role || '').toLowerCase().replace(/\s+/g, '_')
    if (normalizedRole !== 'admin_pusat') {
      return { error: 'Akses ditolak: Hanya Admin Pusat yang berwenang memperbarui tarif acuan BBM.' }
    }

    if (!ALL_FUEL_TYPES.includes(fuelType)) {
      return { error: 'Jenis bahan bakar tidak valid.' }
    }

    const numericPrice = Number(pricePerLiter)
    if (!numericPrice || isNaN(numericPrice) || numericPrice <= 0) {
      return { error: 'Harga per liter harus berupa nominal positif lebih dari Rp 0.' }
    }

    const updated = await prisma.fuelPrice.upsert({
      where: { fuelType },
      update: {
        pricePerLiter: numericPrice,
        updatedBy: adminUser.id,
      },
      create: {
        fuelType,
        pricePerLiter: numericPrice,
        updatedBy: adminUser.id,
      },
      include: {
        updater: { select: { name: true } }
      }
    })

    await logAudit({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      action: 'fuel_price.update',
      entityType: 'FuelPrice',
      entityId: fuelType,
      metadata: {
        fuelType,
        pricePerLiter: numericPrice,
      }
    })

    revalidatePath('/admin/fuel-prices')
    revalidatePath('/admin/vehicles')
    revalidatePath('/vehicles')

    return {
      success: true,
      fuelPrice: {
        fuelType: updated.fuelType,
        pricePerLiter: Number(updated.pricePerLiter),
        updatedAt: updated.updatedAt.toISOString(),
        updatedBy: updated.updatedBy,
        updaterName: updated.updater?.name || null,
      }
    }
  } catch (error: any) {
    console.error('Failed to update fuel price:', error)
    return { error: error.message || 'Gagal memperbarui tarif BBM.' }
  }
}
