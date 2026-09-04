import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', 'admin@test.com')
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin/dashboard', { timeout: 15000 })
}

test.describe('Admin Booking Detail Page Enhancements', () => {

  let testBookingId: string
  let testCustomerEmail: string
  let testKtpDocId: string
  let testOngoingBookingId: string

  test.beforeAll(async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const category = await prisma.vehicleCategory.findFirst()

    if (branch && category) {
      testCustomerEmail = `cust-detail-${Date.now()}@test.com`
      const customer = await prisma.customer.create({
        data: {
          id: `cust-detail-${Date.now()}`,
          name: 'Pelanggan Uji Coba Detail',
          email: testCustomerEmail,
          phone: '081299998888',
          verificationStatus: 'pending'
        }
      })

      // Create document for customer
      const doc = await prisma.document.create({
        data: {
          customerId: customer.id,
          type: 'ktp',
          fileUrl: 'https://example.com/ktp-test.jpg',
        }
      })
      testKtpDocId = doc.id

      // Vehicle with clean name
      const vehicle = await prisma.vehicle.create({
        data: {
          name: 'Mercedes-Benz S 450 Luxury',
          plateNumber: `B-${Date.now().toString().slice(-4)}-DET`,
          dailyRate: 2500000,
          status: 'available',
          branchId: branch.id,
          categoryId: category.id,
          photos: ['https://example.com/merc.png']
        }
      })

      const startDate = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000)
      const endDate = new Date(Date.now() + 203 * 24 * 60 * 60 * 1000) // 3 days

      // Booking confirmed with pending KYC
      const booking = await prisma.booking.create({
        data: {
          customerId: customer.id,
          vehicleId: vehicle.id,
          pickupBranchId: branch.id,
          returnBranchId: branch.id,
          rentalType: 'self_drive',
          startDate,
          endDate,
          status: 'confirmed',
          totalPrice: 7500000,
        }
      })
      testBookingId = booking.id

      // Add a payment attempt record
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          method: 'qris',
          amount: 7500000,
          status: 'success',
          gatewayReference: `GW-${Date.now()}`
        }
      })

      // Create a second vehicle & booking for ongoing -> endRental test
      const vehicle2 = await prisma.vehicle.create({
        data: {
          name: 'Toyota Alphard 2.5 G Facelift',
          plateNumber: `B-${Date.now().toString().slice(-4)}-ONG`,
          dailyRate: 1800000,
          status: 'rented',
          branchId: branch.id,
          categoryId: category.id,
          photos: ['https://example.com/alphard.png']
        }
      })

      const ongoingBooking = await prisma.booking.create({
        data: {
          customerId: customer.id,
          vehicleId: vehicle2.id,
          pickupBranchId: branch.id,
          returnBranchId: branch.id,
          rentalType: 'self_drive',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'ongoing',
          totalPrice: 3600000,
        }
      })
      testOngoingBookingId = ongoingBooking.id
    }
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('1. Detail page displays vehicle NAME as primary identifier (not just plate)', async ({ page }) => {
    await page.goto(`/admin/bookings/${testBookingId}`)
    await page.waitForLoadState('networkidle')

    // Check vehicle name is prominent
    await expect(page.locator('text=Mercedes-Benz S 450 Luxury')).toBeVisible()

    // Check Human-friendly booking ID code (e.g. BK-...)
    await expect(page.locator(`text=BK-${testBookingId.slice(0, 8).toUpperCase()}`)).toBeVisible()
  })

  test('2. Price Breakdown & Payment History card renders calculations and transaction log', async ({ page }) => {
    await page.goto(`/admin/bookings/${testBookingId}`)
    await page.waitForLoadState('networkidle')

    // Price card header
    await expect(page.locator('text=Rincian Biaya & Riwayat Pembayaran')).toBeVisible()

    // Subtotal calculation
    await expect(page.locator('text=Sewa Kendaraan')).toBeVisible()
    await expect(page.locator('text=Total Nilai Sewa')).toBeVisible()
    await expect(page.locator('text=Rp 7.500.000').first()).toBeVisible()

    // Transaction table
    await expect(page.locator('text=Riwayat Transaksi Gateway')).toBeVisible()
    await expect(page.locator('td', { hasText: 'QRIS' })).toBeVisible()
    await expect(page.locator('span', { hasText: 'success' }).first()).toBeVisible()
  })

  test('3. UI disables Mulai Sewa button when Customer KYC is not verified', async ({ page }) => {
    await page.goto(`/admin/bookings/${testBookingId}`)
    await page.waitForLoadState('networkidle')

    // Start Rental button should be disabled because customer KYC is pending
    const startBtn = page.locator('button', { hasText: 'Mulai Sewa (Serah Terima Kunci)' })
    await expect(startBtn).toBeVisible()
    await expect(startBtn).toBeDisabled()

    // Warning text explaining why it is disabled
    await expect(page.locator('text=Identitas pelanggan (KTP/SIM) belum diverifikasi')).toBeVisible()
  })

  test('4. EndRental button appears on ongoing booking and completes the rental', async ({ page }) => {
    await page.goto(`/admin/bookings/${testOngoingBookingId}`)
    await page.waitForLoadState('networkidle')

    // Verify button exists
    const endBtn = page.locator('button', { hasText: 'Selesaikan Sewa (Armada Kembali)' })
    await expect(endBtn).toBeVisible()

    await endBtn.click()

    // Confirmation modal appears
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).toBeVisible()
    await page.locator('button', { hasText: 'Ya, Selesaikan Sewa' }).click()

    // Modal closes upon successful action
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).not.toBeVisible({ timeout: 15000 })

    // Reload page to verify updated RSC state
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Status changes to COMPLETED
    await expect(page.locator('text=COMPLETED').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Masa sewa telah selesai dan armada telah dikembalikan.')).toBeVisible()
  })

  test('5. Reject Document modal prompts for reason and saves rejectionReason', async ({ page }) => {
    await page.goto(`/admin/bookings/${testBookingId}`)
    await page.waitForLoadState('networkidle')

    // Click Reject button on KTP
    const rejectBtn = page.locator('button', { hasText: 'Reject' }).first()
    await rejectBtn.click()

    // Modal dialog opens
    await expect(page.locator('text=Tolak Dokumen Identitas')).toBeVisible()
    const textarea = page.locator('textarea[placeholder*="Foto KTP buram"]')
    await expect(textarea).toBeVisible()

    // Submit rejection with reason
    const testReason = 'Foto KTP terlalu gelap dan NIK tidak terbaca jelas'
    await textarea.fill(testReason)
    await page.locator('button[type="submit"]', { hasText: 'Tolak Dokumen' }).click()

    // Modal closes upon successful action
    await expect(page.locator('text=Tolak Dokumen Identitas')).not.toBeVisible({ timeout: 15000 })

    // Reload page to verify updated RSC state
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Rejection badge & note should now be visible on page
    await expect(page.locator('text=Ditolak').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator(`text=${testReason}`)).toBeVisible()

    // Verify rejectionReason in DB directly
    const updatedDoc = await prisma.document.findUnique({ where: { id: testKtpDocId } })
    expect(updatedDoc?.rejectionReason).toBe(testReason)
  })

})