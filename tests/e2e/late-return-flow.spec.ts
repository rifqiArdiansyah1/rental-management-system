import { test, expect, Page } from '@playwright/test'
import { PrismaClient, BookingStatus, PaymentStatus } from '@prisma/client'
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

const adminEmail = 'admin@test.com'
const staffEmail = 'staff-late-test@test.com'
const defaultPassword = 'Password123!'
const testPlatePrefix = 'TEST-LATE-'

async function loginAsAdmin(page: Page) {
  await page.context().clearCookies()
  await page.goto('/admin/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', adminEmail)
  await page.fill('input[type="password"]', defaultPassword)
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin/dashboard', { timeout: 15000 })
}

async function loginAsStaff(page: Page) {
  await page.context().clearCookies()
  await page.goto('/admin/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', staffEmail)
  await page.fill('input[type="password"]', defaultPassword)
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin/dashboard', { timeout: 15000 })
}

async function cleanupTestData() {
  await prisma.payment.deleteMany({
    where: { booking: { vehicle: { plateNumber: { startsWith: testPlatePrefix } } } }
  })
  await prisma.booking.deleteMany({
    where: { vehicle: { plateNumber: { startsWith: testPlatePrefix } } }
  })
  await prisma.vehicle.deleteMany({
    where: { plateNumber: { startsWith: testPlatePrefix } }
  })
}

