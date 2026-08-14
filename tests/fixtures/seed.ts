import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load testing environment variables explicitly
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('🌱 Seeding testing database...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials missing in .env.test');
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  // 0. Ensure Storage Bucket Exists
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.some(b => b.name === 'documents')) {
    await supabaseAdmin.storage.createBucket('documents', { public: false });
    console.log('✅ Created "documents" storage bucket.');
  }

  // 1. Create Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'Cabang Test Jakarta',
      city: 'Jakarta',
      address: 'Jl. Test No 123',
      phone: '081234567890',
      isActive: true,
    }
  });

  // 2. Create Vehicle Category
  const category = await prisma.vehicleCategory.create({
    data: {
      name: 'SUV',
      capacity: 7,
      transmission: 'Automatic',
      features: { ac: true, multimedia: true },
      imageUrl: 'https://example.com/suv.png'
    }
  });

  // 3. Create Vehicles for different tests
  await prisma.vehicle.create({
    data: {
      id: 'vehicle-race-condition',
      branchId: branch.id,
      categoryId: category.id,
      plateNumber: `RACE-${Date.now()}`,
      dailyRate: 500000,
      status: 'available'
    }
  });

  await prisma.vehicle.create({
    data: {
      id: 'vehicle-self-drive',
      branchId: branch.id,
      categoryId: category.id,
      plateNumber: `SELF-${Date.now()}`,
      dailyRate: 500000,
      status: 'available'
    }
  });

  await prisma.vehicle.create({
    data: {
      id: 'vehicle-with-driver',
      branchId: branch.id,
      categoryId: category.id,
      plateNumber: `DRIV-${Date.now()}`,
      dailyRate: 500000,
      status: 'available'
    }
  });

  await prisma.vehicle.create({
    data: {
      id: 'vehicle-payment-cancel',
      branchId: branch.id,
      categoryId: category.id,
      plateNumber: `CANC-${Date.now()}`,
      dailyRate: 500000,
      status: 'available'
    }
  });

  // 4. Create Driver
  await prisma.driver.create({
    data: {
      id: 'driver-test-1',
      branchId: branch.id,
      name: 'Sopir Test',
      phone: '081234567891',
      licenseNumber: `SIM-${Date.now()}`,
      status: 'available',
      dailyFee: 150000
    }
  });

  // 5. Create Test Customers in Supabase Auth & Prisma
  const customers = [
    { email: 'customer1@test.com', name: 'Customer One', id: 'cust-1' },
    { email: 'customer2@test.com', name: 'Customer Two', id: 'cust-2' }
  ];

  for (const c of customers) {
    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
      email: c.email,
      password: 'Password123!',
      email_confirm: true,
    });

    if (error && !error.message.includes('already been registered')) {
      console.error(`❌ Failed to create auth user ${c.email}:`, error);
    } else {
      let userId = authData.user?.id;
      if (!userId) {
        // Find existing user if already registered
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        userId = listData.users.find(u => u.email === c.email)?.id;
        if (userId) {
          // Force update password to ensure login works
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: 'Password123!',
            email_confirm: true
          });
        }
      }

      if (userId) {
        await prisma.customer.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email: c.email,
            name: c.name,
            phone: '08000000000'
          }
        });
      }
    }
  }

  // 6. Create Admin in Supabase Auth & Prisma
  const adminEmail = 'admin@test.com';
  const { data: adminAuthData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: 'Password123!',
    email_confirm: true,
    app_metadata: { role: 'admin_pusat' },
  });
  
  let adminUserId = adminAuthData.user?.id;
  if (!adminUserId && adminError?.message?.includes('already been registered')) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    adminUserId = listData.users.find(u => u.email === adminEmail)?.id;
    if (adminUserId) {
      await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
        password: 'Password123!',
        app_metadata: { role: 'admin_pusat' },
        email_confirm: true
      });
    }
  }

  if (adminUserId) {
    await prisma.user.upsert({
      where: { id: adminUserId },
      update: { role: 'admin_pusat' },
      create: {
        id: adminUserId,
        email: adminEmail,
        name: 'Test Admin',
        role: 'admin_pusat'
      }
    });
  }

  console.log('✅ Testing seed data created successfully.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
