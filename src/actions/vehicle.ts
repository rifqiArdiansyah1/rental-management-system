'use server'

import { prisma } from '@/utils/prisma'
import { Prisma } from '@prisma/client'

export async function getVehicles(filters?: { branchId?: string; categoryId?: string }) {
  try {
    const where: Prisma.VehicleWhereInput = {
      status: 'available',
      isActive: true,
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
