'use server'

import { prisma } from '@/utils/prisma'

export async function getAllBranches(onlyActive: boolean = true) {
  try {
    const branches = await prisma.branch.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: {
        name: 'asc'
      }
    })
    return branches
  } catch (error) {
    console.error('Failed to fetch branches:', error)
    return []
  }
}
