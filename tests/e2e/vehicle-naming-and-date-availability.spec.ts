import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { getVehicles } from '@/actions/vehicle'
import { getVehicleDisplayName } from '@/lib/vehicleHelper'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const supabaseAdmin = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const testPrefix = 'TEST-AVAIL-'
const plate1 = `${testPrefix}01`
const plate2 = `${testPrefix}02`
const plate3 = `${testPrefix}03`
const plate4 = `${testPrefix}04`

const adminEmail = 'admin@test.com'
const adminPassword = 'Password123!'
const customerEmail = 'customer1@test.com'
const customerPassword = 'Password123!'

let category: { id: string; name: string }
let branch: { id: string; name: string }
let customerUser: { id: string }
let v1: { id: string; name: string; plateNumber: string }
let v2: { id: string; name: string; plateNumber: string }
let v3: { id: string; name: string; plateNumber: string }
let v4: { id: string; name: string; plateNumber: string }
let existingBookingId: string

async function cleanupTestData() {
  await prisma.payment.deleteMany({
    where: { booking: { vehicle: { plateNumber: { startsWith: testPrefix } } } }
  })
  await prisma.booking.deleteMany({
    where: { vehicle: { plateNumber: { startsWith: testPrefix } } }
  })
  await prisma.vehicleUnavailability.deleteMany({
    where: { vehicle: { plateNumber: { startsWith: testPrefix } } }
  })
  await prisma.vehicle.deleteMany({
    where: { plateNumber: { startsWith: testPrefix } }
  })
}

