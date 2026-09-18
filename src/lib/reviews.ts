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

export interface ActiveVehicleInChain {
  id: string
  name: string
  plateNumber: string
  branchName: string
  isOriginalUnit: boolean
}

interface VehicleNode {
  id: string
  name: string
  plateNumber: string
  isActive: boolean
  previousVehicleId: string | null
  relocatedToId: string | null
  branchName: string
}

/**
 * Batch resolver untuk seluruh armada ulasan di landing page.
 * Menghindari N+1 query dengan memuat seluruh relokasi dalam 1-2 batch query findMany.
 * Resolusi rantai dilakukan secara cepat di memori.
 */
export async function resolveActiveVehiclesForReviews(
  vehicleIds: string[]
): Promise<Map<string, ActiveVehicleInChain | null>> {
  const result = new Map<string, ActiveVehicleInChain | null>()
  const uniqueIds = Array.from(new Set(vehicleIds.filter(Boolean)))

  if (uniqueIds.length === 0) {
    return result
  }

  const nodes = new Map<string, VehicleNode>()
  let idsToFetch = new Set<string>(uniqueIds)

  // Muat node dan tetangga rantainya secara bertahap (biasanya selesai dalam 1-2 batch)
  while (idsToFetch.size > 0) {
    const fetched: Array<{
      id: string
      name: string
      plateNumber: string
      isActive: boolean
      previousVehicleId: string | null
      relocatedTo: { id: string } | null
      branch: { name: string }
    }> = await prisma.vehicle.findMany({
      where: { id: { in: Array.from(idsToFetch) } },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        isActive: true,
        previousVehicleId: true,
        relocatedTo: { select: { id: true } },
        branch: { select: { name: true } }
      }
    })

    const nextIds = new Set<string>()
    for (const v of fetched) {
      const node: VehicleNode = {
        id: v.id,
        name: v.name || v.plateNumber,
        plateNumber: v.plateNumber,
        isActive: v.isActive,
        previousVehicleId: v.previousVehicleId,
        relocatedToId: v.relocatedTo?.id || null,
        branchName: v.branch.name
      }
      nodes.set(v.id, node)

      if (v.previousVehicleId && !nodes.has(v.previousVehicleId) && !idsToFetch.has(v.previousVehicleId)) {
        nextIds.add(v.previousVehicleId)
      }
      if (v.relocatedTo?.id && !nodes.has(v.relocatedTo.id) && !idsToFetch.has(v.relocatedTo.id)) {
        nextIds.add(v.relocatedTo.id)
      }
    }

    // Pastikan ID yang tidak ditemukan di DB tidak dicari ulang
    for (const id of idsToFetch) {
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          name: '',
          plateNumber: '',
          isActive: false,
          previousVehicleId: null,
          relocatedToId: null,
          branchName: ''
        })
      }
    }

    idsToFetch = nextIds
  }

  // Resolusi in-memory untuk setiap vehicleId
  for (const id of uniqueIds) {
    const origNode = nodes.get(id)
    if (!origNode || !origNode.name) {
      result.set(id, null)
      continue
    }

    // Kasus 1: Unit asli masih aktif di cabang tempat sewa berlangsung
    if (origNode.isActive) {
      result.set(id, {
        id: origNode.id,
        name: origNode.name,
        plateNumber: origNode.plateNumber,
        branchName: origNode.branchName,
        isOriginalUnit: true
      })
      continue
    }

    // Kasus 2: Unit asli tidak aktif (misal telah dimutasi).
    // Telusuri rantai mutasi ke depan dan ke belakang di memori untuk menemukan unit aktif penerus.
    const chainIds = new Set<string>([id])

    let currB = origNode.previousVehicleId
    while (currB && !chainIds.has(currB)) {
      chainIds.add(currB)
      currB = nodes.get(currB)?.previousVehicleId || null
    }

    let currF = origNode.relocatedToId
    while (currF && !chainIds.has(currF)) {
      chainIds.add(currF)
      currF = nodes.get(currF)?.relocatedToId || null
    }

    // Prioritaskan unit yang paling baru di rantai ke depan (descendant)
    let activeInChain: VehicleNode | null = null
    // Cek penerus forward dulu
    let forwardCheck = origNode.relocatedToId
    while (forwardCheck) {
      const fn = nodes.get(forwardCheck)
      if (fn && fn.isActive && fn.name) {
        activeInChain = fn
        break
      }
      forwardCheck = fn?.relocatedToId || null
    }

    // Jika belum ketemu di forward, cari di seluruh rantai
    if (!activeInChain) {
      for (const cid of chainIds) {
        const cn = nodes.get(cid)
        if (cn && cn.isActive && cn.name) {
          activeInChain = cn
          break
        }
      }
    }

    if (activeInChain) {
      result.set(id, {
        id: activeInChain.id,
        name: activeInChain.name,
        plateNumber: activeInChain.plateNumber,
        branchName: activeInChain.branchName,
        isOriginalUnit: false
      })
    } else {
      // Tidak ada unit aktif sama sekali di seluruh rantai (benar-benar pensiun/arsip)
      result.set(id, null)
    }
  }

  return result
}

/**
 * Resolusi unit aktif untuk single vehicleId (menggunakan batch resolver di baliknya).
 */
export async function resolveActiveVehicleInChain(vehicleId: string): Promise<ActiveVehicleInChain | null> {
  const map = await resolveActiveVehiclesForReviews([vehicleId])
  return map.get(vehicleId) || null
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