test.describe('Late Return Fee & Schedule Conflict Risk Flow', () => {
  let branchId: string
  let categoryId: string
  let customerId: string
  let adminUserId: string
  let staffUserId: string

  test.beforeAll(async () => {
    await cleanupTestData()

    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const category = await prisma.vehicleCategory.findFirst()
    const customer = await prisma.customer.findFirst()

    if (!branch || !category || !customer) {
      throw new Error('Database fixture incomplete. Ensure branch, category, customer exist.')
    }

    branchId = branch.id
    categoryId = category.id
    customerId = customer.id

    // Setup Admin Pusat User
    const { data: adminAuth } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: defaultPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' }
    })
    adminUserId = adminAuth?.user?.id || ''
    if (!adminUserId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      adminUserId = list?.users.find(u => u.email === adminEmail)?.id || ''
    }
    if (adminUserId) {
      await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
        password: defaultPassword,
        app_metadata: { role: 'admin_pusat' },
        email_confirm: true
      })
      await prisma.user.upsert({
        where: { id: adminUserId },
        update: { role: 'admin_pusat', isActive: true },
        create: { id: adminUserId, email: adminEmail, name: 'Admin Pusat Test', role: 'admin_pusat', isActive: true }
      })
    }

    // Setup Staff Cabang User
    const { data: staffAuth } = await supabaseAdmin.auth.admin.createUser({
      email: staffEmail,
      password: defaultPassword,
      email_confirm: true,
      app_metadata: { role: 'staff_cabang', branchId }
    })
    staffUserId = staffAuth?.user?.id || ''
    if (!staffUserId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      staffUserId = list?.users.find(u => u.email === staffEmail)?.id || ''
    }
    if (staffUserId) {
      await supabaseAdmin.auth.admin.updateUserById(staffUserId, {
        password: defaultPassword,
        app_metadata: { role: 'staff_cabang', branchId },
        email_confirm: true
      })
      await prisma.user.upsert({
        where: { id: staffUserId },
        update: { role: 'staff_cabang', branchId, isActive: true },
        create: { id: staffUserId, email: staffEmail, name: 'Staff Cabang Test', role: 'staff_cabang', branchId, isActive: true }
      })
    }
  })

  test.afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  test('Skenario 1: Pengembalian tepat waktu / dalam toleransi 45 mnt -> Bebas denda (Rp 0)', async ({ page }) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Toyota Avanza Late Test 1',
        plateNumber: `${testPlatePrefix}01`,
        dailyRate: 500_000,
        status: 'rented',
        branchId,
        categoryId,
      }
    })

    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const endDate = new Date(Date.now() - 25 * 60 * 1000) // Selesai 25 menit lalu (dalam toleransi 45 menit)

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle.id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        totalPrice: 500_000,
        agreedDailyRate: 500_000,
        status: BookingStatus.ongoing,
      }
    })

    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)
    await page.waitForLoadState('networkidle')

    // Click Selesaikan Sewa
    const endBtn = page.locator('button', { hasText: 'Selesaikan Sewa' }).first()
    await endBtn.click()

    // Modal dialog opens
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).toBeVisible()
    await expect(page.locator('text=Pengembalian Tepat Waktu / Dalam Toleransi')).toBeVisible()

    // Submit
    await page.locator('button', { hasText: 'Ya, Selesaikan Sewa' }).click()

    // Modal closes
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).not.toBeVisible({ timeout: 15000 })

    // Verify DB
    const updated = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payments: true }
    })
    expect(updated?.status).toBe('completed')
    expect(Number(updated?.lateFeeAmount)).toBe(0)

    const updatedVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle.id } })
    expect(updatedVehicle?.status).toBe('available')
  })

  test('Skenario 2: Denda overtime proporsional (2 jam telat) dibayar tunai di kasir', async ({ page }) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Toyota Innova Late Test 2',
        plateNumber: `${testPlatePrefix}02`,
        dailyRate: 600_000, // 10% = 60.000/jam
        status: 'rented',
        branchId,
        categoryId,
      }
    })

    const startDate = new Date(Date.now() - 26 * 60 * 60 * 1000)
    const endDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 jam lalu

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle.id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        totalPrice: 600_000,
        agreedDailyRate: 600_000,
        status: BookingStatus.ongoing,
      }
    })

    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Selesaikan Sewa' }).first().click()

    await expect(page.locator('text=Konfirmasi Selesai Sewa')).toBeVisible()
    await expect(page.locator('text=Terlambat Kembali (Overtime Proporsional)')).toBeVisible()
    await expect(page.locator('text=Rp 120.000')).toBeVisible() // 2 x 60k

    // Ensure Tunai di Kasir is chosen
    await page.locator('button', { hasText: 'Ya, Selesaikan Sewa' }).click()
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).not.toBeVisible({ timeout: 15000 })

    // Verify DB
    const updated = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payments: true }
    })
    expect(updated?.status).toBe('completed')
    expect(Number(updated?.lateFeeAmount)).toBe(120_000)
    expect(updated?.lateFeeWaived).toBe(false)

    // Verify Payment created
    const cashPayment = updated?.payments.find(p => p.method === 'cash_late_fee')
    expect(cashPayment).toBeDefined()
    expect(cashPayment?.status).toBe(PaymentStatus.success)
    expect(Number(cashPayment?.amount)).toBe(120_000)

    // Reload page to verify updated price breakdown row
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Denda Keterlambatan')).toBeVisible()
    await expect(page.locator('text=+ Rp 120.000')).toBeVisible()
    await expect(page.locator('span', { hasText: 'Lunas' }).first()).toBeVisible()
  })

  test('Skenario 3: Keterlambatan ekstrem (> 3 jam) berskala kelipatan hari sewa penuh', async ({ page }) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'BMW 730Li Late Test 3',
        plateNumber: `${testPlatePrefix}03`,
        dailyRate: 4_500_000,
        status: 'rented',
        branchId,
        categoryId,
      }
    })

    const startDate = new Date(Date.now() - 28 * 60 * 60 * 1000)
    const endDate = new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 jam lalu (> 3 jam)

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle.id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        totalPrice: 4_500_000,
        agreedDailyRate: 4_500_000,
        status: BookingStatus.ongoing,
      }
    })

    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Selesaikan Sewa' }).first().click()

    await expect(page.locator('text=Keterlambatan Ekstrem (> 3 Jam)')).toBeVisible()
    await expect(page.locator('text=Rp 4.500.000').first()).toBeVisible()

    await page.locator('button', { hasText: 'Ya, Selesaikan Sewa' }).click()
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).not.toBeVisible({ timeout: 15000 })

    const updated = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(updated?.status).toBe('completed')
    expect(Number(updated?.lateFeeAmount)).toBe(4_500_000)
  })

  test('Skenario 4: Guard Wewenang Pembebasan Denda (Allowlist Security)', async ({ page }) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Fortuner Late Test 4',
        plateNumber: `${testPlatePrefix}04`,
        dailyRate: 800_000,
        status: 'rented',
        branchId,
        categoryId,
      }
    })

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle.id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(Date.now() - 26 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
        rentalType: 'self_drive',
        totalPrice: 800_000,
        agreedDailyRate: 800_000,
        status: BookingStatus.ongoing,
      }
    })

    // A. Login sebagai Staff Cabang -> Checkbox waive harus DISABLED
    await loginAsStaff(page)
    await page.goto(`/admin/bookings/${booking.id}`)
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Selesaikan Sewa' }).first().click()
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).toBeVisible()

    const waiveCheckbox = page.locator('input[type="checkbox"]').first()
    await expect(waiveCheckbox).toBeDisabled()
    await expect(page.locator('text=Khusus Admin Cabang / Pusat')).toBeVisible()

    // Tutup modal
    await page.locator('button', { hasText: 'Batal' }).click()

    // B. Login kembali sebagai Admin Pusat -> Checkbox waive AKTIF
    await page.goto('/admin/login')
    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Selesaikan Sewa' }).first().click()
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).toBeVisible()

    const adminWaiveCheckbox = page.locator('input[type="checkbox"]').first()
    await expect(adminWaiveCheckbox).toBeEnabled()
    await adminWaiveCheckbox.check()

    // Isi alasan
    const noteArea = page.locator('textarea[placeholder*="Dispensasi operasional"]')
    await expect(noteArea).toBeVisible()
    await noteArea.fill('Dispensasi khusus kendala bengkel disetujui BM')

    await page.locator('button', { hasText: 'Ya, Selesaikan Sewa' }).click()
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).not.toBeVisible({ timeout: 15000 })

    // Verify DB
    const updated = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(updated?.status).toBe('completed')
    expect(updated?.lateFeeWaived).toBe(true)
    expect(Number(updated?.lateFeeAmount)).toBe(0)
    expect(updated?.lateFeeNote).toContain('Dispensasi khusus')
  })

  test('Skenario 5: Deteksi Proaktif Bentrok Jadwal (Conflict Risk)', async ({ page }) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Porsche 911 Conflict Test',
        plateNumber: `${testPlatePrefix}05`,
        dailyRate: 8_500_000,
        status: 'rented',
        branchId,
        categoryId,
      }
    })

    const now = new Date()
    // Booking 1: Ongoing, rencana selesai 1 jam lagi (now >= endDate - 3 jam)
    const booking1 = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle.id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(now.getTime() - 23 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 1 * 60 * 60 * 1000),
        rentalType: 'self_drive',
        totalPrice: 8_500_000,
        agreedDailyRate: 8_500_000,
        status: BookingStatus.ongoing,
      }
    })

    // Booking 2: Terjadwal persis di turnover buffer boundary (endDate + 3 hours)
    // yang valid secara PostgreSQL exclusion constraint namun memicu deteksi risiko bentrok
    const booking2 = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle.id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(booking1.endDate.getTime() + 3 * 60 * 60 * 1000),
        endDate: new Date(booking1.endDate.getTime() + 27 * 60 * 60 * 1000),
        rentalType: 'self_drive',
        totalPrice: 8_500_000,
        agreedDailyRate: 8_500_000,
        status: BookingStatus.confirmed,
      }
    })

    await loginAsAdmin(page)

    // Buka detail Booking 1 -> Harus muncul banner Berisiko Bentrok Jadwal
    await page.goto(`/admin/bookings/${booking1.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Berisiko Bentrok Jadwal Armada')).toBeVisible()

    // Buka detail Booking 2 -> Harus muncul banner Unit Terancam Terlambat
    await page.goto(`/admin/bookings/${booking2.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Unit Terancam Terlambat')).toBeVisible()

    // Buka daftar pesanan tab Action Required -> Muncul badge bentrok jadwal
    await page.goto('/admin/bookings?tab=action_required')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table').getByText('Berisiko Bentrok Jadwal').first()).toBeVisible()
  })

  test('Skenario 6: Pelacakan Denda Belum Lunas (Metode Online Midtrans)', async ({ page }) => {
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Innova Late Online Test',
        plateNumber: `${testPlatePrefix}06`,
        dailyRate: 500_000,
        status: 'rented',
        branchId,
        categoryId,
      }
    })

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle.id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(Date.now() - 26 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
        rentalType: 'self_drive',
        totalPrice: 500_000,
        agreedDailyRate: 500_000,
        status: BookingStatus.ongoing,
      }
    })

    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Selesaikan Sewa' }).first().click()
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).toBeVisible()

    // Pilih radio Tagih Online (Midtrans Snap)
    await page.locator('input[value="midtrans_late_fee"]').click()
    await page.locator('button', { hasText: 'Ya, Selesaikan Sewa' }).click()
    await expect(page.locator('text=Konfirmasi Selesai Sewa')).not.toBeVisible({ timeout: 15000 })

    // Verify DB: payment created with pending status
    const updated = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payments: true }
    })
    expect(updated?.status).toBe('completed')
    const pendingPayment = updated?.payments.find(p => p.method === 'midtrans_late_fee')
    expect(pendingPayment).toBeDefined()
    expect(pendingPayment?.status).toBe(PaymentStatus.pending)

    // Buka antrian Action Required -> Muncul badge Denda Belum Lunas
    await page.goto('/admin/bookings?tab=action_required')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table').getByText('Denda Belum Lunas').first()).toBeVisible()
  })
})
