import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function loginAsCustomer(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')
  await page.fill('input[name="email"]', 'customer1@test.com')
  await page.fill('input[name="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

test.describe('Customer KYC Lifecycle & Post-Payment Onboarding Flow', () => {

  let testBookingId: string
  let customerId: string
  let vehicleId: string
  let branchId: string

  test.beforeAll(async () => {
    const customer = await prisma.customer.findFirst({ where: { email: 'customer1@test.com' } })
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const category = await prisma.vehicleCategory.findFirst()

    if (!customer || !branch || !category) {
      throw new Error('Seed data missing for customer-kyc-flow')
    }

    customerId = customer.id
    branchId = branch.id

    // Clean up existing documents for test customer to start from clean unverified state
    await prisma.document.deleteMany({ where: { customerId } })
    await prisma.customer.update({
      where: { id: customerId },
      data: { verificationStatus: 'pending' }
    })

    // Create test vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Porsche 911 GT3 RS KYC Test',
        plateNumber: `KYC-${Date.now().toString().slice(-4)}`,
        dailyRate: 5000000,
        status: 'available',
        branchId: branch.id,
        categoryId: category.id,
        photos: ['https://example.com/porsche.png']
      }
    })
    vehicleId = vehicle.id

    // Create a confirmed booking for customer1
    const startDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const endDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle.id,
        pickupBranchId: branch.id,
        returnBranchId: branch.id,
        startDate,
        endDate,
        rentalType: 'self_drive',
        status: 'confirmed',
        totalPrice: 10000000
      }
    })
    testBookingId = booking.id
  })

  test.afterAll(async () => {
    if (testBookingId) {
      await prisma.booking.deleteMany({ where: { id: testBookingId } })
    }
    if (vehicleId) {
      await prisma.vehicle.deleteMany({ where: { id: vehicleId } })
    }
  })

  test('1. Post-Payment Stepper Transition: Confirmed booking renders Stepper and Dual-Slot KYC form', async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto(`/booking/${testBookingId}`)
    await page.waitForLoadState('domcontentloaded')

    // Preserved selector contract
    await expect(page.locator('text=CONFIRMED').first()).toBeVisible()

    // Stepper component exists
    const kycSection = page.locator('[data-testid="post-payment-kyc-section"]')
    await expect(kycSection).toBeVisible()

    // Step 1: Pembayaran Lunas
    await expect(kycSection.locator('text=Pembayaran Lunas')).toBeVisible()

    // Step 2: Verifikasi KTP & SIM in stepper
    await expect(kycSection.getByText('Verifikasi KTP & SIM', { exact: true })).toBeVisible()

    // Dual-slot form is rendered
    await expect(page.locator('[data-testid="kyc-slot-ktp"]')).toBeVisible()
    await expect(page.locator('[data-testid="kyc-slot-sim"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-upload-ktp"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-upload-sim"]')).toBeVisible()
  })

  test('2. Soft-Gate Deferral: Skip button opens warning modal and navigates to Dashboard', async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto(`/booking/${testBookingId}`)
    await page.waitForLoadState('domcontentloaded')

    const skipBtn = page.locator('[data-testid="btn-skip-kyc"]')
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()

    // Modal appears
    await expect(page.locator('text=Tunda Verifikasi Dokumen?')).toBeVisible()
    await expect(page.locator('text=TIDAK DAPAT diserahterimakan')).toBeVisible()

    // Click confirm skip to dashboard
    const confirmBtn = page.locator('[data-testid="btn-confirm-skip-dashboard"]')
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  })

  test('3. Proactive Dashboard Nudges: Top urgent banner & granular booking card badge render', async ({ page }) => {
    await loginAsCustomer(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    // Urgent banner on top of dashboard
    const urgentBanner = page.locator('[data-testid="urgent-kyc-banner"]')
    await expect(urgentBanner).toBeVisible()
    await expect(urgentBanner.locator('text=Tindakan Diperlukan Sebelum Penjemputan')).toBeVisible()

    // CTA button smooth scrolls to upload form
    const ctaBtn = urgentBanner.locator('[data-testid="btn-urgent-kyc-cta"]')
    await expect(ctaBtn).toBeVisible()

    // Booking list card has granular badge "Wajib Unggah KTP & SIM"
    const missingBothBadge = page.locator('[data-testid="kyc-badge-missing-both"]')
    await expect(missingBothBadge).toBeVisible()
  })

  test('4. Aggregate Priority & Pending State: Uploaded documents transition to Pending Review', async ({ page }) => {
    // Simulate KTP & SIM uploaded by creating Document records
    await prisma.document.create({
      data: {
        customerId,
        type: 'ktp',
        fileUrl: `${customerId}/test_ktp.jpg`
      }
    })
    await prisma.document.create({
      data: {
        customerId,
        type: 'sim',
        fileUrl: `${customerId}/test_sim.jpg`
      }
    })

    await loginAsCustomer(page)
    await page.goto(`/booking/${testBookingId}`)
    await page.waitForLoadState('domcontentloaded')

    // Should now show Pending Review box
    const pendingBox = page.locator('[data-testid="kyc-pending-box"]')
    await expect(pendingBox).toBeVisible()
    await expect(pendingBox.locator('text=Dokumen Anda Sedang Dalam Antrean Peninjauan')).toBeVisible()

    // Check dashboard banner
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('[data-testid="urgent-kyc-banner-pending"]')).toBeVisible()
    await expect(page.locator('[data-testid="kyc-badge-pending"]')).toBeVisible()
  })

  test('5. Rejection Priority: Rejected KTP supersedes pending SIM (rejected > pending)', async ({ page }) => {
    // Set KTP rejected
    const ktpDoc = await prisma.document.findFirst({ where: { customerId, type: 'ktp' } })
    if (ktpDoc) {
      await prisma.document.update({
        where: { id: ktpDoc.id },
        data: {
          verifiedAt: null,
          rejectionReason: 'Foto KTP buram, NIK tidak terbaca jelas.'
        }
      })
      await prisma.customer.update({
        where: { id: customerId },
        data: { verificationStatus: 'rejected' }
      })
    }

    await loginAsCustomer(page)
    await page.goto(`/booking/${testBookingId}`)
    await page.waitForLoadState('domcontentloaded')

    // Actionable box with rejection warning should be displayed
    const actionableBox = page.locator('[data-testid="kyc-actionable-box"]')
    await expect(actionableBox).toBeVisible()
    await expect(actionableBox.locator('text=Tindakan Diperlukan: Dokumen Memerlukan Perbaikan')).toBeVisible()
    await expect(page.locator('text=Foto KTP buram, NIK tidak terbaca jelas.')).toBeVisible()

    // Dashboard shows rejected badge
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('[data-testid="kyc-badge-rejected"]')).toBeVisible()
  })

  test('6. Verified Customer Exemption: Approved documents render Verified Success Box & enable StartRental', async ({ page }) => {
    // Approve both documents
    await prisma.document.updateMany({
      where: { customerId },
      data: { verifiedAt: new Date(), rejectionReason: null }
    })
    await prisma.customer.update({
      where: { id: customerId },
      data: { verificationStatus: 'verified' }
    })

    await loginAsCustomer(page)
    await page.goto(`/booking/${testBookingId}`)
    await page.waitForLoadState('domcontentloaded')

    // Verified Box is visible
    const verifiedBox = page.locator('[data-testid="kyc-verified-box"]')
    await expect(verifiedBox).toBeVisible()
    await expect(verifiedBox.locator('text=Identitas Anda Telah Terverifikasi Resmi')).toBeVisible()

    // On Dashboard, urgent banner is gone and verified badge is shown
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('[data-testid="urgent-kyc-banner"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="urgent-kyc-banner-pending"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="kyc-badge-verified"]')).toBeVisible()
  })

})
