import { prisma } from '@/utils/prisma'

/**
 * Masking nama penyewa untuk kepatuhan UU PDP No. 27/2022.
 * Menampilkan nama depan dan inisial nama belakang (misal "Budi S." atau "Siti R.").
 */
export function formatCustomerReviewName(fullName?: string | null): string {
  if (!fullName || !fullName.trim()) {
    return 'Penyewa Terverifikasi'
  }

  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0]
  }

  const firstName = parts[0]
  const lastInitial = parts[parts.length - 1][0].toUpperCase()
  return `${firstName} ${lastInitial}.`
}

/**
 * Traversal rantai mutasi/relokasi armada secara iteratif (Issue #33).
 * Menelusuri seluruh record ID yang merepresentasikan unit fisik yang sama
 * ke belakang (previousVehicleId) dan ke depan (relocatedTo).
 */
export async function getVehicleRelocationChainIds(vehicleId: string): Promise<string[]> {
  const chainIds = new Set<string>([vehicleId])

  // 1. Walk backward (ancestors / unit di cabang sebelumnya)
  let currentBackwardId: string | null = vehicleId
  while (currentBackwardId) {
    const current: { previousVehicleId: string | null } | null = await prisma.vehicle.findUnique({
      where: { id: currentBackwardId },
      select: { previousVehicleId: true }
    })

    if (current?.previousVehicleId && !chainIds.has(current.previousVehicleId)) {
      chainIds.add(current.previousVehicleId)
      currentBackwardId = current.previousVehicleId
    } else {
      break
    }
  }

  // 2. Walk forward (descendants / unit jika dimutasi ke cabang berikutnya)
  let currentForwardId: string | null = vehicleId
  while (currentForwardId) {
    const current: { relocatedTo: { id: string } | null } | null = await prisma.vehicle.findUnique({
      where: { id: currentForwardId },
      select: { relocatedTo: { select: { id: true } } }
    })

    if (current?.relocatedTo?.id && !chainIds.has(current.relocatedTo.id)) {
      chainIds.add(current.relocatedTo.id)
      currentForwardId = current.relocatedTo.id
    } else {
      break
    }
  }

  return Array.from(chainIds)
}

export interface ReviewMetrics {
  averageRating: number
  totalReviews: number
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>
}

/**
 * Menghitung metrik rating agregat (rata-rata 1 desimal dan distribusi bintang 1-5).
 */
export function calculateReviewMetrics(reviews: Array<{ rating: number }>): ReviewMetrics {
  const totalReviews = reviews.length
  const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  }

  if (totalReviews === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution
    }
  }

  let sum = 0
  for (const r of reviews) {
    sum += r.rating
    const star = Math.min(5, Math.max(1, r.rating)) as 1 | 2 | 3 | 4 | 5
    ratingDistribution[star] = (ratingDistribution[star] || 0) + 1
  }

  const averageRating = Math.round((sum / totalReviews) * 10) / 10

  return {
    averageRating,
    totalReviews,
    ratingDistribution
  }
}
