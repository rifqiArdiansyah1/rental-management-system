/**
 * Centralized Vehicle Display Helper.
 * Single source of truth untuk resolusi nama armada di seluruh sistem.
 * 
 * Aturan Pembagian Mode:
 * - mode 'customer': Menghasilkan nama komersial murni yang elegan (prioritas: vehicle.name -> category.name).
 *   Plat nomor TIDAK digabung ke dalam nama karena plat nomor disajikan secara terpisah di elemen UI sekunder.
 * - mode 'staff': Menghasilkan kombinasi nama komersial dan plat nomor (contoh: "BMW 730Li (B 1234 CD)")
 *   untuk kemudahan identifikasi dan pencocokan fisik unit oleh staf operasional (terutama saat serah-terima kunci).
 * 
 * Tipe `category` WAJIB hadir agar TypeScript compiler (tsc) memaksa setiap query Prisma
 * untuk selalu mengikutsertakan relasi `category: { select: { name: true } }`.
 */

export interface VehicleDisplayEntity {
  name?: string | null
  plateNumber?: string | null
  category: {
    name: string
  }
}

export interface FormatVehicleNameOptions {
  mode?: 'customer' | 'staff'
  fallback?: string
}

export function getVehicleDisplayName(
  vehicle: VehicleDisplayEntity | null | undefined,
  options: FormatVehicleNameOptions = {}
): string {
  if (!vehicle) return options.fallback || 'Armada Prestige Motion'

  const cleanName = vehicle.name?.trim()
  const categoryName = vehicle.category?.name?.trim()
  const plate = vehicle.plateNumber?.trim()

  // 1. Tentukan nama dasar (prioritas: vehicle.name -> category.name -> plat nomor darurat)
  const baseName = cleanName || categoryName || plate || 'Armada'
  const mode = options.mode || 'customer'

  // 2. Pada mode staff, jika terdapat plat nomor yang berbeda dengan baseName, gabungkan sebagai pengenal fisik
  if (mode === 'staff' && plate && baseName !== plate) {
    return `${baseName} (${plate})`
  }

  return baseName
}
