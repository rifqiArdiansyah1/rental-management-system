import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

let branchAlphaId = 'e0000000-0000-0000-0000-00000000000a';
let branchBetaId = 'e0000000-0000-0000-0000-00000000000b';

let staffEmail = 'staff_analytics_test@test.com';
let staffPassword = 'Password123!';

let adminCabangEmail = 'admin_cabang_analytics@test.com';
let adminCabangPassword = 'Password123!';

let adminPusatEmail = 'admin_pusat_analytics@test.com';
let adminPusatPassword = 'Password123!';

test.describe('Admin Analytics Dashboard (Tahap 1)', () => {

  test.beforeAll(async () => {
    // 1. Setup Branches
    await prisma.branch.upsert({
      where: { id: branchAlphaId },
      update: {},
      create: { id: branchAlphaId, name: 'Cabang Analytics Alpha', city: 'Jakarta', address: 'Jl. Alpha 1', phone: '0812111111' }
    });
    await prisma.branch.upsert({
      where: { id: branchBetaId },
      update: {},
      create: { id: branchBetaId, name: 'Cabang Analytics Beta', city: 'Bandung', address: 'Jl. Beta 2', phone: '0812222222' }
    });

    // 2. Setup Category & Vehicles
    const cat = await prisma.vehicleCategory.upsert({
      where: { id: 'c0000000-0000-0000-0000-00000000000a' },
      update: {},
      create: { id: 'c0000000-0000-0000-0000-00000000000a', name: 'Premium Sedan', capacity: 5, transmission: 'Auto', features: [] }
    });

    let vehicleAlphaId = 'v0000000-0000-0000-0000-00000000000a';
    const v1 = await prisma.vehicle.upsert({
      where: { id: vehicleAlphaId },
      update: { branchId: branchAlphaId, currentOdometerKm: 25400 },
      create: {
        id: vehicleAlphaId,
        plateNumber: 'B 8888 ANL',
        name: 'Camry Hybrid 2024',
        branchId: branchAlphaId,
        categoryId: cat.id,
        dailyRate: 1500000,
        currentOdometerKm: 25400
      }
    });

    // 3. Setup Customer & Bookings
    const customer = await prisma.customer.upsert({
      where: { email: 'cust_analytics@test.com' },
      update: { verificationStatus: 'verified' },
      create: {
        email: 'cust_analytics@test.com',
        name: 'Budi Hartono',
        phone: '0819999999',
        ktpNumber: '3171012345670001',
        simNumber: '123456789012',
        verificationStatus: 'verified'
      }
    });

    const now = new Date();
    const startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    const testBookingId = 'b0000000-0000-0000-0000-00000000000a';
    const testPaymentId = 'p0000000-0000-0000-0000-00000000000a';
    await prisma.payment.deleteMany({ where: { id: testPaymentId } });
    await prisma.booking.deleteMany({ where: { id: testBookingId } });

    const booking = await prisma.booking.create({
      data: {
        id: testBookingId,
        customerId: customer.id,
        vehicleId: v1.id,
        pickupBranchId: branchAlphaId,
        returnBranchId: branchAlphaId,
        startDate,
        endDate,
        totalPrice: 3000000,
        status: 'completed',
        rentalType: 'self_drive',
        bookingChannel: 'online',
        lateFeeAmount: 150000,
        actualReturnAt: endDate
      }
    });

    await prisma.payment.create({
      data: {
        id: testPaymentId,
        bookingId: booking.id,
        amount: 3000000,
        method: 'bank_transfer',
        status: 'success'
      }
    });

    // 4. Setup Auth Users via Supabase Admin
    const supabaseAdmin = createClient(
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create staff_cabang
    let { data: authStaff } = await supabaseAdmin.auth.admin.createUser({
      email: staffEmail,
      password: staffPassword,
      email_confirm: true,
      app_metadata: { role: 'staff_cabang', branchId: branchAlphaId }
    });
    let staffId = authStaff.user?.id;
    if (!staffId) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      staffId = data.users.find(u => u.email === staffEmail)?.id;
    }
    if (staffId) {
      await supabaseAdmin.auth.admin.updateUserById(staffId, { app_metadata: { role: 'staff_cabang', branchId: branchAlphaId } });
      await prisma.user.upsert({
        where: { id: staffId },
        update: { role: 'staff_cabang', branchId: branchAlphaId },
        create: { id: staffId, email: staffEmail, name: 'Staff Cabang Analytics', role: 'staff_cabang', branchId: branchAlphaId }
      });
    }

    // Create admin_cabang
    let { data: authAdminCabang } = await supabaseAdmin.auth.admin.createUser({
      email: adminCabangEmail,
      password: adminCabangPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_cabang', branchId: branchAlphaId }
    });
    let adminCabangId = authAdminCabang.user?.id;
    if (!adminCabangId) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      adminCabangId = data.users.find(u => u.email === adminCabangEmail)?.id;
    }
    if (adminCabangId) {
      await supabaseAdmin.auth.admin.updateUserById(adminCabangId, { app_metadata: { role: 'admin_cabang', branchId: branchAlphaId } });
      await prisma.user.upsert({
        where: { id: adminCabangId },
        update: { role: 'admin_cabang', branchId: branchAlphaId },
        create: { id: adminCabangId, email: adminCabangEmail, name: 'Admin Cabang Analytics', role: 'admin_cabang', branchId: branchAlphaId }
      });
    }

    // Create admin_pusat
    let { data: authAdminPusat } = await supabaseAdmin.auth.admin.createUser({
      email: adminPusatEmail,
      password: adminPusatPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' }
    });
    let adminPusatId = authAdminPusat.user?.id;
    if (!adminPusatId) {
      const { data } = await supabaseAdmin.auth.admin.listUsers();
      adminPusatId = data.users.find(u => u.email === adminPusatEmail)?.id;
    }
    if (adminPusatId) {
      await supabaseAdmin.auth.admin.updateUserById(adminPusatId, { app_metadata: { role: 'admin_pusat' } });
      await prisma.user.upsert({
        where: { id: adminPusatId },
        update: { role: 'admin_pusat' },
        create: { id: adminPusatId, email: adminPusatEmail, name: 'Admin Pusat Analytics', role: 'admin_pusat' }
      });
    }
  });

  test('staff_cabang cannot access /admin/analytics and is redirected', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', staffEmail);
    await page.fill('input[type="password"]', staffPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/dashboard');

    // Verify sidebar does NOT have "Analisis & Laporan"
    await expect(page.locator('aside').getByRole('link', { name: 'Analisis & Laporan' })).not.toBeVisible();

    // Directly attempt navigating to /admin/analytics
    await page.goto('/admin/analytics');
    // Should be redirected back to /admin/dashboard
    await page.waitForURL('/admin/dashboard');
    expect(page.url()).toContain('/admin/dashboard');
  });

  test('admin_cabang can access /admin/analytics and see KPI, charts, and fleet table', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', adminCabangEmail);
    await page.fill('input[type="password"]', adminCabangPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/dashboard');

    // Sidebar has "Analisis & Laporan"
    const analyticsLink = page.locator('aside').getByRole('link', { name: 'Analisis & Laporan' });
    await expect(analyticsLink).toBeVisible();
    await analyticsLink.click();
    await page.waitForURL('/admin/analytics');

    // Verify main components render
    await expect(page.getByTestId('analytics-page')).toBeVisible();
    await expect(page.getByTestId('kpi-card-grid')).toBeVisible();
    await expect(page.getByTestId('kpi-net-cash')).toBeVisible();
    await expect(page.getByTestId('trend-area-chart')).toBeVisible();
    await expect(page.getByTestId('rental-funnel-chart')).toBeVisible();
    await expect(page.getByTestId('fleet-performance-table')).toBeVisible();

    // Verify metric toggle buttons work on trend chart
    await page.getByTestId('metric-tab-rentalValue').click();
    await page.getByTestId('metric-tab-bookingsCount').click();
    await page.getByTestId('metric-tab-cashInflow').click();

    // Verify fleet table displays vehicle and odometer
    await expect(page.getByTestId('fleet-performance-table')).toContainText('B 8888 ANL');
    await expect(page.getByTestId('fleet-performance-table')).toContainText('25.400 km');
  });

  test('admin_pusat can see branch filter and CSV export logs audit entry', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', adminPusatEmail);
    await page.fill('input[type="password"]', adminPusatPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/dashboard');

    await page.goto('/admin/analytics');
    await page.waitForURL('/admin/analytics');

    // Branch selector should be visible for admin_pusat
    await expect(page.getByTestId('branch-select')).toBeVisible();
    await expect(page.getByTestId('branch-comparisons-table')).toBeVisible();

    // Test CSV Export
    await page.getByTestId('export-csv-btn').click();
    await expect(page.getByTestId('export-daily-btn')).toBeVisible();

    // Click daily export and listen to download
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-daily-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    // Verify AuditLog record exists for export_csv
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        action: 'analytics.export_csv',
        entityId: 'export_daily_summary'
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.actorRole).toBe('admin_pusat');
  });

});
