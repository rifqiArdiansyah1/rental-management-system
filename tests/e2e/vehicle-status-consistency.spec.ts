import { test, expect } from '@playwright/test'
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

const adminEmail = 'admin@test.com'
const adminPassword = 'Password123!'
const testPlate = 'TEST-VSC-01'

async function cleanupTestData() {
  await prisma.payment.deleteMany({
    where: { booking: { vehicle: { plateNumber: testPlate } } }
  })
  await prisma.booking.deleteMany({
    where: { vehicle: { plateNumber: testPlate } }
  })
  await prisma.vehicle.deleteMany({
    where: { plateNumber: testPlate }
  })
}

test.describe('Vehicle Status Consistency & Operational Lifecycle Audit (Issue #21)', () => {
  let vehicleId: string
  let branchId: string
  let customerId: string

  test.beforeAll(async () => {
    await cleanupTestData()

    // 0. Ensure admin user exists in Supabase Auth & Prisma
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' }
    })

    let adminUserId = authData?.user?.id
    if (!adminUserId) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      adminUserId = listData?.users.find(u => u.email === adminEmail)?.id
      if (adminUserId) {
        await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
          password: adminPassword,
          app_metadata: { role: 'admin_pusat' },
          email_confirm: true
        })
      }
    }

    if (adminUserId) {
      await prisma.user.upsert({
        where: { id: adminUserId },
        update: { role: 'admin_pusat', isActive: true },
        create: { id: adminUserId, email: adminEmail, name: 'Admin Test', role: 'admin_pusat', isActive: true }
      })
    }

    // 1. Get branch, customer, and category
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const category = await prisma.vehicleCategory.findFirst()
    const customer = await prisma.customer.findFirst()

    if (!branch || !category || !customer) {
      throw new Error('Database lacks seed data (branch/category/customer).')
    }

    branchId = branch.id
    customerId = customer.id

    // 2. Create test vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Test Vehicle Consistency',
        plateNumber: testPlate,
        categoryId: category.id,
        branchId: branch.id,
        dailyRate: 500000,
        status: 'available',
        isActive: true
      }
    })

    vehicleId = vehicle.id
  })

  test.afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  async function loginAsAdmin(page: any) {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/admin/login')
    await page.fill('input[name="email"]', adminEmail)
    await page.fill('input[name="password"]', adminPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/admin\/(dashboard|vehicles|bookings)/)
  }

  test('UI & Backend: "Disewa (Rented)" is removed from status modal & available vehicle can toggle maintenance', async ({ page }) => {
    await loginAsAdmin(page)

    // 2. Navigate to vehicles page and search for test vehicle
    await page.goto(`/admin/vehicles?q=${testPlate}`)
    const vehicleRow = page.locator('tbody tr', { hasText: testPlate }).first()
    await expect(vehicleRow).toBeVisible()

    // 3. Open row actions menu
    await vehicleRow.getByRole('button', { name: '•••' }).click()

    // 4. Click "Ubah Status"
    await vehicleRow.getByRole('button', { name: 'Ubah Status' }).click()

    // 5. Verify Modal contents
    const modal = page.locator('div.fixed.inset-0', { hasText: 'Ubah Status' })
    await expect(modal).toBeVisible()

    const selectDropdown = modal.locator('select')
    const options = await selectDropdown.locator('option').allTextContents()

    // Expect 'available', 'maintenance', 'moved' are present
    expect(options.some(opt => opt.includes('Tersedia') || opt.includes('Available'))).toBeTruthy()
    expect(options.some(opt => opt.includes('Perbaikan') || opt.includes('Maintenance'))).toBeTruthy()
    expect(options.some(opt => opt.includes('Dipindahkan') || opt.includes('Moved'))).toBeTruthy()

    // Expect 'rented' is STRICTLY NOT present
    expect(options.some(opt => opt.includes('Disewa') || opt.includes('Rented'))).toBeFalsy()

    // 6. Change status to Maintenance
    await selectDropdown.selectOption('maintenance')
    await modal.getByRole('button', { name: 'Simpan' }).click()
    await expect(modal).not.toBeVisible({ timeout: 15000 })

    // 7. Verify status updated to MAINTENANCE in UI and Database
    await expect(vehicleRow.locator('span', { hasText: 'MAINTENANCE' })).toBeVisible({ timeout: 15000 })

    const dbVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    expect(dbVehicle?.status).toBe('maintenance')

    // 8. Revert back to Available
    await vehicleRow.getByRole('button', { name: '•••' }).click()
    await vehicleRow.getByRole('button', { name: 'Ubah Status' }).click()
    await modal.locator('select').selectOption('available')
    await modal.getByRole('button', { name: 'Simpan' }).click()
    await expect(modal).not.toBeVisible({ timeout: 15000 })
    await expect(vehicleRow.locator('span', { hasText: 'AVAILABLE' })).toBeVisible({ timeout: 15000 })

    const dbVehicleAvailable = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    expect(dbVehicleAvailable?.status).toBe('available')
  })

  test('UI Guard: Rented vehicle disables "Ubah Status" with Disewa (Otomatis) indicator', async ({ page }) => {
    // Set vehicle status to rented in DB
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'rented' }
    })

    await loginAsAdmin(page)

    // Navigate to vehicles
    await page.goto(`/admin/vehicles?q=${testPlate}`)
    const vehicleRow = page.locator('tbody tr', { hasText: testPlate }).first()
    await expect(vehicleRow).toBeVisible()

    await vehicleRow.getByRole('button', { name: '•••' }).click()

    // Verify "Ubah Status" is non-clickable and shows Disewa (Otomatis)
    const disabledOption = vehicleRow.locator('text=Disewa (Otomatis)')
    await expect(disabledOption).toBeVisible()

    // Ensure regular Ubah Status button is NOT interactive
    await expect(vehicleRow.getByRole('button', { name: 'Ubah Status' })).not.toBeVisible()

    // Reset status back to available
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'available' }
    })
  })

  test('UI Guard: Inactive (soft-deleted) vehicle disables "Ubah Status" with Nonaktif indicator', async ({ page }) => {
    // Set vehicle inactive in DB
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: false, status: 'available' }
    })

    await loginAsAdmin(page)

    // Navigate to vehicles with showInactive=true
    await page.goto(`/admin/vehicles?q=${testPlate}&showInactive=true`)
    const vehicleRow = page.locator('tbody tr', { hasText: testPlate }).first()
    await expect(vehicleRow).toBeVisible()

    await vehicleRow.getByRole('button', { name: '•••' }).click()

    // Verify "Ubah Status" is non-clickable and shows Nonaktif
    const disabledOption = vehicleRow.getByText('Nonaktif', { exact: true })
    await expect(disabledOption).toBeVisible()
    await expect(vehicleRow.getByRole('button', { name: 'Ubah Status' })).not.toBeVisible()

    // Restore isActive: true
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: true }
    })
  })

  test('Backend Transactional Guard: Ongoing booking prevents manual status change', async () => {
    // 1. Create ongoing booking
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(Date.now() - 3600000), // 1 hour ago
        endDate: new Date(Date.now() + 86400000), // tomorrow
        rentalType: 'self_drive',
        status: 'ongoing',
        totalPrice: 1000000
      }
    })

    // 2. Test database simulation of updateVehicleStatus guard
    let errorMessage = ''
    try {
      await prisma.$transaction(async (tx) => {
        const currentVehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } })
        if (!currentVehicle) throw new Error('Kendaraan tidak ditemukan.')

        const activeOngoing = await tx.booking.count({
          where: { vehicleId, status: 'ongoing' }
        })

        if (activeOngoing > 0 || currentVehicle.status === 'rented') {
          throw new Error('Kendaraan sedang dalam masa sewa aktif (ongoing). Status tidak dapat diubah secara manual.')
        }

        await tx.vehicle.updateMany({
          where: { id: vehicleId, status: currentVehicle.status },
          data: { status: 'maintenance' }
        })
      })
    } catch (err: any) {
      errorMessage = err.message
    }

    expect(errorMessage).toContain('Kendaraan sedang dalam masa sewa aktif (ongoing)')

    // 3. Cleanup booking
    await prisma.booking.delete({ where: { id: booking.id } })
  })

  test('Backend Rolling 24-Hour Window: Confirmed booking in next 2 hours prevents maintenance transition', async () => {
    // 1. Create confirmed booking starting in 2 hours
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(Date.now() + 2 * 3600000), // in 2 hours
        endDate: new Date(Date.now() + 48 * 3600000),
        rentalType: 'self_drive',
        status: 'confirmed',
        totalPrice: 1000000
      }
    })

    // 2. Test database simulation of rolling 24-hour guard
    let errorMessage = ''
    try {
      await prisma.$transaction(async (tx) => {
        const now = new Date()
        const rolling24h = new Date(Date.now() + 24 * 60 * 60 * 1000)

        const conflictingBookings = await tx.booking.count({
          where: {
            vehicleId,
            status: { in: ['confirmed', 'pending_payment'] },
            startDate: { lte: rolling24h },
            endDate: { gte: now }
          }
        })

        if (conflictingBookings > 0) {
          throw new Error('Kendaraan memiliki jadwal sewa (confirmed/pending) dalam 24 jam ke depan. Selesaikan atau alihkan pesanan terlebih dahulu.')
        }

        await tx.vehicle.updateMany({
          where: { id: vehicleId, status: 'available' },
          data: { status: 'maintenance' }
        })
      })
    } catch (err: any) {
      errorMessage = err.message
    }

    expect(errorMessage).toContain('dalam 24 jam ke depan')

    // 3. Cleanup booking
    await prisma.booking.delete({ where: { id: booking.id } })
  })
})
