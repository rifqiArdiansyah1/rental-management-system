import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

let branchAId = 'a0000000-0000-0000-0000-00000000000a';
let branchBId = 'b0000000-0000-0000-0000-00000000000b';

let staffAEmail = 'staff_a@test.com';
let staffAPassword = 'Password123!';
let staffBEmail = 'staff_b@test.com';

test.describe('Branch Scoping & RBAC Granular', () => {

  test.beforeAll(async () => {
    // 1. Setup Branches
    await prisma.branch.upsert({
      where: { id: branchAId },
      update: {},
      create: { id: branchAId, name: 'Cabang Alpha', city: 'City A', address: 'Addr A', phone: '111' }
    });
    await prisma.branch.upsert({
      where: { id: branchBId },
      update: {},
      create: { id: branchBId, name: 'Cabang Beta', city: 'City B', address: 'Addr B', phone: '222' }
    });

    // 2. Setup Category
    const cat = await prisma.vehicleCategory.upsert({
      where: { id: 'c0000000-0000-0000-0000-00000000000c' },
      update: {},
      create: { id: 'c0000000-0000-0000-0000-00000000000c', name: 'Standard', capacity: 4, transmission: 'Auto', features: [] }
    });

    // 3. Setup Vehicles for Branch B
    await prisma.vehicle.upsert({
      where: { plateNumber: 'B ETA' },
      update: { branchId: branchBId },
      create: { plateNumber: 'B ETA', branchId: branchBId, categoryId: cat.id, dailyRate: 100000 }
    });

    // 4. Setup Staff Users via Supabase Admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create Staff A
    let { data: authDataA } = await supabaseAdmin.auth.admin.createUser({
      email: staffAEmail,
      password: staffAPassword,
      email_confirm: true,
      app_metadata: { role: 'staff_cabang', branchId: branchAId },
    });
    let staffAId = authDataA.user?.id;
    if (!staffAId) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      staffAId = data.users.find(u => u.email === staffAEmail)?.id;
    }
    if (staffAId) {
      await supabaseAdmin.auth.admin.updateUserById(staffAId, { app_metadata: { role: 'staff_cabang', branchId: branchAId } });
      await prisma.user.upsert({
        where: { id: staffAId },
        update: { role: 'staff_cabang', branchId: branchAId },
        create: { id: staffAId, email: staffAEmail, name: 'Staff A', role: 'staff_cabang', branchId: branchAId }
      });
    }

    // 5. Create a Booking in Branch B
    const customer = await prisma.customer.upsert({
      where: { email: 'cust_b@test.com' },
      update: {},
      create: { email: 'cust_b@test.com', name: 'Cust B', phone: '123' }
    });
    
    // We just create a dummy booking directly via Prisma
    const vehicle = await prisma.vehicle.findUnique({ where: { plateNumber: 'B ETA' } });
    if (vehicle) {
      const existingBooking = await prisma.booking.findFirst({ where: { vehicleId: vehicle.id } });
      if (!existingBooking) {
        await prisma.booking.create({
          data: {
            customerId: customer.id,
            vehicleId: vehicle.id,
            pickupBranchId: branchBId,
            returnBranchId: branchBId,
            startDate: new Date(),
            endDate: new Date(),
            totalPrice: 100000,
            status: 'confirmed',
            rentalType: 'self_drive'
          }
        });
      }
    }
  });

  test('Staff Cabang A cannot see bookings/vehicles of Cabang B', async ({ page }) => {
    // 1. Login as Staff A
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', staffAEmail);
    await page.fill('input[type="password"]', staffAPassword);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to admin dashboard
    await page.waitForURL('/admin/dashboard');

    // 2. Check Dashboard
    // Since Staff A is in Cabang A and the vehicle is in Cabang B, total vehicles should be 0 (if there are no other vehicles in Cabang A)
    // We just assert that it's successfully loaded and scoped
    await expect(page.locator('text=Menampilkan statistik untuk cabang Anda')).toBeVisible();

    // 3. Check Vehicles Page
    await page.goto('/admin/vehicles');
    await page.waitForLoadState('networkidle');
    // Ensure vehicle "B ETA" is not visible
    await expect(page.locator('text=B ETA')).not.toBeVisible();

    // 4. Check Bookings Page
    await page.goto('/admin/bookings');
    await page.waitForLoadState('networkidle');
    // Ensure Customer "Cust B" is not visible
    await expect(page.locator('text=Cust B')).not.toBeVisible();
  });

});
