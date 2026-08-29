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

test.describe('Driver Reassignment Operational Workflow (Issue #22)', () => {
  let branchId: string
  let customerId: string
  let vehicleId: string
  let vehicle2Id: string
  let driverAId: string
  let driverBId: string
  let driverCId: string
  let adminUserId: string

  const prefix = 'TEST-DRV-'
  const plate = `${prefix}01`
  const plate2 = `${prefix}02`

  async function cleanup() {
    await prisma.payment.deleteMany({
      where: { booking: { vehicle: { plateNumber: { in: [plate, plate2] } } } }
    })
    await prisma.booking.deleteMany({
      where: { vehicle: { plateNumber: { in: [plate, plate2] } } }
    })
    await prisma.driverLeave.deleteMany({
      where: { driver: { licenseNumber: { startsWith: prefix } } }
    })
    await prisma.driver.deleteMany({
      where: { licenseNumber: { startsWith: prefix } }
    })
    await prisma.vehicle.deleteMany({
      where: { plateNumber: { in: [plate, plate2] } }
    })
  }

  async function loginAsAdmin(page: any) {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/admin/login')
    await page.fill('input[name="email"]', adminEmail)
    await page.fill('input[name="password"]', adminPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/admin\/(dashboard|vehicles|bookings)/)
  }

  test.beforeAll(async () => {
    await cleanup()

    // 0. Ensure Admin user exists
    const { data: authData } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' }
    })

    adminUserId = authData?.user?.id || ''
    if (!adminUserId) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      adminUserId = listData?.users.find(u => u.email === adminEmail)?.id || ''
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

    // 1. Get seed branch, customer, category
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const category = await prisma.vehicleCategory.findFirst()
    let customer = await prisma.customer.findFirst()

    if (!branch || !category) {
      throw new Error('Missing seed data')
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: 'Customer Reassign Test',
          email: 'cust_reassign@test.com',
          phone: '081234567890',
          verificationStatus: 'verified'
        }
      })
    } else {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { verificationStatus: 'verified' }
      })
    }

    branchId = branch.id
    customerId = customer.id

    // 2. Create test vehicles
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Test Reassign Vehicle 1',
        plateNumber: plate,
        categoryId: category.id,
        branchId: branch.id,
        dailyRate: 500000,
        status: 'available',
        isActive: true
      }
    })
    vehicleId = vehicle.id

    const vehicle2 = await prisma.vehicle.create({
      data: {
        name: 'Test Reassign Vehicle 2',
        plateNumber: plate2,
        categoryId: category.id,
        branchId: branch.id,
        dailyRate: 500000,
        status: 'available',
        isActive: true
      }
    })
    vehicle2Id = vehicle2.id

    // 3. Create test drivers (A, B, C)
    const driverA = await prisma.driver.create({
      data: {
        name: 'Driver Alpha',
        licenseNumber: `${prefix}A`,
        phone: '08111111111',
        dailyFee: 150000,
        branchId: branch.id,
        status: 'available',
        isActive: true
      }
    })
    driverAId = driverA.id

    const driverB = await prisma.driver.create({
      data: {
        name: 'Driver Beta',
        licenseNumber: `${prefix}B`,
        phone: '08222222222',
        dailyFee: 150000,
        branchId: branch.id,
        status: 'available',
        isActive: true
      }
    })
    driverBId = driverB.id

    const driverC = await prisma.driver.create({
      data: {
        name: 'Driver Gamma',
        licenseNumber: `${prefix}C`,
        phone: '08333333333',
        dailyFee: 150000,
        branchId: branch.id,
        status: 'available',
        isActive: true
      }
    })
    driverCId = driverC.id
  })

  test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  test('1. UI & Backend: Reassign driver on confirmed booking records audit trail and keeps status available', async ({ page }) => {
    const now = new Date()
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    // Create confirmed booking with Driver A
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'with_driver',
        driverId: driverAId,
        driverAssignmentStatus: 'assigned',
        status: 'confirmed',
        totalPrice: 1300000
      }
    })

    page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()))
    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)

    // Verify initial driver display in blue card
    const currentDriverCard = page.locator('.bg-blue-50 p.font-bold')
    await expect(currentDriverCard).toHaveText('Driver Alpha')

    // Select Driver Beta in dropdown
    const select = page.locator('select')
    await select.selectOption(driverBId)

    // Reason input appears for reassignment
    const reasonInput = page.locator('input[placeholder="Alasan pergantian sopir (opsional)"]')
    await expect(reasonInput).toBeVisible()
    await reasonInput.fill('Sopir Alpha berhalangan hadir')

    // Click "Ganti Sopir"
    const submitBtn = page.getByRole('button', { name: 'Ganti Sopir' })
    await submitBtn.click()

    await expect(currentDriverCard).toHaveText('Driver Beta', { timeout: 15000 })
    await expect(page.locator('text=Riwayat Pergantian Sopir:')).toBeVisible()
    await expect(page.locator('text=Sopir Alpha berhalangan hadir')).toBeVisible()

    // Verify DB state
    const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(updatedBooking?.driverId).toBe(driverBId)
    expect(updatedBooking?.reassignmentReason).toBe('Sopir Alpha berhalangan hadir')

    const dA = await prisma.driver.findUnique({ where: { id: driverAId } })
    const dB = await prisma.driver.findUnique({ where: { id: driverBId } })
    expect(dA?.status).toBe('available')
    expect(dB?.status).toBe('available')

    await prisma.booking.delete({ where: { id: booking.id } })
  })

  test('2. UI & Backend: Reassign driver on ongoing booking restores old driver to available and promotes new driver to on_trip', async ({ page }) => {
    const now = new Date()
    const startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Ensure vehicle is rented and driver A is on_trip
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: 'rented' } })
    await prisma.driver.update({ where: { id: driverAId }, data: { status: 'on_trip' } })
    await prisma.driver.update({ where: { id: driverBId }, data: { status: 'available' } })

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'with_driver',
        driverId: driverAId,
        driverAssignmentStatus: 'assigned',
        status: 'ongoing',
        totalPrice: 1300000
      }
    })

    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)

    const currentDriverCard = page.locator('.bg-blue-50 p.font-bold')
    await expect(currentDriverCard).toHaveText('Driver Alpha')

    // Select Driver Beta in dropdown
    const select = page.locator('select')
    await select.selectOption(driverBId)

    // Fill reason
    const reasonInput = page.locator('input[placeholder="Alasan pergantian sopir (opsional)"]')
    await reasonInput.fill('Sopir Alpha mendadak sakit di jalan')

    // Click "Ganti Sopir"
    await page.getByRole('button', { name: 'Ganti Sopir' }).click()

    // Verify UI updates
    await expect(currentDriverCard).toHaveText('Driver Beta', { timeout: 15000 })
    await expect(page.locator('text=Sopir Alpha mendadak sakit di jalan')).toBeVisible()

    // Verify DB state
    const dA = await prisma.driver.findUnique({ where: { id: driverAId } })
    const dB = await prisma.driver.findUnique({ where: { id: driverBId } })
    expect(dA?.status).toBe('available') // old driver restored to available
    expect(dB?.status).toBe('on_trip')   // new driver promoted to on_trip

    // Reset vehicle and driver
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: 'available' } })
    await prisma.driver.update({ where: { id: driverBId }, data: { status: 'available' } })
    await prisma.booking.delete({ where: { id: booking.id } })
  })

  test('3. UI: Driver with past leave is eligible and selectable on ongoing booking', async ({ page }) => {
    const now = new Date()
    const startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() + 20 * 60 * 60 * 1000)

    // Driver C had leave that ended 1 hour ago (in the past!)
    await prisma.driverLeave.create({
      data: {
        driverId: driverCId,
        startDate: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        reason: 'Urusan keluarga pagi tadi'
      }
    })

    await prisma.driver.update({ where: { id: driverCId }, data: { status: 'available' } })
    await prisma.driver.update({ where: { id: driverAId }, data: { status: 'on_trip' } })

    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'with_driver',
        driverId: driverAId,
        driverAssignmentStatus: 'assigned',
        status: 'ongoing',
        totalPrice: 1300000
      }
    })

    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)

    // Driver Gamma (driverC) should be present in the dropdown because their leave is in the past!
    const select = page.locator('select')
    await expect(select.locator('option', { hasText: 'Driver Gamma' })).toHaveCount(1)
    await select.selectOption(driverCId)

    await page.getByRole('button', { name: 'Ganti Sopir' }).click()
    const currentDriverCard = page.locator('.bg-blue-50 p.font-bold')
    await expect(currentDriverCard).toHaveText('Driver Gamma', { timeout: 15000 })

    // Reset Driver C and cleanup
    await prisma.driver.update({ where: { id: driverCId }, data: { status: 'available' } })
    await prisma.driverLeave.deleteMany({ where: { driverId: driverCId } })
    await prisma.booking.delete({ where: { id: booking.id } })
  })

  test('4. UI Guard: Pending payment booking hides AssignDriverForm', async ({ page }) => {
    const now = new Date()
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        rentalType: 'with_driver',
        status: 'pending_payment',
        totalPrice: 1300000
      }
    })

    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)

    // Form to assign driver should strictly NOT be rendered
    await expect(page.locator('text=Pilih / Ubah Sopir:')).not.toBeVisible()
    await expect(page.locator('select', { hasText: '-- Pilih Sopir --' })).not.toBeVisible()

    await prisma.booking.delete({ where: { id: booking.id } })
  })

  test('5. UI Guard: Self-drive booking does not render driver assignment section', async ({ page }) => {
    const now = new Date()
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        rentalType: 'self_drive',
        status: 'confirmed',
        totalPrice: 1000000
      }
    })

    await loginAsAdmin(page)
    await page.goto(`/admin/bookings/${booking.id}`)

    // Penugasan Sopir section should not exist
    await expect(page.locator('text=Penugasan Sopir')).not.toBeVisible()

    await prisma.booking.delete({ where: { id: booking.id } })
  })

  test('6. Backend Transactional Simulation: Database exclusion constraint rejects overlapping driver assignments', async () => {
    const now = new Date()
    const startDate1 = new Date(now.getTime() + 10 * 60 * 60 * 1000)
    const endDate1 = new Date(now.getTime() + 20 * 60 * 60 * 1000)

    const booking1 = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: startDate1,
        endDate: endDate1,
        rentalType: 'with_driver',
        driverId: driverBId,
        driverAssignmentStatus: 'assigned',
        status: 'confirmed',
        totalPrice: 1300000
      }
    })

    // Try to insert a second booking with vehicle2Id (no vehicle conflict!) overlapping with booking1 for the same driverB
    const startDate2 = new Date(now.getTime() + 15 * 60 * 60 * 1000)
    const endDate2 = new Date(now.getTime() + 25 * 60 * 60 * 1000)

    let errorThrown = false
    try {
      await prisma.booking.create({
        data: {
          customerId,
          vehicleId: vehicle2Id, // separate vehicle so vehicle constraint does not trigger
          pickupBranchId: branchId,
          returnBranchId: branchId,
          startDate: startDate2,
          endDate: endDate2,
          rentalType: 'with_driver',
          driverId: driverBId,
          driverAssignmentStatus: 'assigned',
          status: 'confirmed',
          totalPrice: 1300000
        }
      })
    } catch (err: any) {
      errorThrown = true
      expect(err.message).toContain('booking_driver_no_overlap')
    }

    expect(errorThrown).toBe(true)

    await prisma.booking.deleteMany({ where: { id: booking1.id } })
  })

  test('7. Backend Transactional Simulation: Optimistic locking rejects concurrent reassignments', async () => {
    const now = new Date()
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate: new Date(now.getTime() + 30 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 40 * 60 * 60 * 1000),
        rentalType: 'with_driver',
        driverId: driverAId,
        driverAssignmentStatus: 'assigned',
        status: 'confirmed',
        totalPrice: 1300000
      }
    })

    // Simulate Admin 1 updating driverId to driverB
    const update1 = await prisma.booking.updateMany({
      where: { id: booking.id, driverId: driverAId },
      data: { driverId: driverBId }
    })
    expect(update1.count).toBe(1)

    // Simulate Admin 2 trying to update based on stale driverA state
    const update2 = await prisma.booking.updateMany({
      where: { id: booking.id, driverId: driverAId },
      data: { driverId: driverCId }
    })
    // Second update must affect 0 rows
    expect(update2.count).toBe(0)

    await prisma.booking.delete({ where: { id: booking.id } })
  })
})
