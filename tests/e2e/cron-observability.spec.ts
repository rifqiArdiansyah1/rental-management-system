import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { subMinutes } from '../helpers/date'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

test.describe.configure({ mode: 'serial' })

test.describe('Observability Cron Cleanup (Issue #20)', () => {
  const cronSecret = process.env.CRON_MANUAL_SECRET || 'test-cron-manual-secret'

  const adminEmail = `admin_cron_${Date.now()}@test.com`
  const adminPassword = 'Password123!'
  let adminUserId = ''

  const staffAEmail = `staff_a_cron_${Date.now()}@test.com`
  const staffAPassword = 'Password123!'
  let staffAUserId = ''

  let branchAId = ''
  let branchBId = ''
  let customerId = ''
  let vehicleAId = ''
  let vehicleBId = ''

  test.beforeAll(async () => {
    // 1. Setup Supabase Admin
    const supabaseAdmin = createClient(
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 2. Setup Branches & Category
    const timestamp = Date.now()
    const branchA = await prisma.branch.create({
      data: {
        name: `Cabang Alpha Cron ${timestamp}`,
        city: 'Surabaya',
        address: 'Jl. Pemuda No. 1',
        phone: '0811111111'
      }
    })
    branchAId = branchA.id

    const branchB = await prisma.branch.create({
      data: {
        name: `Cabang Beta Cron ${timestamp}`,
        city: 'Malang',
        address: 'Jl. Ijen No. 2',
        phone: '0822222222'
      }
    })
    branchBId = branchB.id

    let category = await prisma.vehicleCategory.findFirst()
    if (!category) {
      category = await prisma.vehicleCategory.create({
        data: {
          name: 'SUV Cron Test',
          capacity: 7,
          transmission: 'Automatic',
          features: ['AC', 'Bluetooth']
        }
      })
    }

    // 3. Setup Vehicles
    const vehicleA = await prisma.vehicle.create({
      data: {
        name: 'Toyota Fortuner Cron A',
        plateNumber: `CRON-A-${timestamp}`,
        categoryId: category.id,
        branchId: branchAId,
        dailyRate: 600000,
        status: 'available',
        isActive: true
      }
    })
    vehicleAId = vehicleA.id

    const vehicleB = await prisma.vehicle.create({
      data: {
        name: 'Mitsubishi Pajero Cron B',
        plateNumber: `CRON-B-${timestamp}`,
        categoryId: category.id,
        branchId: branchBId,
        dailyRate: 600000,
        status: 'available',
        isActive: true
      }
    })
    vehicleBId = vehicleB.id

    // 4. Setup Customer
    let customer = await prisma.customer.findFirst()
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: 'Customer Cron Observability',
          email: `cust_cron_${timestamp}@test.com`,
          phone: '0899999999',
          verificationStatus: 'verified'
        }
      })
    }
    customerId = customer.id

    // 5. Setup Admin Pusat
    const { data: adminAuth } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' }
    })

    if (adminAuth?.user) {
      adminUserId = adminAuth.user.id
      await prisma.user.upsert({
        where: { id: adminUserId },
        update: { role: 'admin_pusat', isActive: true },
        create: {
          id: adminUserId,
          email: adminEmail,
          name: 'Admin Pusat Cron',
          role: 'admin_pusat',
          isActive: true
        }
      })
    }

    // 6. Setup Staff Cabang A
    const { data: staffAuth } = await supabaseAdmin.auth.admin.createUser({
      email: staffAEmail,
      password: staffAPassword,
      email_confirm: true,
      app_metadata: { role: 'staff_cabang', branchId: branchAId }
    })

    if (staffAuth?.user) {
      staffAUserId = staffAuth.user.id
      await prisma.user.upsert({
        where: { id: staffAUserId },
        update: { role: 'staff_cabang', branchId: branchAId, isActive: true },
        create: {
          id: staffAUserId,
          email: staffAEmail,
          name: 'Staff Cabang Alpha',
          role: 'staff_cabang',
          branchId: branchAId,
          isActive: true
        }
      })
    }
  })

  async function loginAs(page: any, email: string, pass: string) {
    await page.context().clearCookies()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/admin/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', pass)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/admin\/(dashboard|vehicles|bookings)/)
  }

  test('1. API Auth Guard: Unauthorized request returns 401 and does not mutate CronHeartbeat', async ({ request }) => {
    // Initial heartbeat state
    const initialHeartbeat = await prisma.cronHeartbeat.findUnique({
      where: { jobName: 'cancel-bookings' }
    })

    // Request without Authorization header
    const resNoAuth = await request.get('/api/cron/cancel-bookings')
    expect(resNoAuth.status()).toBe(401)
    const jsonNoAuth = await resNoAuth.json()
    expect(jsonNoAuth.error).toBe('Unauthorized')

    // Request with wrong token
    const resWrongAuth = await request.get('/api/cron/cancel-bookings', {
      headers: { authorization: 'Bearer invalid-token-xyz' }
    })
    expect(resWrongAuth.status()).toBe(401)

    // Verify heartbeat was NOT modified
    const currentHeartbeat = await prisma.cronHeartbeat.findUnique({
      where: { jobName: 'cancel-bookings' }
    })
    expect(currentHeartbeat?.lastRunAt?.getTime()).toBe(initialHeartbeat?.lastRunAt?.getTime())
  })

  test('2. API Success & Heartbeat: Cancels expired bookings and updates CronHeartbeat with atomic count and executionTimeMs', async ({ request }) => {
    const now = new Date()

    // 1. Booking A: expired (created 100 minutes ago)
    const expiredBooking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicleAId,
        pickupBranchId: branchAId,
        returnBranchId: branchAId,
        startDate: new Date(now.getTime() + 24 * 3600 * 1000),
        endDate: new Date(now.getTime() + 48 * 3600 * 1000),
        rentalType: 'self_drive',
        status: 'pending_payment',
        totalPrice: 1200000,
        createdAt: subMinutes(now, 100)
      }
    })

    await prisma.payment.create({
      data: {
        bookingId: expiredBooking.id,
        method: 'credit_card',
        amount: 1200000,
        status: 'pending'
      }
    })

    // 2. Booking B: fresh (created 10 minutes ago)
    const freshBooking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicleBId,
        pickupBranchId: branchBId,
        returnBranchId: branchBId,
        startDate: new Date(now.getTime() + 72 * 3600 * 1000),
        endDate: new Date(now.getTime() + 96 * 3600 * 1000),
        rentalType: 'self_drive',
        status: 'pending_payment',
        totalPrice: 1200000,
        createdAt: subMinutes(now, 10)
      }
    })

    // Execute cron endpoint with valid secret
    const res = await request.get('/api/cron/cancel-bookings', {
      headers: { authorization: `Bearer ${cronSecret}` }
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.cancelledCount).toBeGreaterThanOrEqual(1)
    expect(typeof json.executionTimeMs).toBe('number')

    // Verify DB states: expired booking cancelled, fresh booking untouched
    const bExpired = await prisma.booking.findUnique({ where: { id: expiredBooking.id } })
    expect(bExpired?.status).toBe('cancelled')

    const pExpired = await prisma.payment.findFirst({ where: { bookingId: expiredBooking.id } })
    expect(pExpired?.status).toBe('failed')

    const bFresh = await prisma.booking.findUnique({ where: { id: freshBooking.id } })
    expect(bFresh?.status).toBe('pending_payment')

    // Verify CronHeartbeat was updated
    const heartbeat = await prisma.cronHeartbeat.findUnique({
      where: { jobName: 'cancel-bookings' }
    })
    expect(heartbeat).not.toBeNull()
    expect(heartbeat?.status).toBe('success')
    expect(heartbeat?.bookingsCancelled).toBeGreaterThanOrEqual(1)
    expect(heartbeat?.lastError).toBeNull()
    expect(heartbeat?.executionTimeMs).toBeGreaterThanOrEqual(0)

    // Cleanup
    await prisma.payment.deleteMany({ where: { bookingId: { in: [expiredBooking.id, freshBooking.id] } } })
    await prisma.booking.deleteMany({ where: { id: { in: [expiredBooking.id, freshBooking.id] } } })
  })

  test('3. UI Dashboard Healthy State: Fresh heartbeat renders green "Berjalan Normal" badge', async ({ page }) => {
    // Set heartbeat to fresh (5 minutes ago)
    await prisma.cronHeartbeat.upsert({
      where: { jobName: 'cancel-bookings' },
      create: {
        jobName: 'cancel-bookings',
        lastRunAt: subMinutes(new Date(), 5),
        bookingsCancelled: 3,
        status: 'success'
      },
      update: {
        lastRunAt: subMinutes(new Date(), 5),
        bookingsCancelled: 3,
        status: 'success',
        lastError: null
      }
    })

    await loginAs(page, adminEmail, adminPassword)
    await page.goto('/admin/dashboard')

    // Verify Cron Scheduler Card & Badge
    const schedulerCard = page.locator('[data-testid="cron-scheduler-card"]')
    await expect(schedulerCard).toBeVisible()

    const badge = page.locator('[data-testid="cron-status-badge"]')
    await expect(badge).toHaveText(/Berjalan Normal/)
    await expect(badge).toHaveClass(/bg-emerald-100/)

    // Verify subtext contains relative time and cancelled count
    await expect(schedulerCard).toContainText('menit lalu')
    await expect(schedulerCard).toContainText('3 unit')
  })

  test('4. UI Dashboard Stale Alert: Heartbeat > 30 mins renders red "Scheduler Berhenti" alert', async ({ page }) => {
    // Backdate heartbeat to 45 minutes ago (> 2x 15m interval)
    await prisma.cronHeartbeat.update({
      where: { jobName: 'cancel-bookings' },
      data: {
        lastRunAt: subMinutes(new Date(), 45),
        status: 'success'
      }
    })

    await loginAs(page, adminEmail, adminPassword)
    await page.goto('/admin/dashboard')

    const badge = page.locator('[data-testid="cron-status-badge"]')
    await expect(badge).toHaveText(/Scheduler Berhenti/)
    await expect(badge).toHaveClass(/bg-red-100/)

    const schedulerCard = page.locator('[data-testid="cron-scheduler-card"]')
    await expect(schedulerCard).toContainText('melampaui batas toleransi 30 menit')
  })

  test('5. UI Dashboard Failed State: Failed heartbeat renders red "Eksekusi Gagal" and error message', async ({ page }) => {
    await prisma.cronHeartbeat.update({
      where: { jobName: 'cancel-bookings' },
      data: {
        lastRunAt: subMinutes(new Date(), 3),
        status: 'failed',
        lastError: 'Simulated connection pool timeout'
      }
    })

    await loginAs(page, adminEmail, adminPassword)
    await page.goto('/admin/dashboard')

    const badge = page.locator('[data-testid="cron-status-badge"]')
    await expect(badge).toHaveText(/Eksekusi Gagal/)
    await expect(badge).toHaveClass(/bg-red-100/)

    const schedulerCard = page.locator('[data-testid="cron-scheduler-card"]')
    await expect(schedulerCard).toContainText('Simulated connection pool timeout')
  })

  test('6. UI Dashboard Anomaly Alert: Pending booking older than 120 mins triggers independent anomaly warning', async ({ page }) => {
    // Reset heartbeat to healthy
    await prisma.cronHeartbeat.update({
      where: { jobName: 'cancel-bookings' },
      data: {
        lastRunAt: subMinutes(new Date(), 5),
        status: 'success',
        lastError: null
      }
    })

    // Create stuck pending booking (130 minutes ago)
    const stuckBooking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicleAId,
        pickupBranchId: branchAId,
        returnBranchId: branchAId,
        startDate: new Date(Date.now() + 24 * 3600 * 1000),
        endDate: new Date(Date.now() + 48 * 3600 * 1000),
        rentalType: 'self_drive',
        status: 'pending_payment',
        totalPrice: 800000,
        createdAt: subMinutes(new Date(), 130)
      }
    })

    await loginAs(page, adminEmail, adminPassword)
    await page.goto('/admin/dashboard')

    // Telemetry badge should still be healthy
    await expect(page.locator('[data-testid="cron-status-badge"]')).toHaveText(/Berjalan Normal/)

    // BUT Anomaly badge triggers warning!
    const anomalyBadge = page.locator('[data-testid="anomaly-status-badge"]')
    await expect(anomalyBadge).toHaveText(/Anomali Booking Tertahan/)
    await expect(anomalyBadge).toHaveClass(/bg-red-100/)

    const anomalyCard = page.locator('[data-testid="cron-anomaly-card"]')
    await expect(anomalyCard).toContainText('130 menit')
    await expect(anomalyCard).toContainText('melebihi 120 menit belum dibatalkan')

    // Cleanup
    await prisma.booking.delete({ where: { id: stuckBooking.id } })
  })

  test('7. UI Dashboard Branch Scoping: Staff Cabang Alpha does not see stuck booking of Cabang Beta', async ({ page }) => {
    // Ensure no pending bookings in Cabang Alpha
    await prisma.booking.deleteMany({
      where: { pickupBranchId: branchAId, status: 'pending_payment' }
    })

    // Create stuck pending booking in Cabang Beta (135 mins old)
    const stuckBetaBooking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicleBId,
        pickupBranchId: branchBId,
        returnBranchId: branchBId,
        startDate: new Date(Date.now() + 24 * 3600 * 1000),
        endDate: new Date(Date.now() + 48 * 3600 * 1000),
        rentalType: 'self_drive',
        status: 'pending_payment',
        totalPrice: 850000,
        createdAt: subMinutes(new Date(), 135)
      }
    })

    // 1. Staff Cabang Alpha logs in
    await loginAs(page, staffAEmail, staffAPassword)
    await page.goto('/admin/dashboard')

    const anomalyCardStaff = page.locator('[data-testid="cron-anomaly-card"]')
    await expect(anomalyCardStaff).toBeVisible()

    // Staff Alpha should see clean queue for their branch, NOT Cabang Beta's stuck booking!
    const anomalyBadgeStaff = page.locator('[data-testid="anomaly-status-badge"]')
    await expect(anomalyBadgeStaff).toHaveText(/Antrean Bersih/)
    await expect(anomalyCardStaff).toContainText('Tidak ada pesanan pending pembayaran di cabang Anda')
    await expect(anomalyCardStaff).not.toContainText('135 menit')

    // 2. Admin Pusat logs in
    await loginAs(page, adminEmail, adminPassword)
    await page.goto('/admin/dashboard')

    // Admin Pusat DOES see the global anomaly across branches!
    const anomalyBadgeAdmin = page.locator('[data-testid="anomaly-status-badge"]')
    await expect(anomalyBadgeAdmin).toHaveText(/Anomali Booking Tertahan/)
    const anomalyCardAdmin = page.locator('[data-testid="cron-anomaly-card"]')
    await expect(anomalyCardAdmin).toContainText('135 menit')

    // Cleanup
    await prisma.booking.delete({ where: { id: stuckBetaBooking.id } })
  })

  test.afterAll(async () => {
    // Clean test data
    await prisma.booking.deleteMany({
      where: { vehicleId: { in: [vehicleAId, vehicleBId] } }
    })
    await prisma.vehicle.deleteMany({
      where: { id: { in: [vehicleAId, vehicleBId] } }
    })
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, staffAUserId].filter(Boolean) } }
    })
    await prisma.branch.deleteMany({
      where: { id: { in: [branchAId, branchBId] } }
    })
    await prisma.cronHeartbeat.deleteMany({
      where: { jobName: 'cancel-bookings' }
    })
  })
})
