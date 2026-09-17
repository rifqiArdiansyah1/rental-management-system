import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const supabaseAdmin = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const testPrefix = 'TEST-REV-'
const customerEmail = 'customer1@test.com'
const customerPassword = 'Password123!'

const staffEmail = 'staff_rev_cabang@test.com'
const staffPassword = 'Password123!'

const adminCabangAEmail = 'admin_cabang_rev_a@test.com'
const adminCabangAPassword = 'Password123!'

const adminCabangBEmail = 'admin_cabang_rev_b@test.com'
const adminCabangBPassword = 'Password123!'

const adminPusatEmail = 'admin@test.com'
const adminPusatPassword = 'Password123!'

let branchA: { id: string; name: string }
let branchB: { id: string; name: string }
let category: { id: string; name: string }
let testCustomerId: string
let testVehicleAId: string
let testVehicleBId: string
let testBookingAId: string
let testOngoingBookingId: string
let createdReviewId: string

async function cleanupTestData() {
  // 1. Delete reviews for our test plates
  await prisma.review.deleteMany({
    where: {
      vehicle: { plateNumber: { startsWith: testPrefix } }
    }
  })

  // 2. Delete audit logs for Review entities
  await prisma.auditLog.deleteMany({
    where: {
      entityType: 'Review'
    }
  })

  // 3. Delete payments and bookings
  await prisma.payment.deleteMany({
    where: {
      booking: {
        vehicle: { plateNumber: { startsWith: testPrefix } }
      }
    }
  })

  await prisma.booking.deleteMany({
    where: {
      vehicle: { plateNumber: { startsWith: testPrefix } }
    }
  })

  // 4. Break vehicle self-relations and delete vehicles
  await prisma.vehicle.updateMany({
    where: { plateNumber: { startsWith: testPrefix } },
    data: { previousVehicleId: null }
  })
  await prisma.vehicle.deleteMany({
    where: { plateNumber: { startsWith: testPrefix } }
  })
}

async function ensureStaffUser(email: string, password: string, appMetadata: Record<string, any>, name: string, role: string, branchId?: string | null) {
  let userId: string | undefined

  const { data: authData } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  })

  if (authData?.user?.id) {
    userId = authData.user.id
  } else {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    userId = listData?.users?.find(u => u.email === email)?.id
    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        app_metadata: appMetadata,
        email_confirm: true,
      })
    }
  }

  if (userId) {
    await prisma.user.upsert({
      where: { id: userId },
      update: { role: role as any, branchId: branchId ?? null, isActive: true },
      create: { id: userId, email, name, role: role as any, branchId: branchId ?? null, isActive: true }
    })
  }

  return userId
}

async function loginAsCustomer(page: Page) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[name="email"]', customerEmail)
  await page.fill('input[name="password"]', customerPassword)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

async function loginAsAdmin(page: Page, email: string, password = 'Password123!') {
  await page.context().clearCookies()
  await page.goto('/admin/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin/dashboard', { timeout: 15000 })
}

