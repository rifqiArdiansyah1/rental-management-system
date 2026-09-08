import { test, expect, Page } from '@playwright/test'
import { PrismaClient, FuelType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { calculateFuelEstimation, calculateTripOdometer } from '@/lib/fuelEstimation'
import { DEFAULT_FUEL_PRICES, FUEL_TYPE_LABELS, ROUTE_DISTANCE_PRESETS } from '@/lib/constants'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const adminEmail = 'admin@test.com'
const customerEmail = 'customer1@test.com'
const defaultPassword = 'Password123!'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function loginAsAdmin(page: Page) {
  await page.context().clearCookies()
  await page.goto('/admin/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', adminEmail)
  await page.fill('input[type="password"]', defaultPassword)
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin/dashboard', { timeout: 15000 })
}

test.describe('Travel Cost Estimation & Odometer Tracking (Opsi A)', () => {

  test.beforeAll(async () => {
    // Ensure admin user exists in Supabase Auth & Prisma with admin_pusat role
    let adminUserId: string | undefined
    const { data: adminAuth, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: defaultPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' }
    })
    if (adminAuth?.user?.id) {
      adminUserId = adminAuth.user.id
    } else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      adminUserId = list?.users?.find(u => u.email === adminEmail)?.id
      if (adminUserId) {
        await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
          password: defaultPassword,
          app_metadata: { role: 'admin_pusat' },
          email_confirm: true
        })
      }
    }
    if (adminUserId) {
      await prisma.user.upsert({
        where: { id: adminUserId },
        update: { role: 'admin_pusat', isActive: true },
        create: { id: adminUserId, email: adminEmail, name: 'Test Admin', role: 'admin_pusat', isActive: true }
      })
    }

    // Ensure customer has verified KYC
    const customer = await prisma.customer.findFirst({ where: { email: customerEmail } })
    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { verificationStatus: 'verified' }
      })
    }
  })

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      console.log(`[PAGE LOG ${msg.type()}]: ${msg.text()}`)
    })
  })

  // =========================================================================
  // 1. Pure Calculation Unit Tests
  // =========================================================================
  test.describe('Fuel Estimation Pure Logic', () => {
    test('calculateFuelEstimation calculates correct liters and rounded cost', () => {
      // 100 km, 10 km/L, Rp 10.000/L => 10 L, Rp 100.000
      const res = calculateFuelEstimation({
        distanceKm: 100,
        efficiencyKmL: 10,
        pricePerLiter: 10000,
      })
      expect(res).not.toBeNull()
      expect(res?.distanceKm).toBe(100)
      expect(res?.efficiencyKmL).toBe(10)
      expect(res?.litersNeeded).toBe(10)
      expect(res?.estimatedCost).toBe(100000)
      expect(res?.formattedCost).toContain('100.000')
    })

    test('calculateFuelEstimation handles presets correctly', () => {
      for (const preset of ROUTE_DISTANCE_PRESETS) {
        const res = calculateFuelEstimation({
          distanceKm: preset.distanceKm,
          efficiencyKmL: 12,
          pricePerLiter: 13000,
        })
        expect(res).not.toBeNull()
        expect(res?.distanceKm).toBe(preset.distanceKm)
        expect(res?.litersNeeded).toBeGreaterThan(0)
        expect(res?.estimatedCost).toBeGreaterThan(0)
      }
    })

    test('calculateFuelEstimation returns null on zero, negative, or missing inputs', () => {
      expect(calculateFuelEstimation({ distanceKm: 0, efficiencyKmL: 10, pricePerLiter: 10000 })).toBeNull()
      expect(calculateFuelEstimation({ distanceKm: -50, efficiencyKmL: 10, pricePerLiter: 10000 })).toBeNull()
      expect(calculateFuelEstimation({ distanceKm: 100, efficiencyKmL: 0, pricePerLiter: 10000 })).toBeNull()
      expect(calculateFuelEstimation({ distanceKm: 100, efficiencyKmL: null, pricePerLiter: 10000 })).toBeNull()
      expect(calculateFuelEstimation({ distanceKm: 100, efficiencyKmL: 10, pricePerLiter: 0 })).toBeNull()
    })

    test('calculateTripOdometer calculates valid trip correctly', () => {
      const res = calculateTripOdometer({
        odometerStart: 50000,
        odometerEnd: 50250,
        efficiencyKmL: 10,
        pricePerLiter: 10000,
      })
      expect(res.isValid).toBe(true)
      expect(res.isAnomaly).toBe(false)
      expect(res.distanceKm).toBe(250)
      expect(res.litersNeeded).toBe(25)
      expect(res.estimatedCost).toBe(250000)
      expect(res.hasEfficiency).toBe(true)
    })

    test('calculateTripOdometer handles typo / anomaly non-blockingly', () => {
      // odometerEnd < odometerStart
      const res = calculateTripOdometer({
        odometerStart: 50000,
        odometerEnd: 5000,
        efficiencyKmL: 10,
        pricePerLiter: 10000,
      })
      expect(res.isValid).toBe(false)
      expect(res.isAnomaly).toBe(true)
      expect(res.distanceKm).toBeNull()
      expect(res.litersNeeded).toBeNull()
      expect(res.estimatedCost).toBeNull()
      expect(res.reason).toContain('lebih kecil')
    })

    test('calculateTripOdometer gracefully handles missing odometer entries', () => {
      const res1 = calculateTripOdometer({ odometerStart: null, odometerEnd: 50000 })
      expect(res1.isValid).toBe(false)
      expect(res1.isAnomaly).toBe(false)

      const res2 = calculateTripOdometer({ odometerStart: 50000, odometerEnd: null })
      expect(res2.isValid).toBe(false)
      expect(res2.isAnomaly).toBe(false)
    })

    test('calculateTripOdometer preserves distance when efficiency is null', () => {
      const res = calculateTripOdometer({
        odometerStart: 10000,
        odometerEnd: 10150,
        efficiencyKmL: null,
      })
      expect(res.isValid).toBe(true)
      expect(res.isAnomaly).toBe(false)
      expect(res.distanceKm).toBe(150)
      expect(res.litersNeeded).toBeNull()
      expect(res.estimatedCost).toBeNull()
      expect(res.hasEfficiency).toBe(false)
    })
  })

  // =========================================================================
  // 2. Fuel Price Management UI (Admin Pusat)
  // =========================================================================
  test('Admin Pusat can view and update fuel prices at /admin/fuel-prices', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/admin/fuel-prices')
    await page.waitForLoadState('networkidle')

    // Verifikasi Header & Disclaimer Opsi A
    await expect(page.locator('h1')).toContainText('Tarif Bahan Bakar Minyak')
    await expect(page.locator('text=Kebijakan Operasional: Estimasi Biaya Perjalanan (Opsi A)')).toBeVisible()

    // Verifikasi 5 jenis BBM tampil di tabel
    const fuelNames = ['Pertalite', 'Pertamax', 'Pertamax Turbo', 'Solar', 'Dexlite']
    for (const name of fuelNames) {
      await expect(page.locator(`td:has-text("${name}")`).first()).toBeVisible()
    }

    // Edit tarif Pertalite
    const pertaliteRow = page.locator('tr', { hasText: 'Pertalite' })
    await pertaliteRow.getByRole('button', { name: 'Edit Tarif' }).click()

    // Modal terbuka
    await expect(page.locator('h3:has-text("Perbarui Tarif BBM")')).toBeVisible()
    await expect(page.locator('text=Catatan Kebijakan (Opsi A)')).toBeVisible()

    // Isi harga baru
    const priceInput = page.locator('input[type="number"]')
    await priceInput.fill('10500')
    await page.getByRole('button', { name: 'Simpan Tarif' }).click()

    // Modal tertutup dan harga terbarui
    await expect(page.locator('h3:has-text("Perbarui Tarif BBM")')).not.toBeVisible({ timeout: 15000 }).catch(async (err) => {
      const modalErr = await page.locator('.bg-red-50').textContent().catch(() => null)
      console.log('--- TEST 8 FAILURE: Edit Modal still visible. Error text:', modalErr)
      throw err
    })
    await expect(pertaliteRow.locator('text=Rp 10.500')).toBeVisible({ timeout: 10000 })
  })

  // =========================================================================
  // 3. Public Vehicle Detail: Specs & Pre-Trip Estimator
  // =========================================================================
  test('Public vehicle detail page displays dynamic fuel specs and interactive estimator', async ({ page }) => {
    await page.goto('/vehicles/vehicle-self-drive')
    await page.waitForLoadState('networkidle')

    // Verifikasi Fuel Type di Specifications Bento Grid
    await expect(page.locator('text=Fuel Type')).toBeVisible()
    await expect(page.locator('text=Pertamax (RON 92)').first()).toBeVisible()
    await expect(page.locator('text=~13 km/Liter').first()).toBeVisible()

    // Verifikasi FuelCostEstimator component
    await expect(page.locator('h3:has-text("Estimasi Biaya BBM Perjalanan")')).toBeVisible()
    await expect(page.locator('text=Kebijakan Biaya Operasional (Opsi A)')).toBeVisible()

    // Verifikasi preset buttons
    await expect(page.getByRole('button', { name: /Dalam Kota/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Luar Kota Dekat/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Perjalanan Jauh/ })).toBeVisible()

    // Klik preset "Luar Kota Dekat (150 km)"
    await page.getByRole('button', { name: /Luar Kota Dekat/ }).click()
    await expect(page.locator('span.font-mono:has-text("150 km")').first()).toBeVisible()

    // Klik preset "Perjalanan Jauh (300 km)"
    await page.getByRole('button', { name: /Perjalanan Jauh/ }).click()
    await expect(page.locator('span.font-mono:has-text("300 km")').first()).toBeVisible()
  })

  // =========================================================================
  // 4. Booking Odometer & Return Flow
  // =========================================================================
  test('Start and End Rental captures odometer with non-blocking typo guard and fuel estimation', async ({ page }) => {
    const customer = await prisma.customer.findFirst({ where: { email: customerEmail } })
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const category = await prisma.vehicleCategory.findFirst()

    if (!customer || !branch || !category) {
      throw new Error('Seed data missing for test booking')
    }

    // Buat kendaraan khusus untuk test ini agar status 'available' terjamin
    const testPlate = `ODO-${Date.now()}`
    const testVehicle = await prisma.vehicle.create({
      data: {
        name: 'CR-V Odometer Unit Test',
        plateNumber: testPlate,
        branchId: branch.id,
        categoryId: category.id,
        dailyRate: 500000,
        fuelType: 'pertamax',
        fuelEfficiencyKmL: 13.0,
        status: 'available',
        photos: ['https://example.com/suv.png'],
      }
    })

    // Pastikan status KYC customer verified agar tombol Mulai Sewa aktif
    await prisma.customer.update({
      where: { id: customer.id },
      data: { verificationStatus: 'verified' }
    })

    const testBooking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        vehicleId: testVehicle.id,
        pickupBranchId: branch.id,
        returnBranchId: branch.id,
        rentalType: 'self_drive',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Kemarin
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),   // Besok
        totalPrice: 500000,
        agreedDailyRate: 500000,
        status: 'confirmed',
      }
    })

    try {
      await loginAsAdmin(page)

      // Buka detail booking
      await page.goto(`/admin/bookings/${testBooking.id}`)
      await page.waitForLoadState('networkidle')

      // 1. Mulai Sewa dengan Odometer Awal
      await page.getByRole('button', { name: /Mulai Sewa/ }).click()
      await expect(page.locator('h3:has-text("Konfirmasi Mulai Sewa")')).toBeVisible()

      // Input odometer awal
      const odoStartInput = page.locator('input[placeholder="Misal: 45200"]')
      await odoStartInput.fill('45000')
      await page.getByRole('button', { name: 'Ya, Mulai Sewa' }).click()

      await expect(page.locator('h3:has-text("Konfirmasi Mulai Sewa")')).not.toBeVisible({ timeout: 15000 }).catch(async (err) => {
        const modalErr = await page.locator('.bg-red-50').textContent().catch(() => null)
        console.log('--- TEST 10 FAILURE: Start Rental Modal still visible. Error text:', modalErr)
        throw err
      })

      // Reload halaman agar data fresh dari server diambil
      await page.reload()
      await page.waitForLoadState('networkidle')
      await expect(page.locator('text=ONGOING').first()).toBeVisible({ timeout: 10000 })

      // Verifikasi Odometer Awal tampil di kartu Odometer
      await expect(page.locator('text=45.000 km').first()).toBeVisible()

      // 2. Selesaikan Sewa (End Rental)
      await page.getByRole('button', { name: /Selesaikan Sewa/ }).click()
      await expect(page.locator('h3:has-text("Konfirmasi Selesai Sewa")')).toBeVisible()

      // Verifikasi modal menampilkan Odometer Awal 45.000 km
      await expect(page.locator('div:has-text("45.000 km")').first()).toBeVisible()

      // Test Typo Guard: odometer akhir < odometer awal (e.g. 4500 km)
      const odoEndInput = page.locator('input[placeholder="Misal: 45450"]')
      await odoEndInput.fill('4500')

      // Muncul warning typo inline
      await expect(page.locator('text=lebih kecil dari odometer awal')).toBeVisible()

      // Tombol submit TETAP aktif (non-blocking)
      const submitEndBtn = page.getByRole('button', { name: 'Ya, Selesaikan Sewa' })
      await expect(submitEndBtn).toBeEnabled()

      // Koreksi nilai odometer ke yang benar (45.260 km => jarak 260 km)
      await odoEndInput.fill('45260')
      await expect(page.locator('text=lebih kecil dari odometer awal')).not.toBeVisible()
      await expect(page.locator('text=260 km')).toBeVisible()
      await expect(page.locator('text=Estimasi Konsumsi BBM:')).toBeVisible()

      // Konfirmasi Selesai Sewa
      await submitEndBtn.click()

      // Tunggu modal Konfirmasi Selesai Sewa tertutup
      await expect(page.locator('h3:has-text("Konfirmasi Selesai Sewa")')).not.toBeVisible({ timeout: 15000 }).catch(async (err) => {
        const modalErr = await page.locator('.bg-red-50').textContent().catch(() => null)
        console.log('--- TEST 10 FAILURE: End Rental Modal still visible. Error:', modalErr)
        throw err
      })

      // Reload halaman agar data fresh dari server diambil
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Status berubah jadi COMPLETED
      await expect(page.locator('text=COMPLETED').first()).toBeVisible({ timeout: 10000 })

      // Verifikasi kartu Odometer menampilkan Jarak Tempuh Trip 260 km
      await expect(page.locator('text=260 km').first()).toBeVisible()
      await expect(page.locator('text=Opsi A (BBM Mandiri)')).toBeVisible()

    } finally {
      // Cleanup booking and vehicle
      await prisma.booking.deleteMany({ where: { id: testBooking.id } })
      await prisma.vehicle.deleteMany({ where: { id: testVehicle.id } })
    }
  })

  // =========================================================================
  // 5. Terms of Service Fuel Policy
  // =========================================================================
  test('Terms page displays explicit fuel and toll policy under Section 3', async ({ page }) => {
    await page.goto('/terms')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h2:has-text("3. Ketentuan Lepas Kunci vs Dengan Sopir")')).toBeVisible()
    await expect(page.locator('text=Ketentuan Bahan Bakar (BBM) & Tol (Kebijakan Opsi A)')).toBeVisible()
    await expect(page.locator('text=belum termasuk biaya bahan bakar (BBM), tarif jalan tol')).toBeVisible()
  })

})
