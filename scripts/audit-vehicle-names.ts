import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🔍 Menjalankan audit armada aktif...')
  
  const totalActive = await prisma.vehicle.count({ where: { isActive: true } })
  const emptyNameVehicles = await prisma.vehicle.findMany({
    where: {
      isActive: true,
      OR: [
        { name: '' },
      ]
    },
    include: {
      category: true,
      branch: true,
    }
  })

  // Also raw SQL check for NULL or empty
  const rawCheck = await pool.query(`
    SELECT id, name, "plateNumber", "branchId", "categoryId", "isActive"
    FROM "Vehicle"
    WHERE "isActive" = true AND (name IS NULL OR TRIM(name) = '')
  `)

  console.log(`\n📊 Hasil Audit:`)
  console.log(`Total Armada Aktif: ${totalActive}`)
  console.log(`Armada Aktif dengan nama kosong/NULL (Prisma): ${emptyNameVehicles.length}`)
  console.log(`Armada Aktif dengan nama kosong/NULL (Raw SQL): ${rawCheck.rows.length}`)

  if (rawCheck.rows.length > 0) {
    console.log('\n⚠️ Daftar Unit Offender:')
    console.table(rawCheck.rows)
  } else {
    console.log('\n✅ Tidak ada unit armada aktif dengan nama kosong di database!')
  }

  await pool.end()
}

main().catch((e) => {
  console.error('Error during audit:', e)
  process.exit(1)
})
