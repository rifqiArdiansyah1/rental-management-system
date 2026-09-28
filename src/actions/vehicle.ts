'use server'

import { prisma } from '@/utils/prisma'
import { Prisma } from '@prisma/client'
import { TURNOVER_BUFFER_MS } from '@/lib/constants'

export async function getVehicles(filters?: { branchId?: string; categoryId?: string }) {
  try {
    const where: Prisma.VehicleWhereInput = {
      isActive: true,
      OR: [
        { status: 'available' },
        { status: 'rented' },
        {
          status: 'maintenance',
          unavailabilities: {
            some: {
              actualEndAt: null,
              reason: 'maintenance',
              estimatedEndAt: { not: null },
            },
          },
        },
      ],
    }

    if (filters?.branchId && filters.branchId !== 'all') {
      where.branchId = filters.branchId
    }

    if (filters?.categoryId && filters.categoryId !== 'all') {
      where.categoryId = filters.categoryId
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        category: true,
        branch: true,
        unavailabilities: {
          where: { actualEndAt: null },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      }
    })

    // Return Plain Objects from Prisma
    return JSON.parse(JSON.stringify(vehicles))
  } catch (error) {
    console.error('Failed to get vehicles:', error)
    return []
  }
}

export async function getVehicleById(id: string) {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { 
        id,
        isActive: true 
      },
      include: {
        category: true,
        branch: true,
        unavailabilities: {
          where: { actualEndAt: null },
          take: 1,
        },
      }
    })
    
    if (!vehicle) return null
    return JSON.parse(JSON.stringify(vehicle))
  } catch (error) {
    console.error('Failed to get vehicle:', error)
    return null
  }
}

export async function getBranches() {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
    return JSON.parse(JSON.stringify(branches))
  } catch (error) {
    console.error('Failed to get branches:', error)
    return []
  }
}

export async function getCategories() {
  try {
    const categories = await prisma.vehicleCategory.findMany({
      orderBy: { name: 'asc' }
    })
    return JSON.parse(JSON.stringify(categories))
  } catch (error) {
    console.error('Failed to get categories:', error)
    return []
  }
}

export type OccupiedRange = {
  start: string
  end: string
  reason: 'booked' | 'maintenance'
}

export async function getVehicleOccupiedRanges(vehicleId: string): Promise<OccupiedRange[]> {
  try {
    const [bookings, unavailabilities] = await Promise.all([
      prisma.booking.findMany({
        where: {
          vehicleId,
          status: { in: ['pending_payment', 'confirmed', 'ongoing'] },
          endDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: {
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: 'asc' },
      }),
      prisma.vehicleUnavailability.findMany({
        where: {
          vehicleId,
          actualEndAt: null,
          estimatedEndAt: { not: null },
        },
        select: {
          startAt: true,
          estimatedEndAt: true,
          reason: true,
        },
        orderBy: { startAt: 'asc' },
      }),
    ])

    const ranges: OccupiedRange[] = []

    for (const b of bookings) {
      ranges.push({
        start: b.startDate.toISOString(),
        end: new Date(b.endDate.getTime() + TURNOVER_BUFFER_MS).toISOString(),
        reason: 'booked',
      })
    }

    for (const u of unavailabilities) {
      if (u.estimatedEndAt) {
        ranges.push({
          start: u.startAt.toISOString(),
          end: new Date(u.estimatedEndAt.getTime() + TURNOVER_BUFFER_MS).toISOString(),
          reason: 'maintenance',
        })
      }
    }

    ranges.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return ranges
  } catch (error) {
    console.error('Failed to get vehicle occupied ranges:', error)
    return []
  }
}

