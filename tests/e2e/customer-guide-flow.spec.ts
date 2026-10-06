import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  LATE_RETURN_GRACE_MINUTES,
  TURNOVER_BUFFER_HOURS,
  BRANCH_OPERATING_HOURS,
  MIDTRANS_SNAP_EXPIRY_MINUTES,
  OVERTIME_HOURLY_PERCENTAGE,
  MIN_HOURLY_OVERTIME_RATE,
  MIN_VEHICLE_DAILY_RATE,
} from '../../src/lib/constants'

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

test.describe.configure({ mode: 'serial' })

test.describe('Halaman Panduan Pelanggan (Customer Flow & Rental Guide)', () => {
  test.afterAll(async () => {
    await pool.end()
  })

  test('1. Aksesibilitas halaman /guide dan rendering 7 langkah alur perjalanan', async ({ page }) => {
    await page.goto('/guide')

    // Verifikasi Header & Breadcrumb
    await expect(page.locator('h1')).toContainText('Panduan Lengkap Reservasi Armada Premium')
    await expect(page.getByText('Panduan Pelanggan')).toBeVisible()

    // Verifikasi 7 Langkah Stepper (01 sampai 07)
    await expect(page.getByText('01', { exact: true })).toBeVisible()
    await expect(page.getByText('Cari & Pilih Armada', { exact: true })).toBeVisible()

    await expect(page.getByText('02', { exact: true })).toBeVisible()
    await expect(page.getByText('Tentukan Jadwal & Cek Ketersediaan', { exact: true })).toBeVisible()

    await expect(page.getByText('03', { exact: true })).toBeVisible()
    await expect(page.getByText('Pembayaran Instan via Midtrans', { exact: true })).toBeVisible()

    await expect(page.getByText('04', { exact: true })).toBeVisible()
    await expect(page.getByText('Lengkapi Dokumen Verifikasi (KYC)', { exact: true })).toBeVisible()

    await expect(page.getByText('05', { exact: true })).toBeVisible()
    await expect(page.getByText('Pengambilan Armada di Cabang (Handover)', { exact: true })).toBeVisible()

    await expect(page.getByText('06', { exact: true })).toBeVisible()
    await expect(page.getByText('Selama Perjalanan & Bantuan Operasional', { exact: true })).toBeVisible()

    await expect(page.getByText('07', { exact: true })).toBeVisible()
    await expect(page.getByText('Pengembalian Armada & Selesai', { exact: true })).toBeVisible()
  })

  test('2. Verifikasi Anti Magic-Number-Drift: seluruh angka kebijakan sinkron dengan constants.ts', async ({ page }) => {
    await page.goto('/guide')

    const bodyText = await page.locator('body').innerText()

    // A. Toleransi Keterlambatan (45 menit)
    expect(bodyText).toContain(`${LATE_RETURN_GRACE_MINUTES} menit`)

    // B. Jeda Sanitasi & Detailing (3 jam)
    expect(bodyText).toContain(`${TURNOVER_BUFFER_HOURS} jam steril`)

    // C. Jam Operasional Cabang (08:00 – 21:00 WIB)
    const openHoursPattern = `${String(BRANCH_OPERATING_HOURS.OPEN_HOUR).padStart(2, '0')}:00 – ${String(BRANCH_OPERATING_HOURS.CLOSE_HOUR).padStart(2, '0')}:00 WIB`
    expect(bodyText).toContain(openHoursPattern)

    // D. Batas Waktu Bayar Midtrans (60 menit)
    expect(bodyText).toContain(`${MIDTRANS_SNAP_EXPIRY_MINUTES} menit`)

    // E. Tarif Overtime per Jam (10%)
    const overtimePercentStr = `${OVERTIME_HOURLY_PERCENTAGE * 100}%`
    expect(bodyText).toContain(overtimePercentStr)

    // F. Tarif Harian Minimum (Rp 250.000)
    expect(bodyText).toContain(MIN_VEHICLE_DAILY_RATE.toLocaleString('id-ID'))
  })

  test('3. Penegasan KTP & SIM wajib untuk kedua model sewa (Lepas Kunci & Dengan Sopir)', async ({ page }) => {
    await page.goto('/guide')

    const kycBanner = page.locator('[data-testid="kyc-mandate-banner"]')
    await expect(kycBanner).toBeVisible()
    await expect(kycBanner).toContainText('KTP & SIM Dua-duanya Wajib')
    await expect(kycBanner).toContainText('Baik sewa Lepas Kunci maupun Dengan Sopir')

    // Verifikasi penjelasan mengapa Dengan Sopir tetap wajib SIM
    await expect(page.getByText('Mengapa sewa Dengan Sopir tetap wajib mengunggah SIM & KTP?')).toBeVisible()
    await expect(page.getByText('Polis asuransi komersial kendaraan mewah')).toBeVisible()
  })

  test('4. Interaktivitas Breakdown Denda & Accordion FAQ', async ({ page }) => {
    await page.goto('/guide')

    // A. Toggle Breakdown Denda Keterlambatan
    const toggleBtn = page.locator('[data-testid="toggle-overtime-breakdown-btn"]')
    await expect(toggleBtn).toBeVisible()
    await toggleBtn.click()

    const breakdownBox = page.locator('[data-testid="overtime-breakdown-details"]')
    await expect(breakdownBox).toBeVisible()
    await expect(breakdownBox).toContainText('Tepat Waktu s/d 45 Menit')
    await expect(breakdownBox).toContainText('Terlambat 46 Menit s/d 3 Jam')
    await expect(breakdownBox).toContainText('Terlambat Lebih dari 3 Jam')

    // B. FAQ Interactivity & Filter
    const kycCategoryTab = page.locator('[data-testid="faq-category-kyc"]')
    await kycCategoryTab.click()

    // Buka salah satu item FAQ
    const faqItemBtn = page.locator('[data-testid="faq-item-btn-0"]')
    await expect(faqItemBtn).toBeVisible()
    await faqItemBtn.click()

    const faqAnswer = page.locator('[data-testid="faq-answer-0"]')
    await expect(faqAnswer).toBeVisible()
    await expect(faqAnswer).toContainText('Regulasi asuransi komersial')
  })

  test('5. Navigasi Footer dan Link Kontekstual di Beranda & Booking Form', async ({ page }) => {
    // A. Link di Footer Beranda
    await page.goto('/')
    const footerGuideLink = page.locator('[data-testid="footer-guide-link"]')
    await expect(footerGuideLink).toBeVisible()
    await footerGuideLink.click()
    await expect(page).toHaveURL(/\/guide/)

    // B. Link Kontekstual di Header Armada Beranda
    await page.goto('/')
    const homeContextualLink = page.locator('[data-testid="home-contextual-guide-link"]')
    await expect(homeContextualLink).toBeVisible()
    await homeContextualLink.click()
    await expect(page).toHaveURL(/\/guide/)

    const firstVehicle = await prisma.vehicle.findFirst({
      where: { isActive: true },
      select: { id: true }
    })
    if (firstVehicle) {
      // C. Link Kontekstual di Halaman Detail Armada (Publik)
      await page.goto(`/vehicles/${firstVehicle.id}`)
      const vehicleDetailGuideLink = page.locator('[data-testid="vehicle-detail-guide-link"]')
      await expect(vehicleDetailGuideLink).toBeVisible()
      await expect(vehicleDetailGuideLink).toHaveAttribute('href', '/guide')

      // D. Link Kontekstual di Halaman Booking (Memerlukan Login)
      await page.goto('/login')
      await page.fill('input[type="email"]', 'customer1@test.com')
      await page.fill('input[type="password"]', 'Password123!')
      await page.click('button[type="submit"]')
      await page.waitForURL('/')

      await page.goto(`/vehicles/${firstVehicle.id}/book`)
      const bookingGuideLink = page.locator('[data-testid="booking-contextual-guide-link"]')
      await expect(bookingGuideLink).toBeVisible()
      await expect(bookingGuideLink).toHaveAttribute('href', '/guide')
    }
  })

  test('6. Konsistensi Dwibahasa (English / NEXT_LOCALE=en)', async ({ page }) => {
    await page.goto('/guide')
    const langSwitcher = page.locator('[data-testid="language-switcher"]').first()
    await langSwitcher.locator('[data-testid="lang-option-en"]').click()
    await page.waitForLoadState('networkidle')

    // Verifikasi Header Bahasa Inggris
    await expect(page.locator('h1')).toContainText('Complete Executive Car Rental Guide')
    await expect(page.getByText('Customer Itinerary Guide')).toBeVisible()

    // Verifikasi Quick Badges Bahasa Inggris
    await expect(page.getByText('Return Grace Period')).toBeVisible()
    await expect(page.getByText('45 minutes', { exact: true })).toBeVisible()
    await expect(page.getByText('ID & Driver License Mandatory')).toBeVisible()

    // Verifikasi Stepper Bahasa Inggris
    await expect(page.getByText('Browse & Select Vehicle')).toBeVisible()
    await expect(page.getByText('Complete Identity Verification (KYC)')).toBeVisible()
  })
})
