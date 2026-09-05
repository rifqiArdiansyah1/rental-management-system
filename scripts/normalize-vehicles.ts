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

const isApply = process.argv.includes('--apply')

async function main() {
  console.log(`\n========================================`)
  console.log(`🚗 VEHICLE & CATEGORY NORMALIZATION`)
  console.log(`MODE: ${isApply ? '⚡ APPLY (CHANGES WILL BE COMMITTED)' : '🔍 DRY-RUN (PREVIEW ONLY)'}`)
  console.log(`========================================\n`)

  const SEDAN_ID = '00000000-0000-0000-0000-000000000002'
  const SUV_ID = '00000000-0000-0000-0000-000000000003'
  const SPORTS_ID = '00000000-0000-0000-0000-000000000004'
  const MPV_ID = '00000000-0000-0000-0000-000000000005'

  // Current categories and vehicles
  const currentCategories = await prisma.vehicleCategory.findMany()
  const currentVehicles = await prisma.vehicle.findMany({
    include: { category: true }
  })

  console.log('--- CURRENT CATEGORIES ---')
  console.table(currentCategories.map(c => ({ id: c.id, name: c.name, capacity: c.capacity, transmission: c.transmission })))

  console.log('\n--- CURRENT VEHICLES ---')
  console.table(currentVehicles.map(v => ({
    id: v.id.slice(0, 8),
    plate: v.plateNumber,
    name: v.name,
    category: v.category?.name,
    dailyRate: Number(v.dailyRate),
    isActive: v.isActive
  })))

  // Planned updates
  const plannedCategories = [
    {
      id: SEDAN_ID,
      name: 'Luxury Sedan',
      capacity: 5,
      transmission: 'Automatic',
      features: ['AC', 'Bluetooth', 'Rear Camera', 'Leather Seats'],
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpZpPBLzU1rxpGV0bKbDXbxV8EnswjscJacoc6yE3L18Y6kO5zLL83cH2AZ4jOC6Cnnby8qtiKpxUsZypv8NMX1Omtsn63l-RTWtnrnIc-lUBnmH85JlJ5FEpf_VY_Cjv8OVb4T9K6Yek2ffPZ7lLPQzFiI1EvC633glR6E5RLOwGmrcc7sqP61X4idBDKZcTga09Rlyq4In-I2qpgI-XWoPbEuhvidB06ejKa-uG6CvG6yJTODch7'
    },
    {
      id: SUV_ID,
      name: 'Premium SUV',
      capacity: 5,
      transmission: 'Automatic',
      features: ['AC', 'Audio System', 'AWD', 'Sunroof'],
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGpkp0Kc9IYqLL_Bk2OJuukeIzBKJSW-Pw_bikhhhcZYs2d9TUqq1WcI7J7ayrOAT8ye8sTpj7hMfd9QGEnbXTiDo86SzwABpSFyCDINZJ_uMgxQKlKlf2taCGZPVLyZ3_NzpBCsVrYPY_73P3XzclQ-WLCmMI9mpFvxpny_5QaxJD_6_E_5ZW5xVNPUKCd0WMaTpApbhyz7SHCBU3zRMlE_wueA5b9GR49OilclYFolD823mXBAkg'
    },
    {
      id: SPORTS_ID,
      name: 'Sports Car',
      capacity: 2,
      transmission: 'PDK Auto',
      features: ['Sport Chrono', 'Bucket Seats', 'Navigation'],
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBiqkH4gNqRgxJaZpzyuN5FHO_hjh3Dh0gm48ksTbFhM6u4fH24nQI6goHflnJl47Zghuqv0vHZQPvaVonMh0H55hSrHnkDSJ4NQa6sf42uT30S8-CwLrdK_wPJPUj1WYqqTA2LH0Aiw5pUXE1xbzP-fS_ZSdK_y-rXk5UxyAF42A8zJt6TOGnhmAaKnf7Ie0XgP7Xqhu8xcQc9WIDpuUVhahUG4d52XRT258edWqp0zxdcHfnqgjMF'
    },
    {
      id: MPV_ID,
      name: 'Executive MPV',
      capacity: 7,
      transmission: 'Automatic',
      features: ['Captain Seat', 'Rear Entertainment', 'Dual Sliding Door', 'AC Triple Zone'],
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpZpPBLzU1rxpGV0bKbDXbxV8EnswjscJacoc6yE3L18Y6kO5zLL83cH2AZ4jOC6Cnnby8qtiKpxUsZypv8NMX1Omtsn63l-RTWtnrnIc-lUBnmH85JlJ5FEpf_VY_Cjv8OVb4T9K6Yek2ffPZ7lLPQzFiI1EvC633glR6E5RLOwGmrcc7sqP61X4idBDKZcTga09Rlyq4In-I2qpgI-XWoPbEuhvidB06ejKa-uG6CvG6yJTODch7'
    }
  ]

  const vehicleUpdates = [
    { plate: 'B 1 BMW', targetName: 'BMW 730Li M Sport', targetCatId: SEDAN_ID, targetRate: 4500000, targetCatName: 'Luxury Sedan' },
    { plate: 'B2RR', targetName: 'Range Rover Autobiography', targetCatId: SUV_ID, targetRate: 6000000, targetCatName: 'Premium SUV' },
    { plate: 'B5678DEF', targetName: 'Honda N7X', targetCatId: SUV_ID, targetRate: 350000, targetCatName: 'Premium SUV' },
    { plate: 'B 911 PC', targetName: 'Porsche 911 Carrera S', targetCatId: SPORTS_ID, targetRate: 8500000, targetCatName: 'Sports Car' },
    { plate: 'B334B', targetName: 'Toyota GR Supra 3.0', targetCatId: SPORTS_ID, targetRate: 3500000, targetCatName: 'Sports Car' },
    { plate: 'B1234ABC', targetName: 'Honda Stepwgn', targetCatId: MPV_ID, targetRate: 500000, targetCatName: 'Executive MPV' },
    { plate: 'S114BY', targetName: 'Toyota Alphard', targetCatId: MPV_ID, targetRate: 500000, targetCatName: 'Executive MPV' },
    { plate: 'B333B', targetName: 'Toyota Innova Zenix 2.0 Q Hybrid', targetCatId: MPV_ID, targetRate: 950000, targetCatName: 'Executive MPV', isActive: false }
  ]

  console.log('\n--- PLANNED VEHICLE CHANGES (BEFORE -> AFTER) ---')
  console.table(vehicleUpdates.map(u => {
    const existing = currentVehicles.find(v => v.plateNumber === u.plate)
    return {
      plate: u.plate,
      'old name': existing?.name,
      'NEW NAME': u.targetName,
      'old category': existing?.category?.name,
      'NEW CATEGORY': u.targetCatName,
      'old rate': existing ? Number(existing.dailyRate) : '-',
      'NEW RATE': u.targetRate
    }
  }))

  if (!isApply) {
    console.log('\n✅ DRY-RUN COMPLETE. No changes were applied.')
    console.log('To apply these changes, run:')
    console.log('npx tsx scripts/normalize-vehicles.ts --apply\n')
    return
  }

  // EXECUTE TRANSACTION
  console.log('\n⏳ Executing prisma.$transaction...')
  await prisma.$transaction(async (tx) => {
    // 1. Upsert Categories
    for (const cat of plannedCategories) {
      await tx.vehicleCategory.upsert({
        where: { id: cat.id },
        update: {
          name: cat.name,
          capacity: cat.capacity,
          transmission: cat.transmission,
          features: cat.features,
          imageUrl: cat.imageUrl
        },
        create: cat
      })
    }

    // 2. Update Vehicles
    for (const v of vehicleUpdates) {
      const existing = await tx.vehicle.findUnique({ where: { plateNumber: v.plate } })
      if (existing) {
        await tx.vehicle.update({
          where: { plateNumber: v.plate },
          data: {
            name: v.targetName,
            categoryId: v.targetCatId,
            dailyRate: v.targetRate,
            ...(v.isActive !== undefined ? { isActive: v.isActive } : {})
          }
        })
      }
    }
  })

  console.log('✅ TRANSACTION COMMITTED SUCCESSFULLY!')

  // Final verification query
  const updatedVehicles = await prisma.vehicle.findMany({
    include: { category: true },
    orderBy: { createdAt: 'asc' }
  })
  console.log('\n--- VERIFIED POST-MIGRATION STATE ---')
  console.table(updatedVehicles.map(v => ({
    plate: v.plateNumber,
    name: v.name,
    category: v.category?.name,
    dailyRate: Number(v.dailyRate),
    isActive: v.isActive,
    status: v.status
  })))
}

main()
  .catch((e) => {
    console.error('❌ MIGRATION FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
