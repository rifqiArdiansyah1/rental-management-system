import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const VEHICLE_PRESETS: Record<string, { name: string; photos: string[] }> = {
  'B 1 BMW': {
    name: 'BMW 730Li M Sport',
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDpZpPBLzU1rxpGV0bKbDXbxV8EnswjscJacoc6yE3L18Y6kO5zLL83cH2AZ4jOC6Cnnby8qtiKpxUsZypv8NMX1Omtsn63l-RTWtnrnIc-lUBnmH85JlJ5FEpf_VY_Cjv8OVb4T9K6Yek2ffPZ7lLPQzFiI1EvC633glR6E5RLOwGmrcc7sqP61X4idBDKZcTga09Rlyq4In-I2qpgI-XWoPbEuhvidB06ejKa-uG6CvG6yJTODch7'
    ]
  },
  'B 2 RR': {
    name: 'Range Rover Autobiography',
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCGpkp0Kc9IYqLL_Bk2OJuukeIzBKJSW-Pw_bikhhhcZYs2d9TUqq1WcI7J7ayrOAT8ye8sTpj7hMfd9QGEnbXTiDo86SzwABpSFyCDINZJ_uMgxQKlKlf2taCGZPVLyZ3_NzpBCsVrYPY_73P3XzclQ-WLCmMI9mpFvxpny_5QaxJD_6_E_5ZW5xVNPUKCd0WMaTpApbhyz7SHCBU3zRMlE_wueA5b9GR49OilclYFolD823mXBAkg'
    ]
  },
  'B 911 PC': {
    name: 'Porsche 911 Carrera S',
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBiqkH4gNqRgxJaZpzyuN5FHO_hjh3Dh0gm48ksTbFhM6u4fH24nQI6goHflnJl47Zghuqv0vHZQPvaVonMh0H55hSrHnkDSJ4NQa6sf42uT30S8-CwLrdK_wPJPUj1WYqqTA2LH0Aiw5pUXE1xbzP-fS_ZSdK_y-rXk5UxyAF42A8zJt6TOGnhmAaKnf7Ie0XgP7Xqhu8xcQc9WIDpuUVhahUG4d52XRT258edWqp0zxdcHfnqgjMF'
    ]
  }
}

async function main() {
  console.log('🔄 Starting vehicle identity backfill...')

  const vehicles = await prisma.vehicle.findMany({
    include: {
      category: true
    }
  })

  console.log(`Found ${vehicles.length} vehicles in database.`)

  let updatedCount = 0

  for (const vehicle of vehicles) {
    const preset = VEHICLE_PRESETS[vehicle.plateNumber]
    let newName = vehicle.name
    let newPhotos = vehicle.photos

    if (preset) {
      newName = preset.name
      newPhotos = preset.photos
    } else {
      if (!newName || newName.trim() === '') {
        newName = `${vehicle.category.name} (${vehicle.plateNumber})`
      }
      if (!newPhotos || newPhotos.length === 0) {
        if (vehicle.category.imageUrl) {
          newPhotos = [vehicle.category.imageUrl]
        }
      }
    }

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        name: newName,
        photos: newPhotos
      }
    })

    console.log(`✅ Updated Vehicle ${vehicle.plateNumber} -> "${newName}" with ${newPhotos.length} photo(s).`)
    updatedCount++
  }

  console.log(`🎉 Successfully backfilled ${updatedCount} vehicle(s).`)
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
