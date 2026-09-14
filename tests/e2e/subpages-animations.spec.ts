import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

test.describe('Subpages UI/UX Animations & Progressive Fallback ("Prestige Motion")', () => {
  let sampleVehicleId: string | null = null

  test.beforeAll(async () => {
    const vehicle = await prisma.vehicle.findFirst({
      where: { isActive: true }
    })
    if (vehicle) {
      sampleVehicleId = vehicle.id
    }
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

  test('1. Vehicle Detail (/vehicles/[id]): Header LCP visible immediately, shimmer CTA, specs visible, no fake progress bar', async ({ page }) => {
    test.skip(!sampleVehicleId, 'No active vehicle available in database')
    await page.goto(`/vehicles/${sampleVehicleId}`)
    await page.waitForLoadState('domcontentloaded')

    // 1. Header LCP entrance - immediately visible
    const kicker = page.locator('.animate-hero-kicker').first()
    const title = page.locator('h1.animate-hero-title')
    await expect(kicker).toBeVisible()
    await expect(title).toBeVisible()

    // 2. Booking card & CTA button
    const bookBtn = page.locator('a.shimmer-btn')
    await expect(bookBtn).toBeVisible()
    await expect(bookBtn).toContainText('Rent This Car')

    // 3. Verify no pseudo 1/3 progress bar
    await expect(page.locator('text=Langkah 1 dari 3')).toHaveCount(0)
    await expect(page.locator('.bg-secondary.h-full.w-1\\/3')).toHaveCount(0)

    // 4. Specs bento grid visible
    await expect(page.locator('text=Capacity')).toBeVisible()
    await expect(page.locator('text=Transmission')).toBeVisible()
    await expect(page.locator('text=Fuel Type')).toBeVisible()
  })

  test('2. Locations (/locations): Header LCP visible, branch cards revealed with dynamic count and hover classes', async ({ page }) => {
    await page.goto('/locations')
    await page.waitForLoadState('domcontentloaded')

    // 1. Header LCP entrance
    const title = page.locator('h1.animate-page-header')
    const desc = page.locator('p.animate-page-desc')
    await expect(title).toBeVisible()
    await expect(desc).toBeVisible()

    // 2. Branch cards visible
    const branchCards = page.locator('.max-w-6xl .bg-surface-container-lowest')
    const count = await branchCards.count()
    expect(count).toBeGreaterThan(0)

    const firstCard = branchCards.first()
    await expect(firstCard).toBeVisible()
    // Verify hover transition classes
    await expect(firstCard).toHaveClass(/transition-all/)
    await expect(firstCard).toHaveClass(/hover:-translate-y-1\.5/)
  })

  test('3. About (/about): Header LCP visible, 4 pillars revealed, verified legal entity, dynamic vehicle dot', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('domcontentloaded')

    // 1. Header LCP entrance
    const title = page.locator('h1.animate-page-header')
    await expect(title).toBeVisible()
    await expect(title).toContainText('Mendefinisikan Ulang Mobilitas Premium')

    // 2. Verified Legal Profile
    await expect(page.locator('text=CV Prestige Motion Nusantara')).toBeVisible()
    await expect(page.locator('text=Profil & Identitas Badan Usaha')).toBeVisible()

    // 3. 4 Pillars visible
    await expect(page.locator('text=Pemesanan Online 24/7')).toBeVisible()
    await expect(page.locator('text=Jeda Detailing & Inspeksi 3 Jam')).toBeVisible()
    await expect(page.locator('text=Tarif Pasti Tanpa Biaya Tersembunyi')).toBeVisible()
    await expect(page.locator('text=Perlindungan Data (UU PDP No. 27/2022)')).toBeVisible()

    // 4. CTA Shimmer Button
    const ctaBtn = page.locator('a.shimmer-btn:has-text("Pilih Armada Sekarang")')
    await expect(ctaBtn).toBeVisible()
  })

  test('4. Contact (/contact): Header LCP visible, 3 contact cards and emergency trip support revealed', async ({ page }) => {
    await page.goto('/contact')
    await page.waitForLoadState('domcontentloaded')

    // 1. Header LCP entrance
    const title = page.locator('h1.animate-page-header')
    await expect(title).toBeVisible()
    await expect(title).toContainText('Pusat Bantuan & Layanan Pelanggan')

    // 2. 3 Contact Cards visible
    await expect(page.locator('text=WhatsApp Concierge')).toBeVisible()
    await expect(page.locator('text=+62 811-3000-8888')).toBeVisible()
    await expect(page.locator('text=Email Resmi')).toBeVisible()
    await expect(page.locator('text=contact@prestigemotion.co.id')).toBeVisible()
    await expect(page.locator('text=Hotline Operasional')).toBeVisible()
    await expect(page.locator('text=0800-1-PRESTIGE')).toBeVisible()

    // 3. Emergency section visible
    const emergencySection = page.locator('#emergency')
    await expect(emergencySection).toBeVisible()
    await expect(emergencySection).toContainText('Bantuan & Eskalasi Darurat Perjalanan')
  })

  test('5. prefers-reduced-motion: reduce across all subpages guarantees instant display without breakage', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce'
    })
    const page = await context.newPage()

    // 1. Check /locations
    await page.goto('/locations')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('.max-w-6xl .bg-surface-container-lowest').first()).toBeVisible()

    // 2. Check /about
    await page.goto('/about')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=CV Prestige Motion Nusantara')).toBeVisible()

    // 3. Check /contact
    await page.goto('/contact')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=WhatsApp Concierge')).toBeVisible()

    if (sampleVehicleId) {
      // 4. Check /vehicles/[id]
      await page.goto(`/vehicles/${sampleVehicleId}`)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('a.shimmer-btn')).toBeVisible()
    }

    await context.close()
  })

  test('6. Progressive Fallback: all subpages are fully visible when IntersectionObserver is unsupported', async ({ page }) => {
    // Emulate environment without IntersectionObserver
    await page.addInitScript(() => {
      // @ts-ignore
      delete window.IntersectionObserver
    })

    // 1. Locations
    await page.goto('/locations')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('.max-w-6xl .bg-surface-container-lowest').first()).toBeVisible()

    // 2. About
    await page.goto('/about')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Mengapa Memilih Prestige Motion?')).toBeVisible()
    await expect(page.locator('text=Pemesanan Online 24/7')).toBeVisible()

    // 3. Contact
    await page.goto('/contact')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=WhatsApp Concierge')).toBeVisible()
    await expect(page.locator('#emergency')).toBeVisible()

    if (sampleVehicleId) {
      // 4. Vehicle Detail
      await page.goto(`/vehicles/${sampleVehicleId}`)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('text=Vehicle Specifications')).toBeVisible()
    }
  })
})
