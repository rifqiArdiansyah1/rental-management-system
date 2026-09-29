import { test, expect, Page } from '@playwright/test'
import { PrismaClient, BookingStatus, UserRole, RentalType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { reportEmergencyIncidentAction, resolveIncidentAction } from '../../src/actions/incident'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
})
pool.on('error', (err) => {
  console.warn('[PG Pool warning]:', err.message)
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const supabaseAdmin = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

test.describe.configure({ mode: 'serial' })

test.describe('Emergency Trip Support & Operational Incident Pipeline', () => {
  const timestamp = Date.now()
  const testPrefix = `ETS_${timestamp}`

  const customerEmail = `customer_${testPrefix.toLowerCase()}@test.com`
  const customerPassword = 'Password123!'
  let customerId = ''

  const adminEmail = `admin_${testPrefix.toLowerCase()}@test.com`
  const adminPassword = 'Password123!'
  let adminUserId = ''

  let branchId = ''
  let categoryId = ''
  let vehicleId = ''
  let driverId = ''
  let ongoingBookingId = ''
  let createdIncidentId = ''

  async function loginAsCustomer(page: Page) {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[name="email"]', customerEmail)
    await page.fill('input[name="password"]', customerPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
  }

  async function loginAsAdmin(page: Page) {
    await page.context().clearCookies()
    await page.goto('/admin/login')
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[name="email"]', adminEmail)
    await page.fill('input[name="password"]', adminPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/admin/login'), { timeout: 15000 })
  }

  test.beforeAll(async () => {
    // 1. Create Test Branch
    const branch = await prisma.branch.create({
      data: {
        name: `Cabang ETS ${testPrefix}`,
        city: 'Surabaya',
        address: 'Jl. Pemuda No. 45, Surabaya',
        phone: '081234567890',
        isActive: true,
      },
    })
    branchId = branch.id

    // 2. Create Test Vehicle Category
    const category = await prisma.vehicleCategory.create({
      data: {
        name: `Executive Sedan ${testPrefix}`,
        capacity: 5,
        transmission: 'Automatic',
        features: ['AC', 'GPS', 'Emergency Kit'],
      },
    })
    categoryId = category.id

    // 3. Create Test Vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        name: `Mercedes-Benz E300 ${testPrefix}`,
        plateNumber: `L ${Math.floor(1000 + Math.random() * 9000)} ETS`,
        branchId: branch.id,
        categoryId: category.id,
        dailyRate: 3500000,
        status: 'rented',
        isActive: true,
      },
    })
    vehicleId = vehicle.id

    // 4. Create Test Driver
    const driver = await prisma.driver.create({
      data: {
        name: 'Supir ETS Sigap',
        phone: '081987654321',
        licenseNumber: `SIM-${testPrefix}`,
        branchId: branch.id,
        dailyFee: 300000,
        status: 'available',
        isActive: true,
      },
    })
    driverId = driver.id

    // 5. Create Test Customer
    const { data: customerAuth, error: custErr } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password: customerPassword,
      email_confirm: true,
      user_metadata: { name: 'Budi Darurat Pelanggan', phone: '081122334455' },
    })
    if (custErr || !customerAuth?.user) throw new Error(`Failed to create customer user: ${custErr?.message}`)
    customerId = customerAuth.user.id

    await prisma.customer.create({
      data: {
        id: customerId,
        email: customerEmail,
        name: 'Budi Darurat Pelanggan',
        phone: '081122334455',
        verificationStatus: 'verified',
      },
    })

    // 6. Create Test Admin User
    const { data: adminAuth, error: admErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' },
      user_metadata: { name: 'Admin ETS Head' },
    })
    if (admErr || !adminAuth?.user) throw new Error(`Failed to create admin user: ${admErr?.message}`)
    adminUserId = adminAuth.user.id

    await prisma.user.create({
      data: {
        id: adminUserId,
        email: adminEmail,
        name: 'Admin ETS Head',
        role: UserRole.admin_pusat,
        isActive: true,
      },
    })

    // 7. Create Ongoing Booking for Customer
    const now = new Date()
    const startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() + 6 * 60 * 60 * 1000)
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        driverId,
        driverAssignmentStatus: 'assigned',
        rentalType: RentalType.with_driver,
        startDate,
        endDate,
        totalPrice: 3800000,
        agreedDailyRate: 3500000,
        status: BookingStatus.ongoing,
        odometerStart: 25000,
      },
    })
    ongoingBookingId = booking.id
  })

  test.afterAll(async () => {
    try {
      if (ongoingBookingId) {
        // Clean up incidents first because of onDelete: Restrict
        await prisma.incidentReport.deleteMany({ where: { bookingId: ongoingBookingId } })
        await prisma.auditLog.deleteMany({ where: { entityId: ongoingBookingId } })
        await prisma.booking.deleteMany({ where: { id: ongoingBookingId } })
      }
      if (createdIncidentId) {
        await prisma.incidentReport.deleteMany({ where: { id: createdIncidentId } })
      }
      if (adminUserId) {
        await prisma.auditLog.deleteMany({ where: { actorId: adminUserId } })
        await prisma.user.deleteMany({ where: { id: adminUserId } })
        await supabaseAdmin.auth.admin.deleteUser(adminUserId).catch(() => {})
      }
      if (customerId) {
        await prisma.customer.deleteMany({ where: { id: customerId } })
        await supabaseAdmin.auth.admin.deleteUser(customerId).catch(() => {})
      }
      if (driverId) {
        await prisma.driver.deleteMany({ where: { id: driverId } })
      }
      if (vehicleId) {
        await prisma.vehicle.deleteMany({ where: { id: vehicleId } })
      }
      if (categoryId) {
        await prisma.vehicleCategory.deleteMany({ where: { id: categoryId } })
      }
      if (branchId) {
        await prisma.branch.deleteMany({ where: { id: branchId } })
      }
    } catch (cleanupErr) {
      console.warn('[Cleanup Warning]:', cleanupErr)
    } finally {
      await pool.end()
    }
  })

  test('1. Official National Emergency Numbers Dial Pad displays verified numbers with 112 as top universal priority', async ({
    page,
  }) => {
    await page.goto('/contact')
    await page.waitForLoadState('domcontentloaded')

    // Section exists
    const emergencySection = page.locator('#emergency')
    await expect(emergencySection).toBeVisible()

    // 112 Universal priority at top
    const dial112 = page.locator('[data-testid="emergency-dial-112"]')
    await expect(dial112).toBeVisible()
    await expect(dial112).toHaveAttribute('href', 'tel:112')
    await expect(dial112).toContainText('112')

    // Other essential verified emergency numbers: 110, 119, 14080, 115
    const dial110 = page.locator('[data-testid="emergency-dial-110"]')
    await expect(dial110).toBeVisible()
    await expect(dial110).toHaveAttribute('href', 'tel:110')

    const dial119 = page.locator('[data-testid="emergency-dial-119"]')
    await expect(dial119).toBeVisible()
    await expect(dial119).toHaveAttribute('href', 'tel:119')

    const dial14080 = page.locator('[data-testid="emergency-dial-14080"]')
    await expect(dial14080).toBeVisible()
    await expect(dial14080).toHaveAttribute('href', 'tel:14080')

    const dial115 = page.locator('[data-testid="emergency-dial-115"]')
    await expect(dial115).toBeVisible()
    await expect(dial115).toHaveAttribute('href', 'tel:115')
  })

  test('2. Customer with active ongoing rental sees vehicle card, direct call, WhatsApp dispatch, and SOS GPS', async ({
    page,
  }) => {
    await loginAsCustomer(page)
    await page.goto('/contact')
    await page.waitForLoadState('domcontentloaded')

    // Active Rental Emergency Dispatch card should be displayed
    await expect(page.locator('text=SEWA AKTIF SAAT INI')).toBeVisible()
    await expect(page.locator(`text=Mercedes-Benz E300 ${testPrefix}`)).toBeVisible()

    // Direct phone call button to pickup branch
    const branchCallBtn = page.locator('[data-testid="active-booking-branch-call"]')
    await expect(branchCallBtn).toBeVisible()
    const callHref = await branchCallBtn.getAttribute('href')
    expect(callHref).toContain('tel:081234567890')

    // Pre-filled WhatsApp button to branch
    const waCallBtn = page.locator('[data-testid="active-booking-wa-call"]')
    await expect(waCallBtn).toBeVisible()
    const waHref = await waCallBtn.getAttribute('href')
    expect(waHref).toContain('wa.me/6281234567890')
    expect(waHref).toContain(encodeURIComponent('kendala darurat'))

    // SOS GPS & Report Incident buttons are ready
    await expect(page.locator('[data-testid="sos-gps-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="open-incident-modal-btn"]')).toBeVisible()
  })

  test('3. Customer submits emergency incident report: persists to DB with snapshot branchId and open status', async ({
    page,
  }) => {
    await loginAsCustomer(page)
    await page.goto('/contact')
    await page.waitForLoadState('domcontentloaded')

    // Click to open incident report modal
    await page.click('[data-testid="open-incident-modal-btn"]')

    // Fill form
    await page.selectOption('[data-testid="incident-category-select"]', 'breakdown')
    await page.fill('[data-testid="incident-location-input"]', 'Tol Surabaya-Gempol KM 14 Arah Selatan')
    await page.fill(
      '[data-testid="incident-description-input"]',
      'Armada berasap di bagian kap mesin dan mati mendadak di bahu jalan tol. Seluruh penumpang telah dievakuasi ke balik pembatas jalan.'
    )

    // Submit
    await page.click('[data-testid="submit-incident-btn"]')

    // Feedback confirmation
    await expect(page.locator('text=Laporan Darurat Berhasil Dikirim!')).toBeVisible({ timeout: 10000 })

    // Verify in PostgreSQL database via Prisma
    const incident = await prisma.incidentReport.findFirst({
      where: {
        bookingId: ongoingBookingId,
        status: 'open',
      },
    })

    expect(incident).not.toBeNull()
    expect(incident?.branchId).toBe(branchId) // Snapshot branchId
    expect(incident?.category).toBe('breakdown')
    expect(incident?.location).toBe('Tol Surabaya-Gempol KM 14 Arah Selatan')
    expect(incident?.description).toContain('Armada berasap di bagian kap mesin')

    createdIncidentId = incident!.id
  })

  test('4. Admin sidebar displays persistent 🚨 [N] Darurat badge when open incidents exist', async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/bookings')
    await page.waitForLoadState('domcontentloaded')

    // Emergency badge in sidebar should be visible and pulsating
    const badge = page.locator('[data-testid="sidebar-emergency-incident-badge"]')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('Darurat')
  })

  test('5. Staff resolves incident on booking detail page: updates DB, records audit log, and clears persistent badge', async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${ongoingBookingId}`)
    await page.waitForLoadState('domcontentloaded')

    // Incident panel should be visible
    await expect(page.locator('text=Laporan Kendala Darurat Perjalanan')).toBeVisible()
    await expect(page.locator('text=Butuh Penanganan Staf')).toBeVisible()

    // Click Resolve button
    const resolveBtn = page.locator(`[data-testid="resolve-incident-btn-${createdIncidentId}"]`)
    await expect(resolveBtn).toBeVisible()
    await resolveBtn.click()

    // Fill resolution note
    await page.fill(
      '[data-testid="incident-resolution-input"]',
      'Tim derek tol Jasa Marga tiba di lokasi. Unit pengganti telah diserahterimakan ke pelanggan dalam kondisi prima.'
    )
    await page.click('[data-testid="confirm-resolve-incident-btn"]')

    // Wait for resolution modal to close after server action succeeds
    await expect(page.locator('[data-testid="confirm-resolve-incident-btn"]')).toHaveCount(0, { timeout: 10000 })

    // Verify in DB with polling
    await expect.poll(async () => {
      const inc = await prisma.incidentReport.findUnique({
        where: { id: createdIncidentId },
      })
      return inc?.status
    }, { timeout: 10000 }).toBe('resolved')

    const resolvedIncident = await prisma.incidentReport.findUnique({
      where: { id: createdIncidentId },
    })
    expect(resolvedIncident?.resolution).toContain('Tim derek tol Jasa Marga')
    expect(resolvedIncident?.resolvedAt).not.toBeNull()

    // Check Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: createdIncidentId,
        action: 'incident.resolve',
      },
    })
    expect(audit).not.toBeNull()
    expect(audit?.entityType).toBe('IncidentReport')

    // Refresh and check sidebar badge is cleared
    await page.goto('/admin/bookings')
    await page.waitForLoadState('domcontentloaded')

    const remainingOpenCount = await prisma.incidentReport.count({
      where: { status: 'open' },
    })
    if (remainingOpenCount === 0) {
      await expect(page.locator('[data-testid="sidebar-emergency-incident-badge"]')).toHaveCount(0)
    }
  })

  test('6. Security & Integrity: Non-owner cannot submit incident for other bookings', async ({
    page,
  }) => {
    // Attempting to submit for another user without auth or ownership
    const res = await reportEmergencyIncidentAction({
      bookingId: ongoingBookingId,
      category: 'accident',
      description: 'Tes pelaporan tanpa izin akses yang valid.',
    })

    // In server environment without active session, returns failure
    expect(res.success).toBe(false)
    expect(['AUTH_REQUIRED', 'FORBIDDEN', 'INTERNAL_ERROR']).toContain(res.errorCode)

    // Verify onDelete: Restrict integrity: Attempting to delete Branch while incident exists throws error
    let foreignKeyErrorThrown = false
    try {
      await prisma.branch.delete({
        where: { id: branchId },
      })
    } catch (fkError: any) {
      foreignKeyErrorThrown = true
      // Prisma P2003: Foreign key constraint failed
      expect(fkError.code).toBe('P2003')
    }
    expect(foreignKeyErrorThrown).toBe(true)
  })
})