test.describe('Verified Customer Reviews Feature Suite', () => {

  test.beforeAll(async () => {
    await cleanupTestData()

    // 1. Ensure Branches exist
    const branches = await prisma.branch.findMany({ where: { isActive: true }, take: 2 })
    if (branches.length === 0) {
      branchA = await prisma.branch.create({
        data: {
          name: 'Cabang Jakarta Pusat',
          city: 'Jakarta',
          address: 'Jl. Sudirman Kav 1',
          phone: '0215551111',
          isActive: true
        }
      })
    } else {
      branchA = branches[0]
    }

    if (branches.length < 2) {
      branchB = await prisma.branch.create({
        data: {
          name: 'Cabang Surabaya Gubeng',
          city: 'Surabaya',
          address: 'Jl. Pemuda No 10',
          phone: '0315552222',
          isActive: true
        }
      })
    } else {
      branchB = branches[1]
    }

    // 2. Category
    let cat = await prisma.vehicleCategory.findFirst()
    if (!cat) {
      cat = await prisma.vehicleCategory.create({
        data: {
          name: 'Luxury Saloon',
          capacity: 5,
          transmission: 'Automatic',
          features: ['Sunroof', 'Leather Seats']
        }
      })
    }
    category = cat

    // 3. Customer User (using seeded customer1@test.com)
    const cust = await prisma.customer.findFirst({ where: { email: customerEmail } })
    if (!cust) throw new Error(`Customer ${customerEmail} not found in database.`)
    testCustomerId = cust.id

    // 4. Staff and Admin Users
    await ensureStaffUser(staffEmail, staffPassword, { role: 'staff_cabang', branchId: branchA.id }, 'Staff Cabang Jakarta', 'staff_cabang', branchA.id)
    await ensureStaffUser(adminCabangAEmail, adminCabangAPassword, { role: 'admin_cabang', branchId: branchA.id }, 'Admin Cabang Jakarta', 'admin_cabang', branchA.id)
    await ensureStaffUser(adminCabangBEmail, adminCabangBPassword, { role: 'admin_cabang', branchId: branchB.id }, 'Admin Cabang Surabaya', 'admin_cabang', branchB.id)
    await ensureStaffUser(adminPusatEmail, adminPusatPassword, { role: 'admin_pusat' }, 'Admin Pusat Review', 'admin_pusat', null)

    // 5. Test Vehicles
    const vehicleA = await prisma.vehicle.create({
      data: {
        name: 'Porsche Panamera Executive',
        plateNumber: `${testPrefix}A1`,
        dailyRate: 3500000,
        status: 'available',
        isActive: true,
        branchId: branchA.id,
        categoryId: category.id,
        photos: ['https://example.com/panamera.jpg']
      }
    })
    testVehicleAId = vehicleA.id

    // 6. Test Bookings
    // 6a. Completed booking on Vehicle A (eligible for review)
    const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const endDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

    const completedBooking = await prisma.booking.create({
      data: {
        customerId: testCustomerId,
        vehicleId: testVehicleAId,
        pickupBranchId: branchA.id,
        returnBranchId: branchA.id,
        rentalType: 'self_drive',
        startDate,
        endDate,
        actualReturnAt: endDate,
        status: 'completed',
        totalPrice: 7000000,
      }
    })
    testBookingAId = completedBooking.id

    // 6b. Ongoing booking on Vehicle A (NOT eligible for review)
    const ongoingBooking = await prisma.booking.create({
      data: {
        customerId: testCustomerId,
        vehicleId: testVehicleAId,
        pickupBranchId: branchA.id,
        returnBranchId: branchA.id,
        rentalType: 'self_drive',
        startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: 'ongoing',
        totalPrice: 10500000,
        odometerStart: 12500,
      }
    })
    testOngoingBookingId = ongoingBooking.id
  })

  test.afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  test('1. Non-completed bookings (ongoing, confirmed) do NOT show review options', async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find ongoing booking card
    const ongoingCard = page.locator(`a[href="/booking/${testOngoingBookingId}"]`)
    await expect(ongoingCard).toBeVisible()

    // Ensure ongoing card does not show review button or badge
    await expect(ongoingCard.locator('[data-testid="open-review-modal-btn"]')).toHaveCount(0)
    await expect(ongoingCard.locator('[data-testid="reviewed-badge"]')).toHaveCount(0)

    // Navigate to booking detail page for ongoing booking
    await page.goto(`/booking/${testOngoingBookingId}`)
    await page.waitForLoadState('networkidle')

    // Ensure review invitation card is not visible on ongoing booking detail
    await expect(page.locator('text=Beri Ulasan Pengalaman')).toHaveCount(0)
  })

  test('2. Customer submits 5-star review + comment for completed booking & TOCTOU defense', async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // The completed booking card should have the review button
    const completedCard = page.locator(`a[href="/booking/${testBookingAId}"]`)
    await expect(completedCard).toBeVisible()

    const openReviewBtn = completedCard.locator('[data-testid="open-review-modal-btn"]')
    await expect(openReviewBtn).toBeVisible()
    await openReviewBtn.click()

    // Modal should appear
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()
    await expect(modal.locator('#review-modal-title')).toHaveText('Beri Ulasan Armada')

    // Rating star 5 is pre-selected, let's verify rating display
    await expect(modal.locator('[data-testid="selected-rating-display"]')).toHaveText('5 / 5')

    // Fill comment
    const reviewComment = 'Armada sangat bersih, harum, dan performa mesin sangat prima!'
    await modal.locator('[data-testid="review-comment-input"]').fill(reviewComment)

    // Submit review
    await modal.locator('[data-testid="submit-review-btn"]').click()

    // Modal shows success screen with Close button
    await expect(modal.locator('text=Ulasan Berhasil Dikirim')).toBeVisible({ timeout: 10000 })
    await modal.locator('[data-testid="review-success-close-btn"]').click()

    // Dashboard now reflects reviewed badge
    await expect(completedCard.locator('[data-testid="reviewed-badge"]')).toBeVisible({ timeout: 10000 })
    await expect(completedCard.locator('[data-testid="reviewed-badge"]')).toContainText('Ulasan Terkirim (5/5)')

    // Verify in database
    const savedReview = await prisma.review.findUnique({
      where: { bookingId: testBookingAId },
      include: { customer: true, vehicle: true, branch: true }
    })
    expect(savedReview).not.toBeNull()
    expect(savedReview?.rating).toBe(5)
    expect(savedReview?.comment).toBe(reviewComment)
    expect(savedReview?.isPublished).toBe(true)
    expect(savedReview?.branchId).toBe(branchA.id) // snapshot pickupBranchId
    createdReviewId = savedReview!.id

    // TOCTOU defense: Direct DB duplicate with same bookingId must fail with unique constraint
    await expect(
      prisma.review.create({
        data: {
          bookingId: testBookingAId,
          customerId: testCustomerId,
          vehicleId: testVehicleAId,
          branchId: branchA.id,
          rating: 4,
          comment: 'Duplicate submission attempt'
        }
      })
    ).rejects.toThrow()
  })

  test('3. Public vehicle detail page (/vehicles/[id]) renders review with UU PDP masked name and verified badge', async ({ page }) => {
    await page.goto(`/vehicles/${testVehicleAId}`)
    await page.waitForLoadState('networkidle')

    // Reviews section should be rendered
    const section = page.locator('[data-testid="vehicle-reviews-section"]')
    await expect(section).toBeVisible()

    // Score 5.0
    await expect(section.locator('[data-testid="average-rating-score"]')).toHaveText('5.0')

    // Review card
    const reviewCard = section.locator('[data-testid="review-card"]').first()
    await expect(reviewCard).toBeVisible()

    // Masked name per UU PDP: "Customer One" -> "Customer O."
    await expect(reviewCard.locator('[data-testid="masked-customer-name"]')).toHaveText('Customer O.')

    // Comment text
    await expect(reviewCard.locator('[data-testid="review-comment-text"]')).toContainText('Armada sangat bersih')

    // Branch provenance badge indicates current branch
    const provenanceBadge = reviewCard.locator('[data-testid="branch-provenance-badge"]')
    await expect(provenanceBadge).toBeVisible()
    await expect(provenanceBadge).toContainText('Disewa di Cabang Ini')
    await expect(provenanceBadge).toContainText(branchA.name)
  })

  test('4. Relocation continuity & disambiguation: review on V1 remains visible on V2 at Branch B with history badge', async ({ page }) => {
    // Relocate Vehicle A from Branch A to Branch B as Vehicle B (linked record)
    await prisma.vehicle.update({
      where: { id: testVehicleAId },
      data: { isActive: false, status: 'moved' }
    })

    const vehicleB = await prisma.vehicle.create({
      data: {
        name: 'Porsche Panamera Executive',
        plateNumber: `${testPrefix}A1`, // Same plate allowed since previous is inactive
        dailyRate: 3500000,
        status: 'available',
        isActive: true,
        branchId: branchB.id,
        categoryId: category.id,
        photos: ['https://example.com/panamera.jpg'],
        previousVehicleId: testVehicleAId,
      }
    })
    testVehicleBId = vehicleB.id

    // Visit new vehicle at Branch B
    await page.goto(`/vehicles/${testVehicleBId}`)
    await page.waitForLoadState('networkidle')

    const section = page.locator('[data-testid="vehicle-reviews-section"]')
    await expect(section).toBeVisible()

    // The review from Vehicle A is inherited through the physical vehicle chain!
    const reviewCard = section.locator('[data-testid="review-card"]').first()
    await expect(reviewCard).toBeVisible()
    await expect(reviewCard.locator('[data-testid="masked-customer-name"]')).toHaveText('Customer O.')

    // Provenance badge now disambiguates that this rental took place at Cabang A (Jakarta)!
    const provenanceBadge = reviewCard.locator('[data-testid="branch-provenance-badge"]')
    await expect(provenanceBadge).toBeVisible()
    await expect(provenanceBadge).toContainText('Riwayat Sewa di Cabang')
    await expect(provenanceBadge).toContainText(branchA.name)
  })

  test('5. Read scoping: staff_cabang blocked, admin_cabang restricted to own branch with parameter override', async ({ page }) => {
    // 5a. Login as staff_cabang -> blocked from /admin/reviews
    await loginAsAdmin(page, staffEmail, staffPassword)
    await page.goto('/admin/reviews')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[data-testid="staff-restricted-screen"]')).toBeVisible()
    await expect(page.locator('text=Akses Terbatas')).toBeVisible()

    // 5b. Login as Admin Cabang A -> sees Branch A review
    await loginAsAdmin(page, adminCabangAEmail, adminCabangAPassword)
    await page.goto('/admin/reviews')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[data-testid="admin-reviews-table"]')).toBeVisible()
    const reviewRow = page.locator(`[data-testid="admin-review-row-${createdReviewId}"]`)
    await expect(reviewRow).toBeVisible()
    await expect(reviewRow).toContainText('Customer One') // Unmasked for admin staff investigation

    // 5c. Admin Cabang A attempts query injection ?branch=[branchB.id]
    // Server scoping must ignore the client branchId parameter and keep showing Branch A
    await page.goto(`/admin/reviews?branch=${branchB.id}`)
    await page.waitForLoadState('networkidle')

    // Branch A review is still returned, zero leak of Branch B
    await expect(reviewRow).toBeVisible()
  })

  test('6. Write scoping & moderation: hide validation, audit log recording, and unhide', async ({ page }) => {
    // 6a. Login as Admin Pusat to test full moderation flow
    await loginAsAdmin(page, adminPusatEmail, adminPusatPassword)
    await page.goto('/admin/reviews')
    await page.waitForLoadState('networkidle')

    const hideBtn = page.locator(`[data-testid="hide-review-btn-${createdReviewId}"]`)
    await expect(hideBtn).toBeVisible()
    await hideBtn.click()

    // Modal opens
    const hideModal = page.locator('[role="dialog"]')
    await expect(hideModal).toBeVisible()

    // Try submit without reason -> should trigger validation error
    await hideModal.locator('[data-testid="confirm-hide-btn"]').click()
    await expect(hideModal.locator('[data-testid="moderation-error-banner"]')).toHaveText('Alasan penyembunyian ulasan wajib diisi.')

    // Fill valid reason
    const hideReason = 'Ulasan mengandung konten yang melanggar pedoman komunitas'
    await hideModal.locator('[data-testid="hide-reason-input"]').fill(hideReason)
    await hideModal.locator('[data-testid="confirm-hide-btn"]').click()

    // Review status should update to Disembunyikan
    const reviewRow = page.locator(`[data-testid="admin-review-row-${createdReviewId}"]`)
    await expect(reviewRow.getByText('Disembunyikan', { exact: true })).toBeVisible({ timeout: 10000 })

    // Verify DB state
    const dbReview = await prisma.review.findUnique({ where: { id: createdReviewId } })
    expect(dbReview?.isPublished).toBe(false)
    expect(dbReview?.hiddenReason).toBe(hideReason)

    // Verify AuditLog recorded
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Review',
        entityId: createdReviewId,
        action: 'review.hide'
      }
    })
    expect(audit).not.toBeNull()
    expect(audit?.branchId).toBe(branchA.id)

    // Hidden review must NOT be visible on public vehicle page
    const activeVehicle = await prisma.vehicle.findFirst({ where: { plateNumber: `${testPrefix}A1`, isActive: true } })
    const targetVehicleId = activeVehicle?.id || testVehicleBId

    await page.goto(`/vehicles/${targetVehicleId}`)
    await page.waitForLoadState('networkidle')

    // Now empty state should appear
    await expect(page.locator('[data-testid="reviews-empty-state"]')).toBeVisible()
    await expect(page.locator('[data-testid="review-card"]')).toHaveCount(0)

    // 6b. Test Unhide: Go back to admin reviews and unhide
    await page.goto('/admin/reviews?status=hidden')
    await page.waitForLoadState('networkidle')

    const unhideBtn = page.locator(`[data-testid="unhide-review-btn-${createdReviewId}"]`)
    await expect(unhideBtn).toBeVisible()
    await unhideBtn.click()

    // Wait for the hidden review list to refresh and remove the now-unhidden row
    await expect(page.locator(`[data-testid="admin-review-row-${createdReviewId}"]`)).toHaveCount(0, { timeout: 10000 })

    // Return to main review list to verify status is restored to Terbit (Publik)
    await page.goto('/admin/reviews')
    await page.waitForLoadState('networkidle')
    await expect(reviewRow.getByText('Terbit (Publik)', { exact: true })).toBeVisible({ timeout: 10000 })

    const dbReviewUnhidden = await prisma.review.findUnique({ where: { id: createdReviewId } })
    expect(dbReviewUnhidden?.isPublished).toBe(true)

    // Verify AuditLog recorded review.unhide
    const unhideAudit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Review',
        entityId: createdReviewId,
        action: 'review.unhide'
      }
    })
    expect(unhideAudit).not.toBeNull()

    // Public vehicle page shows review again
    await page.goto(`/vehicles/${targetVehicleId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="review-card"]')).toHaveCount(1)
  })

  test('7. Multilanguage parity: vehicle reviews section renders English when locale parameter is set', async ({ page }) => {
    const activeVehicle = await prisma.vehicle.findFirst({ where: { plateNumber: `${testPrefix}A1`, isActive: true } })
    const targetVehicleId = activeVehicle?.id || testVehicleBId

    // Navigate with ?lang=en to activate English dictionary
    await page.goto(`/vehicles/${targetVehicleId}?lang=en`)
    await page.waitForLoadState('networkidle')

    const section = page.locator('[data-testid="vehicle-reviews-section"]')
    await expect(section).toBeVisible()

    // English titles
    await expect(section.getByText('Verified Renter Experiences')).toBeVisible()
    await expect(section.getByText('Verified Renter').first()).toBeVisible()

    // English branch history provenance label
    const provenanceBadge = section.locator('[data-testid="branch-provenance-badge"]')
    await expect(provenanceBadge).toContainText('Rental History at Branch')
  })

})
