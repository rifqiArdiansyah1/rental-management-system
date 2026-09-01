import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

let branchAId = 'a1111111-1111-1111-1111-11111111111a';
let branchBId = 'b2222222-2222-2222-2222-22222222222b';
let categoryId = 'c3333333-3333-3333-3333-33333333333c';

let adminPusatEmail = 'admin_pusat_audit@test.com';
let adminPusatPassword = 'Password123!';
let adminPusatId: string;

let adminCabangAEmail = 'admin_cabang_a_audit@test.com';
let adminCabangAPassword = 'Password123!';
let adminCabangAId: string;

let staffCabangAEmail = 'staff_cabang_a_audit@test.com';
let staffCabangAPassword = 'Password123!';
let staffCabangAId: string;

test.describe('Audit Log & Jejak Aktivitas Terpusat', () => {

  test.beforeAll(async () => {
    // 1. Setup Branches
    await prisma.branch.upsert({
      where: { id: branchAId },
      update: {},
      create: { id: branchAId, name: 'Cabang Alpha Audit', city: 'Surabaya', address: 'Jl. Alpha 1', phone: '081111' }
    });
    await prisma.branch.upsert({
      where: { id: branchBId },
      update: {},
      create: { id: branchBId, name: 'Cabang Beta Audit', city: 'Jakarta', address: 'Jl. Beta 2', phone: '082222' }
    });

    // 2. Setup Category
    await prisma.vehicleCategory.upsert({
      where: { id: categoryId },
      update: {},
      create: { id: categoryId, name: 'Luxury Audit', capacity: 5, transmission: 'Automatic', features: [] }
    });

    // 3. Setup Users via Supabase Admin
    const supabaseAdmin = createClient(
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Admin Pusat
    let { data: authPusat } = await supabaseAdmin.auth.admin.createUser({
      email: adminPusatEmail,
      password: adminPusatPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' },
    });
    adminPusatId = authPusat.user?.id || '';
    if (!adminPusatId) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      adminPusatId = data.users.find(u => u.email === adminPusatEmail)?.id || '';
    }
    if (adminPusatId) {
      await supabaseAdmin.auth.admin.updateUserById(adminPusatId, { app_metadata: { role: 'admin_pusat' } });
      await prisma.user.upsert({
        where: { id: adminPusatId },
        update: { role: 'admin_pusat' },
        create: { id: adminPusatId, email: adminPusatEmail, name: 'Super Admin Audit', role: 'admin_pusat' }
      });
    }

    // Admin Cabang A
    let { data: authAdminA } = await supabaseAdmin.auth.admin.createUser({
      email: adminCabangAEmail,
      password: adminCabangAPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_cabang', branchId: branchAId },
    });
    adminCabangAId = authAdminA.user?.id || '';
    if (!adminCabangAId) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      adminCabangAId = data.users.find(u => u.email === adminCabangAEmail)?.id || '';
    }
    if (adminCabangAId) {
      await supabaseAdmin.auth.admin.updateUserById(adminCabangAId, { app_metadata: { role: 'admin_cabang', branchId: branchAId } });
      await prisma.user.upsert({
        where: { id: adminCabangAId },
        update: { role: 'admin_cabang', branchId: branchAId },
        create: { id: adminCabangAId, email: adminCabangAEmail, name: 'Admin Cabang Alpha Audit', role: 'admin_cabang', branchId: branchAId }
      });
    }

    // Staff Cabang A
    let { data: authStaffA } = await supabaseAdmin.auth.admin.createUser({
      email: staffCabangAEmail,
      password: staffCabangAPassword,
      email_confirm: true,
      app_metadata: { role: 'staff_cabang', branchId: branchAId },
    });
    staffCabangAId = authStaffA.user?.id || '';
    if (!staffCabangAId) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      staffCabangAId = data.users.find(u => u.email === staffCabangAEmail)?.id || '';
    }
    if (staffCabangAId) {
      await supabaseAdmin.auth.admin.updateUserById(staffCabangAId, { app_metadata: { role: 'staff_cabang', branchId: branchAId } });
      await prisma.user.upsert({
        where: { id: staffCabangAId },
        update: { role: 'staff_cabang', branchId: branchAId },
        create: { id: staffCabangAId, email: staffCabangAEmail, name: 'Staff Alpha Audit', role: 'staff_cabang', branchId: branchAId }
      });
    }
  });

  test('1. Staff Cabang is blocked from accessing /admin/audit-logs (RBAC Guard)', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', staffCabangAEmail);
    await page.fill('input[type="password"]', staffCabangAPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/dashboard');

    // Attempt direct navigation to /admin/audit-logs
    await page.goto('/admin/audit-logs');
    // Must be redirected back to dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('2. Admin Pusat creates Vehicle in Cabang A -> AuditLog is recorded with Cabang A branchId and visible to Admin Cabang A', async ({ page }) => {
    // 1. Login as Admin Pusat
    await page.context().clearCookies();
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', adminPusatEmail);
    await page.fill('input[type="password"]', adminPusatPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/dashboard');

    // 2. Create Vehicle in Cabang Alpha
    await page.goto('/admin/vehicles');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '+ Tambah Kendaraan' }).click();

    const uniquePlate = `L ${Math.floor(1000 + Math.random() * 9000)} AUD`;
    await page.fill('input[placeholder="Misal: BMW 730Li M Sport / Toyota Alphard"]', 'Innova Zenix Audit');
    await page.fill('input[placeholder="B 1234 ABC"]', uniquePlate);
    await page.fill('input[placeholder="500000"]', '750000');
    
    // Select category and Cabang Alpha inside the modal form using exact values
    await page.locator('form select').first().selectOption(categoryId);
    await page.locator('form select').nth(1).selectOption(branchAId);
    
    await page.getByRole('button', { name: 'Simpan Kendaraan' }).click();
    
    // Wait for the modal to close
    await expect(page.locator('h3:has-text("Tambah Kendaraan Baru")')).not.toBeVisible({ timeout: 15000 });

    // 3. Verify in DB that AuditLog has target branchId = branchAId
    const vehicleLog = await prisma.auditLog.findFirst({
      where: {
        action: 'vehicle.create',
        branchId: branchAId
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(vehicleLog).not.toBeNull();
    expect(vehicleLog?.actorId).toBe(adminPusatId);
    expect(vehicleLog?.actorRole).toBe('admin_pusat');
    expect(vehicleLog?.branchId).toBe(branchAId);

    // 4. Login as Admin Cabang A -> Verify the log appears in their audit list!
    await page.context().clearCookies();
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', adminCabangAEmail);
    await page.fill('input[type="password"]', adminCabangAPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/dashboard');

    await page.goto('/admin/audit-logs');
    await page.waitForLoadState('networkidle');

    // Verify the vehicle.create entry is visible
    await expect(page.locator('text=vehicle.create').first()).toBeVisible();
    await expect(page.locator('text=Cabang Alpha Audit').first()).toBeVisible();

    // 5. Open Metadata Modal
    await page.locator('button:has-text("Detail")').first().click();
    await expect(page.locator('text=Detail Metadata Log')).toBeVisible();
    await expect(page.locator(`text=${uniquePlate.replace(/\s+/g, '')}`)).toBeVisible();
    await page.getByRole('button', { name: 'Tutup' }).click();
  });

  test('3. Booking cancel and Driver reassignment audit logging & filter functionality', async ({ page }) => {
    // 1. Setup a vehicle, customer, and booking in Branch A
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Camry Test Audit',
        plateNumber: `L ${Math.floor(1000 + Math.random() * 9000)} TST`,
        categoryId: categoryId,
        branchId: branchAId,
        dailyRate: 600000,
        status: 'available',
        isActive: true
      }
    });

    const cust = await prisma.customer.upsert({
      where: { email: 'cust_audit_test@test.com' },
      update: {},
      create: { email: 'cust_audit_test@test.com', name: 'Cust Audit Test', phone: '08999' }
    });

    const driverA = await prisma.driver.create({
      data: {
        name: 'Pak Budi Audit',
        phone: '08123456789',
        licenseNumber: `SIM-A-${Date.now().toString().slice(-6)}`,
        branchId: branchAId,
        dailyFee: 150000,
        status: 'available',
        isActive: true
      }
    });

    const driverB = await prisma.driver.create({
      data: {
        name: 'Pak Joko Audit',
        phone: '08123456780',
        licenseNumber: `SIM-A-${(Date.now() + 1).toString().slice(-6)}`,
        branchId: branchAId,
        dailyFee: 150000,
        status: 'available',
        isActive: true
      }
    });

    const booking = await prisma.booking.create({
      data: {
        customerId: cust.id,
        vehicleId: vehicle.id,
        pickupBranchId: branchAId,
        returnBranchId: branchAId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        totalPrice: 1500000,
        status: 'confirmed',
        rentalType: 'with_driver',
        driverId: driverA.id,
        driverAssignmentStatus: 'assigned'
      }
    });

    // 2. Login as Admin Cabang A
    await page.context().clearCookies();
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', adminCabangAEmail);
    await page.fill('input[type="password"]', adminCabangAPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/dashboard');

    // 3. Reassign Driver on Booking Detail Page
    await page.goto(`/admin/bookings/${booking.id}`);
    await page.waitForLoadState('networkidle');

    // Select new driver by driverB id
    await page.locator('select').filter({ has: page.locator(`option[value="${driverB.id}"]`) }).selectOption(driverB.id);
    await page.fill('input[placeholder="Alasan pergantian sopir (opsional)"]', 'Sopir berhalangan karena urusan keluarga mendadak');
    await page.getByRole('button', { name: 'Ganti Sopir' }).click();
    
    // Wait for the reassigned driver to be displayed on page
    await expect(page.getByText('Pak Joko Audit', { exact: true })).toBeVisible({ timeout: 15000 });

    // Verify driver.reassign AuditLog in DB
    const reassignLog = await prisma.auditLog.findFirst({
      where: {
        action: 'driver.reassign',
        entityId: booking.id
      }
    });
    expect(reassignLog).not.toBeNull();
    expect(reassignLog?.actorId).toBe(adminCabangAId);
    expect(reassignLog?.actorRole).toBe('admin_cabang');

    // 4. Cancel Booking
    await page.getByRole('button', { name: 'Batalkan Pesanan (Force Cancel)' }).click();
    await page.fill('textarea[placeholder="Misal: Dokumen palsu - Refund akan diproses 3 hari kerja"]', 'Dibatalkan atas permintaan pelanggan.');
    await page.getByRole('button', { name: 'Batalkan Sekarang' }).click();
    
    // Wait for the cancel modal to close
    await expect(page.locator('h3:has-text("Batalkan Pesanan Secara Sepihak")')).not.toBeVisible({ timeout: 15000 });

    // Verify booking.cancel AuditLog in DB
    const cancelLog = await prisma.auditLog.findFirst({
      where: {
        action: 'booking.cancel',
        entityId: booking.id
      }
    });
    expect(cancelLog).not.toBeNull();
    expect(cancelLog?.actorId).toBe(adminCabangAId);
    expect(cancelLog?.branchId).toBe(branchAId);

    // 5. Check Audit Log page with Category Filter
    await page.goto('/admin/audit-logs');
    await page.locator('select').filter({ has: page.locator('option:has-text("Semua Kategori Aksi")') }).selectOption('driver');
    await page.getByRole('button', { name: 'Terapkan Filter' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=driver.reassign').first()).toBeVisible();

    await page.locator('select').filter({ has: page.locator('option:has-text("Semua Kategori Aksi")') }).selectOption('booking');
    await page.getByRole('button', { name: 'Terapkan Filter' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=booking.cancel').first()).toBeVisible();
  });

});
