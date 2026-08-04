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
  const catSuv = await prisma.vehicleCategory.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'SUV',
      capacity: 7,
      transmission: 'Automatic',
      features: ['AC', 'Bluetooth', 'Rear Camera'],
    },
  })
  
  const catMpv = await prisma.vehicleCategory.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'MPV',
      capacity: 7,
      transmission: 'Manual',
      features: ['AC', 'Audio System'],
    },
  })
  console.log(`✅ Categories ensured: ${catSuv.name}, ${catMpv.name}`)

  // 3. Mobil (Vehicle)
  await prisma.vehicle.upsert({
    where: { plateNumber: 'B 1234 ABC' },
    update: {},
    create: {
      plateNumber: 'B 1234 ABC',
      branchId: branchPusat.id,
      categoryId: catSuv.id,
      dailyRate: 500000,
    },
  })

  await prisma.vehicle.upsert({
    where: { plateNumber: 'B 5678 DEF' },
    update: {},
    create: {
      plateNumber: 'B 5678 DEF',
      branchId: branchPusat.id,
      categoryId: catMpv.id,
      dailyRate: 350000,
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
        app_metadata: { role: 'admin' },
      })

      if (authError) {
        console.error('❌ Failed to create admin user in Supabase:', authError.message)
      } else if (authData.user) {
        adminUserId = authData.user.id
      }
    } else {
      console.log('Admin auth user already exists, ensuring app_metadata...')
      await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
        app_metadata: { role: 'admin' },
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