test.describe('Vehicle Naming & Date-Aware Availability Flow', () => {

  test.beforeAll(async () => {
    await cleanupTestData()

    // 1. Ensure branch and category exist
    const existingBranch = await prisma.branch.findFirst({ where: { isActive: true } })
    if (!existingBranch) throw new Error('No active branch found')
    branch = existingBranch

    const existingCat = await prisma.vehicleCategory.findFirst()
    if (!existingCat) throw new Error('No vehicle category found')
    category = existingCat

    // 2. Ensure customer user exists
    const customer = await prisma.customer.findFirst()
    if (!customer) throw new Error('No customer found')
    customerUser = customer

    // 3. Create test vehicles:
    // v1: Available
    v1 = await prisma.vehicle.create({
      data: {
        name: 'Taycan 4S Turbo',
        plateNumber: plate1,
        categoryId: category.id,
        branchId: branch.id,
        dailyRate: 1500000,
        status: 'available',
        isActive: true,
        photos: ['https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=800']
      }
    })

    // v2: Currently Rented (must still appear in catalog for future dates)
    v2 = await prisma.vehicle.create({
      data: {
        name: 'Phantom Extended',
        plateNumber: plate2,
        categoryId: category.id,
        branchId: branch.id,
        dailyRate: 3500000,
        status: 'rented',
        isActive: true,
        photos: ['https://images.unsplash.com/photo-1631295868223-63265b40d9e4?w=800']
      }
    })

    // v3: Windowed Maintenance (has estimatedEndAt -> visible with "Tersedia Mulai" badge)
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
    v3 = await prisma.vehicle.create({
      data: {
        name: 'G-Class AMG 63',
        plateNumber: plate3,
        categoryId: category.id,
        branchId: branch.id,
        dailyRate: 2500000,
        status: 'maintenance',
        isActive: true,
        photos: ['https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=800']
      }
    })
    await prisma.vehicleUnavailability.create({
      data: {
        vehicleId: v3.id,
        startAt: new Date(),
        estimatedEndAt: futureDate,
        reason: 'maintenance',
        createdBy: 'test-admin-system'
      }
    })

    // v4: Indefinite Maintenance (estimatedEndAt is null -> hidden from public catalog)
    v4 = await prisma.vehicle.create({
      data: {
        name: 'Urus Performante',
        plateNumber: plate4,
        categoryId: category.id,
        branchId: branch.id,
        dailyRate: 4000000,
        status: 'maintenance',
        isActive: true,
        photos: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800']
      }
    })
    await prisma.vehicleUnavailability.create({
      data: {
        vehicleId: v4.id,
        startAt: new Date(),
        estimatedEndAt: null,
        reason: 'maintenance',
        createdBy: 'test-admin-system'
      }
    })

    // 4. Create an existing booking for v1 (from tomorrow 10:00 WIB to 3 days later 12:00 WIB)
    const now = new Date()
    const bStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0)
    const bEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 12, 0, 0)

    const existingBooking = await prisma.booking.create({
      data: {
        vehicleId: v1.id,
        customerId: customerUser.id,
        pickupBranchId: branch.id,
        returnBranchId: branch.id,
        startDate: bStart,
        endDate: bEnd,
        rentalType: 'self_drive',
        status: 'confirmed',
        totalPrice: 4500000
      }
    })
    existingBookingId = existingBooking.id
  })

  test.afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
    await pool.end()
  })

  async function loginAsCustomer(page: Page) {
    await page.context().clearCookies()
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[name="email"]', customerEmail)
    await page.fill('input[name="password"]', customerPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 20000 })
  }

  async function loginAsAdmin(page: Page) {
    await page.context().clearCookies()
    await page.goto('/admin/login')
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[type="email"]', adminEmail)
    await page.fill('input[type="password"]', adminPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*\/admin\/(dashboard|vehicles|bookings)/, { timeout: 20000 })
  }

  test('1. Centralized Helper: cleanly separates mode customer vs staff', async () => {
    // Mode customer: returns commercial name without raw plate in title
    const customerDisplay = getVehicleDisplayName(
      { name: 'Taycan 4S Turbo', plateNumber: plate1, category: { name: 'Sports' } },
      { mode: 'customer' }
    )
    expect(customerDisplay).toBe('Taycan 4S Turbo')
    expect(customerDisplay).not.toContain(plate1)

    // Mode staff: returns combined name with plate number in parentheses
    const staffDisplay = getVehicleDisplayName(
      { name: 'Taycan 4S Turbo', plateNumber: plate1, category: { name: 'Sports' } },
      { mode: 'staff' }
    )
    expect(staffDisplay).toBe(`Taycan 4S Turbo (${plate1})`)

    // Fallback when name is empty/null: category name is used
    const fallbackCustomer = getVehicleDisplayName(
      { name: null, plateNumber: plate2, category: { name: 'Luxury Sedan' } },
      { mode: 'customer' }
    )
    expect(fallbackCustomer).toBe('Luxury Sedan')

    const fallbackStaff = getVehicleDisplayName(
      { name: null, plateNumber: plate2, category: { name: 'Luxury Sedan' } },
      { mode: 'staff' }
    )
    expect(fallbackStaff).toBe(`Luxury Sedan (${plate2})`)
  })

  test('2. Date-Aware Catalog Visibility: rented & windowed maintenance visible, indefinite maintenance hidden', async ({ page }) => {
    const catalogVehicles = await getVehicles()
    const catalogIds = catalogVehicles.map((v: any) => v.id)

    // v1 (available) MUST be in catalog
    expect(catalogIds).toContain(v1.id)

    // v2 (rented) MUST be in catalog for future dates
    expect(catalogIds).toContain(v2.id)

    // v3 (windowed maintenance) MUST be in catalog with availability notice
    expect(catalogIds).toContain(v3.id)

    // v4 (indefinite maintenance) MUST BE EXCLUDED from catalog
    expect(catalogIds).not.toContain(v4.id)

    // Verify on Landing Page UI
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // v1 card shows clean vehicle name
    const v1Card = page.locator(`article:has-text("${v1.name}")`).first()
    await expect(v1Card).toBeVisible()

    // v2 (rented) card is visible
    const v2Card = page.locator(`article:has-text("${v2.name}")`).first()
    await expect(v2Card).toBeVisible()

    // v3 (windowed maintenance) card is visible with availability badge
    const v3Card = page.locator(`article:has-text("${v3.name}")`).first()
    await expect(v3Card).toBeVisible()
    await expect(v3Card.locator('text=Tersedia Mulai')).toBeVisible()

    // v4 (indefinite maintenance) card MUST NOT exist
    const v4Card = page.locator(`article:has-text("${v4.name}")`)
    await expect(v4Card).toHaveCount(0)
  })

  test('3. Vehicle Detail & Booking Form: occupied ranges transparency & conflict prevention', async ({ page }) => {
    test.setTimeout(90000)
    // 3a. Vehicle Detail Page
    await page.goto(`/vehicles/${v1.id}`)
    await page.waitForLoadState('domcontentloaded')

    // Heading h1 has clean vehicle name
    const heading = page.locator('h1').first()
    await expect(heading).toContainText(v1.name)
    // Plate number is rendered separately in metadata, not duplicated in title
    await expect(page.getByText(plate1, { exact: true }).first()).toBeVisible()

    // 3b. Vehicle Booking Page (requires customer login)
    await loginAsCustomer(page)
    await page.goto(`/vehicles/${v1.id}/book`)
    await page.waitForLoadState('domcontentloaded')

    // Occupied ranges box should be visible because v1 has an existing booking
    const occupiedBox = page.locator('[data-testid="occupied-ranges-box"]')
    await expect(occupiedBox).toBeVisible()
    await expect(occupiedBox).toContainText('Jadwal Terisi (Tidak Tersedia)')
    await expect(occupiedBox).toContainText('Termasuk jeda buffer 3 jam')

    // Select conflicting dates (the existing booking is from tomorrow 10:00 to 3 days later 12:00)
    const now = new Date()
    const conflictStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0, 0)
    const conflictEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0, 0)

    const toWIBInput = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    const startInput = page.locator('input[type="datetime-local"]').first()
    const endInput = page.locator('input[type="datetime-local"]').nth(1)

    await startInput.fill(toWIBInput(conflictStart))
    await endInput.fill(toWIBInput(conflictEnd))

    // Conflict warning should appear
    const conflictWarning = page.locator('[data-testid="schedule-conflict-warning"]')
    await expect(conflictWarning).toBeVisible()
    await expect(conflictWarning).toContainText('Tanggal yang dipilih bertabrakan dengan jadwal reservasi lain')

    // Submit button should be disabled
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeDisabled()

    // Select non-conflicting future dates (7 days from now)
    const nonConflictStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 10, 0, 0)
    const nonConflictEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9, 10, 0, 0)

    await startInput.fill(toWIBInput(nonConflictStart))
    await endInput.fill(toWIBInput(nonConflictEnd))

    // Conflict warning should disappear and submit button enabled
    await expect(conflictWarning).toHaveCount(0)
    await expect(submitBtn).toBeEnabled()
  })

  test('4. Admin Operational Modals: enforce mode staff with plate number', async ({ page }) => {
    test.setTimeout(90000)
    await loginAsAdmin(page)
    await page.goto('/admin/bookings')
    await page.waitForLoadState('domcontentloaded')

    // Search or find our test booking
    await page.goto(`/admin/bookings?tab=all&q=${plate1}`)
    await page.waitForLoadState('domcontentloaded')

    // The booking card / row should display clean vehicle name
    const bookingRow = page.locator(`tr:has-text("${plate1}"), div:has-text("${plate1}")`).first()
    await expect(bookingRow).toBeVisible()
    await expect(bookingRow).toContainText(v1.name)

    // The Start Rental modal or detail page should display mode staff format
    await page.goto(`/admin/bookings/${existingBookingId}`)
    await page.waitForLoadState('domcontentloaded')

    // In detail header, vehicle display uses mode staff
    const staffTitle = `${v1.name} (${plate1})`
    await expect(page.locator(`text=${staffTitle}`).first()).toBeVisible()

    // Open StartRental confirmation modal if button is present
    const startBtn = page.locator('button:has-text("Mulai Sewa")').first()
    if (await startBtn.isVisible()) {
      await startBtn.click()
      // Modal confirmation dialog should contain the staff mode vehicle name
      const modal = page.locator('div[role="dialog"], div.fixed')
      await expect(modal.locator(`text=${v1.name}`)).toBeVisible()
      await expect(modal.locator(`text=${plate1}`)).toBeVisible()
    }
  })
})
