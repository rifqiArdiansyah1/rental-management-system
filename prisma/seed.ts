import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting seed...')

  // 1. Cabang
  const branchPusat = await prisma.branch.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Cabang Pusat Jakarta',
      city: 'Jakarta',
      address: 'Jl. Sudirman No. 1, Jakarta Pusat',
      phone: '021-12345678',
    },
  })
  console.log(`✅ Branch ensured: ${branchPusat.name}`)

  // 2. Kategori Mobil
  const catSedan = await prisma.vehicleCategory.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Luxury Sedan',
      capacity: 5,
      transmission: 'Automatic',
      features: ['AC', 'Bluetooth', 'Rear Camera', 'Leather Seats'],
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpZpPBLzU1rxpGV0bKbDXbxV8EnswjscJacoc6yE3L18Y6kO5zLL83cH2AZ4jOC6Cnnby8qtiKpxUsZypv8NMX1Omtsn63l-RTWtnrnIc-lUBnmH85JlJ5FEpf_VY_Cjv8OVb4T9K6Yek2ffPZ7lLPQzFiI1EvC633glR6E5RLOwGmrcc7sqP61X4idBDKZcTga09Rlyq4In-I2qpgI-XWoPbEuhvidB06ejKa-uG6CvG6yJTODch7',
    },
  })
  
  const catSuv = await prisma.vehicleCategory.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Premium SUV',
      capacity: 5,
      transmission: 'Automatic',
      features: ['AC', 'Audio System', 'AWD', 'Sunroof'],
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGpkp0Kc9IYqLL_Bk2OJuukeIzBKJSW-Pw_bikhhhcZYs2d9TUqq1WcI7J7ayrOAT8ye8sTpj7hMfd9QGEnbXTiDo86SzwABpSFyCDINZJ_uMgxQKlKlf2taCGZPVLyZ3_NzpBCsVrYPY_73P3XzclQ-WLCmMI9mpFvxpny_5QaxJD_6_E_5ZW5xVNPUKCd0WMaTpApbhyz7SHCBU3zRMlE_wueA5b9GR49OilclYFolD823mXBAkg',
    },
  })

  const catSports = await prisma.vehicleCategory.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Sports Car',
      capacity: 2,
      transmission: 'PDK Auto',
      features: ['Sport Chrono', 'Bucket Seats', 'Navigation'],
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBiqkH4gNqRgxJaZpzyuN5FHO_hjh3Dh0gm48ksTbFhM6u4fH24nQI6goHflnJl47Zghuqv0vHZQPvaVonMh0H55hSrHnkDSJ4NQa6sf42uT30S8-CwLrdK_wPJPUj1WYqqTA2LH0Aiw5pUXE1xbzP-fS_ZSdK_y-rXk5UxyAF42A8zJt6TOGnhmAaKnf7Ie0XgP7Xqhu8xcQc9WIDpuUVhahUG4d52XRT258edWqp0zxdcHfnqgjMF',
    },
  })
  console.log(`✅ Categories ensured`)

  // 3. Mobil (Vehicle)
  await prisma.vehicle.upsert({
    where: { plateNumber: 'B 1 BMW' },
    update: {},
    create: {
      plateNumber: 'B 1 BMW',
      branchId: branchPusat.id,
      categoryId: catSedan.id,
      dailyRate: 4500000,
    },
  })

  await prisma.vehicle.upsert({
    where: { plateNumber: 'B 2 RR' },
    update: {},
    create: {
      plateNumber: 'B 2 RR',
      branchId: branchPusat.id,
      categoryId: catSuv.id,
      dailyRate: 6000000,
    },
  })

  await prisma.vehicle.upsert({
    where: { plateNumber: 'B 911 PC' },
    update: {},
    create: {
      plateNumber: 'B 911 PC',
      branchId: branchPusat.id,
      categoryId: catSports.id,
      dailyRate: 8500000,
    },
  })
  console.log(`✅ Vehicles ensured`)

  // 4. Supir (Driver)
  await prisma.driver.upsert({
    where: { licenseNumber: 'SIM-A-001' },
    update: {},
    create: {
      licenseNumber: 'SIM-A-001',
      name: 'Budi Santoso',
      phone: '081234567890',
      branchId: branchPusat.id,
      dailyFee: 150000,
    },
  })

  await prisma.driver.upsert({
    where: { licenseNumber: 'SIM-A-002' },
    update: {},
    create: {
      licenseNumber: 'SIM-A-002',
      name: 'Andi Kusuma',
      phone: '081298765432',
      branchId: branchPusat.id,
      dailyFee: 150000,
    },
  })
  console.log(`✅ Drivers ensured`)

  // 5. Admin (Membutuhkan SUPABASE_SERVICE_ROLE_KEY)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && supabaseServiceKey) {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const adminEmail = 'admin@rental.com'
    const adminPassword = 'Password123!'

    // Cek apakah user auth sudah ada
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    let adminUserId = null

    if (!listError && users) {
      const existingUser = users.find(u => u.email === adminEmail)
      if (existingUser) {
        adminUserId = existingUser.id
      }
    }

    if (!adminUserId) {
      console.log('Creating admin user in Supabase Auth...')
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        app_metadata: { role: 'admin_pusat' },
      })

      if (authError) {
        console.error('❌ Failed to create admin user in Supabase:', authError.message)
      } else if (authData.user) {
        adminUserId = authData.user.id
      }
    } else {
      console.log('Admin auth user already exists, ensuring app_metadata...')
      await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
        app_metadata: { role: 'admin_pusat' },
      })
    }

    if (adminUserId) {
      await prisma.user.upsert({
        where: { id: adminUserId },
        update: { role: 'admin_pusat' },
        create: {
          id: adminUserId,
          email: adminEmail,
          name: 'Super Admin',
          role: 'admin_pusat',
        },
      })
      console.log(`✅ Admin user ensured in Prisma DB: ${adminEmail}`)
    }
  } else {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set. Skipping admin user creation.')
  }

  console.log('🌱 Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
