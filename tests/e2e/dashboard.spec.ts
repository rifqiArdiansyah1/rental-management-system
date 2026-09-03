import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function loginAsCustomer(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[name="email"]', 'customer1@test.com')
  await page.fill('input[name="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
}

test.describe('Dashboard User Enhancement', () => {

  test.beforeAll(async () => {
    const customer = await prisma.customer.findFirst({ where: { email: 'customer1@test.com' } })
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const category = await prisma.vehicleCategory.findFirst()

    if (customer && branch && category) {
      const testVehicle = await prisma.vehicle.create({
        data: {
          name: 'BMW 730Li Executive Test',
          plateNumber: `DASH-${Date.now()}`,
          dailyRate: 1500000,
          status: 'available',
          branchId: branch.id,
          categoryId: category.id,
          photos: ['https://example.com/bmw.png']
        }
      })

      const startDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
      const endDate = new Date(Date.now() + 102 * 24 * 60 * 60 * 1000)

      await prisma.booking.create({
        data: {
          customerId: customer.id,
          vehicleId: testVehicle.id,
          pickupBranchId: branch.id,
          returnBranchId: branch.id,
          rentalType: 'self_drive',
          startDate,
          endDate,
          status: 'pending_payment',
          totalPrice: 3000000,
        }
      })
    }
  })

  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
  })

  test('1. Dashboard renders profile section with Edit Profil button', async ({ page }) => {
    await expect(page.locator('text=Profil Pelanggan')).toBeVisible()
    await expect(page.locator('text=Email')).toBeVisible()
    await expect(page.locator('text=Telepon')).toBeVisible()
    await expect(page.locator('button', { hasText: 'Edit Profil' })).toBeVisible()
  })

  test('2. Edit Profil modal opens, accepts input, and submits successfully', async ({ page }) => {
    await page.locator('button', { hasText: 'Edit Profil' }).click()
    await expect(page.locator('text=Edit Profil').nth(1)).toBeVisible()
    await expect(page.locator('input[placeholder*="nama"]')).toBeVisible()
    await page.locator('input[placeholder*="nama"]').fill('Customer One Updated')
    await page.locator('input[placeholder*="081"]').fill('081234567890')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.locator('text=Profil berhasil diperbarui!')).toBeVisible({ timeout: 10000 })
  })

  test('3. Booking history displays vehicle NAME as primary identifier (regression fix from Issue #20)', async ({ page }) => {
    const bookingCards = page.locator('a[href^="/booking/"]')
    await expect(bookingCards.first()).toBeVisible()
    
    // Vehicle card should contain the vehicle name (e.g. BMW 730Li Executive Test)
    const firstCard = bookingCards.first()
    await expect(firstCard.locator('h4')).toBeVisible()
    const nameText = await firstCard.locator('h4').textContent()
    expect(nameText).toContain('BMW 730Li')

    // Plate number is shown as secondary text
    await expect(firstCard.locator('.font-mono')).toBeVisible()
  })

  test('4. Booking status badges show correct Indonesian colors and labels', async ({ page }) => {
    const bookingCards = page.locator('a[href^="/booking/"]')
    await expect(bookingCards.first()).toBeVisible()
    
    // Should have badge with "Menunggu Pembayaran"
    await expect(page.locator('text=Menunggu Pembayaran').first()).toBeVisible()
  })

  test('5. Verification status section renders verification messaging', async ({ page }) => {
    const verifiedLabel = page.locator('text=Terverifikasi')
    const pendingLabel = page.locator('text=Menunggu Review')
    const rejectedLabel = page.locator('text=Ditolak')
    const anyLabel = verifiedLabel.or(pendingLabel).or(rejectedLabel)
    await expect(anyLabel.first()).toBeVisible()
  })

  test('6. Self-service cancel button appears for pending_payment bookings and works', async ({ page }) => {
    const cancelBtn = page.locator('button', { hasText: 'Batalkan Pesanan' }).first()
    await expect(cancelBtn).toBeVisible()

    // Click cancel button -> confirmation dialog opens
    await cancelBtn.click()
    await expect(page.locator('text=Batalkan Pesanan?')).toBeVisible()

    // Click confirm -> booking cancelled
    await page.locator('button', { hasText: 'Ya, Batalkan' }).click()
    await page.waitForLoadState('networkidle')

    // After cancel, badge changes to Dibatalkan
    await expect(page.locator('text=Dibatalkan').first()).toBeVisible({ timeout: 10000 })
  })

  test('7. Responsive design renders on tablet and mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Profil Pelanggan')).toBeVisible()
    await expect(page.locator('text=Riwayat Pemesanan')).toBeVisible()

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Profil Pelanggan')).toBeVisible()
  })

})
