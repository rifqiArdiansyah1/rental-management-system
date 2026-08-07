'use server'

import { prisma } from '@/utils/prisma'

export async function getAllBranches() {
  try {
    const branches = await prisma.branch.findMany({
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
