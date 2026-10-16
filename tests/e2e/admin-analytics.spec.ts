import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { recordVehicleExpenseAction, getVehicleExpensesAction } from '../../src/actions/adminExpense';
import { getAnalyticsData } from '../../src/actions/adminAnalytics';
import { calculateAccrualRevenueProration } from '../../src/lib/analytics/metrics';

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

let staffId: string | undefined;
let adminCabangId: string | undefined;
let adminPusatId: string | undefined;
let vehicleAlphaId = 'v0000000-0000-0000-0000-00000000000a';

test.describe('Admin Analytics Dashboard (Tahap 1 & Finansial Dua Pilar)', () => {

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

    const v1 = await prisma.vehicle.upsert({
      where: { id: vehicleAlphaId },
      update: { branchId: branchAlphaId, currentOdometerKm: 25400, lastServiceOdometerKm: 20000 },
      create: {
        id: vehicleAlphaId,
        plateNumber: 'B 8888 ANL',
        name: 'Camry Hybrid 2024',
        branchId: branchAlphaId,
        categoryId: cat.id,
        dailyRate: 1500000,
        currentOdometerKm: 25400,
        lastServiceOdometerKm: 20000
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
    const testLateFeePaymentId = 'p0000000-0000-0000-0000-00000000000b';

    await prisma.payment.deleteMany({ where: { id: { in: [testPaymentId, testLateFeePaymentId] } } });
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

    await prisma.payment.createMany({
      data: [
        {
          id: testPaymentId,
          bookingId: booking.id,
          amount: 3000000,
          method: 'bank_transfer',
          status: 'success'
        },
        {
          id: testLateFeePaymentId,
          bookingId: booking.id,
          amount: 150000,
          method: 'cash_late_fee',
          status: 'success'
        }
      ]
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
    staffId = authStaff.user?.id;
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
    adminCabangId = authAdminCabang.user?.id;
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
    adminPusatId = authAdminPusat.user?.id;
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

    // 5. Setup Vehicle Expense for Analytics Calculation
    const testExpenseId = 'x0000000-0000-0000-0000-00000000000a';
    await prisma.vehicleExpense.deleteMany({ where: { id: testExpenseId } });
    await prisma.vehicleExpense.create({
      data: {
        id: testExpenseId,
        vehicleId: v1.id,
        branchId: branchAlphaId,
        category: 'routine_service',
        amount: 500000,
        expenseDate: startDate,
        vendorName: 'Bengkel Resmi Toyota',
        invoiceNumber: 'INV-SRV-2026-001',
        description: 'Servis berkala 25.000 km & ganti oli mesin',
        odometerKm: 25400,
        recordedById: adminCabangId!,
        isVoided: false
      }
    });
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

  test('admin_cabang can access /admin/analytics and see KPI, charts, and fleet table with expenses and margin', async ({ page }) => {
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

    // Check KPI cards (Pilar Kas & Akrual terealisasi)
    await expect(page.getByTestId('kpi-net-cash')).toContainText('3.150.000');
    await expect(page.getByTestId('kpi-maintenance-expenses')).toContainText('500.000');
    await expect(page.getByTestId('kpi-operating-cash')).toContainText('2.650.000');
    await expect(page.getByTestId('kpi-realized-revenue')).toContainText('3.150.000');
    await expect(page.getByTestId('kpi-operating-margin')).toContainText('2.650.000');
    await expect(page.getByTestId('kpi-utilization-rate')).toBeVisible();

    // Verify charts
    await expect(page.getByTestId('trend-area-chart')).toBeVisible();
    await expect(page.getByTestId('rental-funnel-chart')).toBeVisible();
    await expect(page.getByTestId('fleet-performance-table')).toBeVisible();

    // Verify metric toggle buttons work on trend chart
    await page.getByTestId('metric-tab-rentalValue').click();
    await page.getByTestId('metric-tab-bookingsCount').click();
    await page.getByTestId('metric-tab-maintenanceExpense').click();
    await page.getByTestId('metric-tab-netCashFlow').click();
    await page.getByTestId('metric-tab-cashInflow').click();

    // Verify fleet table displays vehicle, odometer, maintenance expenses, and unit margin (+Rp 2.650.000)
    const fleetTable = page.getByTestId('fleet-performance-table');
    await expect(fleetTable).toContainText('B 8888 ANL');
    await expect(fleetTable).toContainText('25.400 km');
    await expect(fleetTable).toContainText('500.000');
    await expect(fleetTable).toContainText('+Rp 2.650.000');
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
    const branchTable = page.getByTestId('branch-comparisons-table');
    await expect(branchTable).toBeVisible();
    await expect(branchTable).toContainText('Biaya Servis');
    await expect(branchTable).toContainText('Kas Bersih');
    await expect(branchTable).toContainText('500.000');
    await expect(branchTable).toContainText('2.650.000');

    // Test CSV Export (Daily Summary)
    await page.getByTestId('export-csv-btn').click();
    await expect(page.getByTestId('export-daily-btn')).toBeVisible();

    const downloadDailyPromise = page.waitForEvent('download');
    await page.getByTestId('export-daily-btn').click();
    const downloadDaily = await downloadDailyPromise;
    expect(downloadDaily.suggestedFilename()).toContain('.csv');

    // Test CSV Export (Fleet Performance)
    await page.getByTestId('export-csv-btn').click();
    await expect(page.getByTestId('export-fleet-btn')).toBeVisible();

    const downloadFleetPromise = page.waitForEvent('download');
    await page.getByTestId('export-fleet-btn').click();
    const downloadFleet = await downloadFleetPromise;
    expect(downloadFleet.suggestedFilename()).toContain('.csv');

    // Verify AuditLog record exists for export_csv
    const auditDaily = await prisma.auditLog.findFirst({
      where: {
        action: 'analytics.export_csv',
        entityId: 'export_daily_summary'
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(auditDaily).not.toBeNull();
    expect(auditDaily?.actorRole).toBe('admin_pusat');

    const auditFleet = await prisma.auditLog.findFirst({
      where: {
        action: 'analytics.export_csv',
        entityId: 'export_fleet_performance'
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(auditFleet).not.toBeNull();
    expect(auditFleet?.actorRole).toBe('admin_pusat');
  });

  test('staff_cabang can record maintenance expense via UI with audit log', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', staffEmail);
    await page.fill('input[type="password"]', staffPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin/dashboard');

    // Staff navigates to /admin/vehicles
    await page.goto('/admin/vehicles');
    await page.waitForURL('/admin/vehicles');

    // Open action menu on vehicle in desktop table
    await page.locator('table').getByTestId('vehicle-actions-menu-btn').first().click();
    await expect(page.getByTestId('vehicle-action-expense-btn')).toBeVisible();
    await page.getByTestId('vehicle-action-expense-btn').click();

    // Fill expense form
    await page.getByTestId('expense-category-select').selectOption('tires');
    await page.getByTestId('expense-amount-input').fill('350000');
    await page.getByTestId('expense-vendor-input').fill('Tambal Ban Cepat');
    await page.getByTestId('expense-invoice-input').fill('INV-TIRE-99');
    await page.getByTestId('expense-desc-input').fill('Balancing dan spooring ban depan');
    await page.getByTestId('submit-expense-btn').click();

    // Verify modal is dismissed
    await expect(page.getByTestId('submit-expense-btn')).not.toBeVisible();

    // Verify DB record exists
    const createdExpense = await prisma.vehicleExpense.findFirst({
      where: {
        invoiceNumber: 'INV-TIRE-99',
        category: 'tires'
      }
    });
    expect(createdExpense).not.toBeNull();
    expect(Number(createdExpense?.amount)).toBe(350000);

    // Verify audit log was created
    const createAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'vehicle.expense_recorded',
        entityId: createdExpense!.id
      }
    });
    expect(createAudit).not.toBeNull();
    expect(createAudit?.actorRole).toBe('staff_cabang');

    // Clean up
    await prisma.vehicleExpense.deleteMany({ where: { id: createdExpense!.id } });
  });

  test('Odometer Skip-and-Audit: servis dengan KM tidak wajar tetap tersimpan dan anomali dicatat di audit tanpa merusak currentOdometerKm', async () => {
    const actorCabang = { id: adminCabangId!, role: 'admin_cabang' as const, branchId: branchAlphaId };

    const initialVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleAlphaId } });
    const initialOdo = initialVehicle?.currentOdometerKm;
    const initialLastServiceOdo = initialVehicle?.lastServiceOdometerKm;

    // Catat servis berkala dengan kilometer di luar batas wajar (999.999 km)
    const anomalyRes = await recordVehicleExpenseAction({
      vehicleId: vehicleAlphaId,
      category: 'routine_service',
      amount: 450000,
      odometerKm: 999999, // Terlalu tinggi dibanding currentOdometerKm (25.400)
      vendorName: 'Bengkel Ekstrem',
      invoiceNumber: 'INV-ANOMALY-1',
      actor: actorCabang
    });

    // Biaya HARUS tetap tersimpan (Non-Blocking Finansial)
    expect(anomalyRes.success).toBe(true);
    expect(anomalyRes.expenseId).toBeDefined();
    expect(anomalyRes.warning).toContain('melebihi batas wajar');

    // Verifikasi meter pada Vehicle TIDAK dirusak
    const vehicleAfter = await prisma.vehicle.findUnique({ where: { id: vehicleAlphaId } });
    expect(vehicleAfter?.currentOdometerKm).toBe(initialOdo);
    expect(vehicleAfter?.lastServiceOdometerKm).toBe(initialLastServiceOdo);

    // Verifikasi catatan anomali di AuditLog
    const auditRecord = await prisma.auditLog.findFirst({
      where: { entityId: anomalyRes.expenseId },
      orderBy: { createdAt: 'desc' }
    });
    expect(auditRecord).not.toBeNull();
    expect(auditRecord?.metadata).toMatchObject({
      isOdometerAnomaly: true,
      amount: 450000
    });

    // Cleanup
    await prisma.vehicleExpense.deleteMany({ where: { id: anomalyRes.expenseId } });
  });

  test('Unit tanpa currentOdometerKm tidak memblokir pencatatan servis', async () => {
    const actorCabang = { id: adminCabangId!, role: 'admin_cabang' as const, branchId: branchAlphaId };

    // Buat kendaraan baru tanpa kilometer (null)
    const nullOdoVehicle = await prisma.vehicle.create({
      data: {
        plateNumber: 'B 9999 NUL',
        name: 'Unit Tanpa Odometer',
        branchId: branchAlphaId,
        categoryId: 'c0000000-0000-0000-0000-00000000000a',
        dailyRate: 500000,
        currentOdometerKm: null,
        lastServiceOdometerKm: null
      }
    });

    // Catat servis berkala di 15.000 km
    const res = await recordVehicleExpenseAction({
      vehicleId: nullOdoVehicle.id,
      category: 'routine_service',
      amount: 300000,
      odometerKm: 15000,
      vendorName: 'Bengkel Perdana',
      invoiceNumber: 'INV-NULL-1',
      actor: actorCabang
    });

    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();

    // lastServiceOdometerKm berhasil diupdate
    const updated = await prisma.vehicle.findUnique({ where: { id: nullOdoVehicle.id } });
    expect(updated?.lastServiceOdometerKm).toBe(15000);

    // Cleanup
    await prisma.vehicleExpense.deleteMany({ where: { vehicleId: nullOdoVehicle.id } });
    await prisma.vehicle.delete({ where: { id: nullOdoVehicle.id } });
  });

  test('Prorata sewa lintas batas waktu/bulan menghasilkan total yang presisi sama dengan totalPrice', () => {
    const bookingStart = new Date('2026-10-01T00:00:00Z');
    const bookingEnd = new Date('2026-10-05T00:00:00Z'); // 4 hari (96 jam)
    const totalPrice = 4000000;

    // Window 1: 2 hari pertama
    const win1Start = new Date('2026-10-01T00:00:00Z');
    const win1End = new Date('2026-10-03T00:00:00Z');
    const p1 = calculateAccrualRevenueProration(bookingStart, bookingEnd, totalPrice, win1Start, win1End, new Date('2026-10-10T00:00:00Z'));

    // Window 2: 2 hari kedua
    const win2Start = new Date('2026-10-03T00:00:00Z');
    const win2End = new Date('2026-10-05T00:00:00Z');
    const p2 = calculateAccrualRevenueProration(bookingStart, bookingEnd, totalPrice, win2Start, win2End, new Date('2026-10-10T00:00:00Z'));

    expect(p1.realizedRevenue + p2.realizedRevenue).toBe(totalPrice);
    expect(p1.totalOverlapHours + p2.totalOverlapHours).toBe(96);
  });

  test('Deteksi nota ganda mewajibkan konfirmasi', async () => {
    const actorCabang = { id: adminCabangId!, role: 'admin_cabang' as const, branchId: branchAlphaId };

    // Input pertama
    const firstRes = await recordVehicleExpenseAction({
      vehicleId: vehicleAlphaId,
      category: 'repair',
      amount: 200000,
      vendorName: 'Bengkel Cermat',
      invoiceNumber: 'INV-DUP-TEST',
      actor: actorCabang
    });
    expect(firstRes.success).toBe(true);

    // Input kedua dengan nomor nota dan vendor sama tanpa konfirmasi
    const dupRes = await recordVehicleExpenseAction({
      vehicleId: vehicleAlphaId,
      category: 'repair',
      amount: 200000,
      vendorName: 'Bengkel Cermat',
      invoiceNumber: 'INV-DUP-TEST',
      allowDuplicateInvoice: false,
      actor: actorCabang
    });
    expect(dupRes.requiresConfirmation).toBe(true);
    expect(dupRes.warning).toContain('sudah pernah dicatat di cabang ini');

    // Input kedua dengan allowDuplicateInvoice = true -> Berhasil
    const confirmRes = await recordVehicleExpenseAction({
      vehicleId: vehicleAlphaId,
      category: 'repair',
      amount: 200000,
      vendorName: 'Bengkel Cermat',
      invoiceNumber: 'INV-DUP-TEST',
      allowDuplicateInvoice: true,
      duplicateReason: 'Nota mencakup perbaikan 2 item terpisah',
      actor: actorCabang
    });
    expect(confirmRes.success).toBe(true);

    // Cleanup
    await prisma.vehicleExpense.deleteMany({
      where: { vehicleId: vehicleAlphaId, invoiceNumber: 'INV-DUP-TEST' }
    });
  });

});
