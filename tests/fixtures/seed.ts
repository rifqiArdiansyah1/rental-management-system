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
  
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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
      name: 'Toyota Fortuner Test',
      photos: ['https://example.com/suv.png'],
      branchId: branch.id,
      categoryId: category.id,
      plateNumber: `RACE-${Date.now()}`,
      dailyRate: 500000,
      fuelType: 'dexlite',
      fuelEfficiencyKmL: 11.5,
      status: 'available'
    }
  });

  await prisma.vehicle.create({
    data: {
      id: 'vehicle-self-drive',
      name: 'Honda CR-V Test',
      photos: ['https://example.com/suv.png'],
      branchId: branch.id,
      categoryId: category.id,
      plateNumber: `SELF-${Date.now()}`,
      dailyRate: 500000,
      fuelType: 'pertamax',
      fuelEfficiencyKmL: 13.0,
      status: 'available'
    }
  });

  await prisma.vehicle.create({
    data: {
      id: 'vehicle-with-driver',
      name: 'Toyota Alphard Test',
      photos: ['https://example.com/suv.png'],
      branchId: branch.id,
      categoryId: category.id,
      plateNumber: `DRIV-${Date.now()}`,
      dailyRate: 500000,
      fuelType: 'pertamax',
      fuelEfficiencyKmL: 10.0,
      status: 'available'
    }
  });

  await prisma.vehicle.create({
    data: {
      id: 'vehicle-payment-cancel',
      name: 'Mitsubishi Pajero Test',
      photos: ['https://example.com/suv.png'],
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
    let userId: string | undefined;
    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
      email: c.email,
      password: 'Password123!',
      email_confirm: true,
    });

    if (authData?.user?.id) {
      userId = authData.user.id;
    } else {
      // Find existing user
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      userId = listData?.users?.find(u => u.email === c.email)?.id;
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: 'Password123!',
          email_confirm: true
        });
      } else {
        console.error(`❌ Could not find or create customer ${c.email}:`, error);
      }
    }

    if (userId) {
      await prisma.customer.upsert({
        where: { id: userId },
        update: { verificationStatus: 'verified' },
        create: {
          id: userId,
          email: c.email,
          name: c.name,
          phone: '08000000000',
          verificationStatus: 'verified'
        }
      });
    }
  }

  // 6. Create Admins in Supabase Auth & Prisma
  const adminList = [
    { email: 'admin@test.com', name: 'Test Admin' },
    { email: 'admin@rental.com', name: 'Super Admin Rental' },
  ];

  for (const admin of adminList) {
    let adminUserId: string | undefined;
    const { data: adminAuthData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: admin.email,
      password: 'Password123!',
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' },
    });
    
    if (adminAuthData?.user?.id) {
      adminUserId = adminAuthData.user.id;
    } else {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      adminUserId = listData?.users?.find(u => u.email === admin.email)?.id;
      if (adminUserId) {
        await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
          password: 'Password123!',
          app_metadata: { role: 'admin_pusat' },
          email_confirm: true
        });
      } else {
        console.error(`❌ Could not find or create admin ${admin.email}:`, adminError);
      }
    }

    if (adminUserId) {
      await prisma.user.upsert({
        where: { id: adminUserId },
        update: { role: 'admin_pusat', isActive: true },
        create: {
          id: adminUserId,
          email: admin.email,
          name: admin.name,
          role: 'admin_pusat',
          isActive: true
        }
      });
    }
  }

  // 6. Seed baseline fuel prices
  const fuelPrices = [
    { fuelType: 'pertalite', pricePerLiter: 10000 },
    { fuelType: 'pertamax', pricePerLiter: 12950 },
    { fuelType: 'pertamax_turbo', pricePerLiter: 14400 },
    { fuelType: 'solar', pricePerLiter: 6800 },
    { fuelType: 'dexlite', pricePerLiter: 13050 },
  ] as const;

  for (const fp of fuelPrices) {
    await prisma.fuelPrice.upsert({
      where: { fuelType: fp.fuelType },
      update: { pricePerLiter: fp.pricePerLiter },
      create: { fuelType: fp.fuelType, pricePerLiter: fp.pricePerLiter }
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
