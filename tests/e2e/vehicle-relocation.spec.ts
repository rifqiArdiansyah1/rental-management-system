import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createVehicle, updateVehicleStatus, relocateVehicle } from '@/actions/adminVehicle'

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
const testPlatePrefix = 'TEST-RLC-'

async function cleanupTestData() {
  await prisma.payment.deleteMany({
    where: { booking: { vehicle: { plateNumber: { startsWith: testPlatePrefix } } } }
  })
  await prisma.booking.deleteMany({
    where: { vehicle: { plateNumber: { startsWith: testPlatePrefix } } }
  })
  await prisma.vehicleUnavailability.deleteMany({
    where: { vehicle: { plateNumber: { startsWith: testPlatePrefix } } }
  })
  // Break self relations before deleting
  await prisma.vehicle.updateMany({
    where: { plateNumber: { startsWith: testPlatePrefix } },
    data: { previousVehicleId: null }
  })
  await prisma.vehicle.deleteMany({
    where: { plateNumber: { startsWith: testPlatePrefix } }
  })
}

test.describe('Fleet Relocation (Linked Record & Partial Unique Index)', () => {
  let branchA: { id: string; name: string }
  let branchB: { id: string; name: string }
  let category: { id: string; name: string }
  let customer: { id: string; name: string }
  let adminUserId: string

  test.beforeAll(async () => {
    await cleanupTestData()

    // 1. Ensure admin user exists in Supabase Auth & Prisma
    const { data: authData } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'admin_pusat' }
    })

    let userId = authData?.user?.id
    if (!userId) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      userId = listData?.users.find(u => u.email === adminEmail)?.id
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: adminPassword,
          app_metadata: { role: 'admin_pusat' },
          email_confirm: true
        })
      }
    }

    if (userId) {
      adminUserId = userId
      await prisma.user.upsert({
        where: { id: userId },
        update: { role: 'admin_pusat', isActive: true },
        create: { id: userId, email: adminEmail, name: 'Admin Pusat Test', role: 'admin_pusat', isActive: true }
      })
    }

    // 2. Fetch branches and ensure at least 2 branches exist
    const branches = await prisma.branch.findMany({ where: { isActive: true }, take: 2 })
    if (branches.length === 0) {
      throw new Error('Database requires at least 1 active branch.')
    }
    branchA = branches[0]
    if (branches.length < 2) {
      branchB = await prisma.branch.create({
        data: {
          name: 'Cabang Test Bandung',
          city: 'Bandung',
          address: 'Jl. Asia Afrika No 45',
          phone: '081298765432',
          isActive: true
        }
      })
    } else {
      branchB = branches[1]
    }

    const cat = await prisma.vehicleCategory.findFirst()
    if (!cat) throw new Error('Database requires at least 1 vehicle category.')
    category = cat

    const cust = await prisma.customer.findFirst()
    if (!cust) throw new Error('Database requires at least 1 customer.')
    customer = cust
  })

  test.afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  test('Database Level: Partial Unique Index allows duplicate plate only if previous row is inactive', async () => {
    const plate = `${testPlatePrefix}PARTIAL-01`

    // 1. Create first active vehicle
    const v1 = await prisma.vehicle.create({
      data: {
        name: 'Unit A',
        plateNumber: plate,
        branchId: branchA.id,
        categoryId: category.id,
        dailyRate: 500000,
        status: 'available',
        isActive: true
      }
    })

    // 2. Creating another ACTIVE vehicle with same plate must fail at DB constraint level
    await expect(
      prisma.vehicle.create({
        data: {
          name: 'Unit B Duplicate',
          plateNumber: plate,
          branchId: branchB.id,
          categoryId: category.id,
          dailyRate: 500000,
          status: 'available',
          isActive: true
        }
      })
    ).rejects.toThrow()

    // 3. Deactivate Unit A
    await prisma.vehicle.update({
      where: { id: v1.id },
      data: { isActive: false, status: 'moved' }
    })

    // 4. Now creating another ACTIVE vehicle with same plate must SUCCEED!
    const v2 = await prisma.vehicle.create({
      data: {
        name: 'Unit B Active',
        plateNumber: plate,
        branchId: branchB.id,
        categoryId: category.id,
        dailyRate: 500000,
        status: 'available',
        isActive: true,
        previousVehicleId: v1.id
      }
    })

    expect(v2.id).toBeDefined()
    expect(v2.plateNumber).toBe(plate)
    expect(v2.previousVehicleId).toBe(v1.id)
  })

  test('Application Guard: Generic status update strictly rejects "moved"', async () => {
    const plate = `${testPlatePrefix}REJECT-MOVED`
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Unit Test Reject Moved',
        plateNumber: plate,
        branchId: branchA.id,
        categoryId: category.id,
        dailyRate: 500000,
        status: 'available',
        isActive: true
      }
    })

    const res = await updateVehicleStatus(vehicle.id, 'moved' as any, {
      actor: { id: adminUserId, role: 'admin_pusat' }
    })

    expect(res.error).toBeDefined()
    expect(res.error).toContain('Status "Dipindahkan (Moved)" hanya dapat dilakukan melalui fitur Relokasi Armada')

    // Confirm DB status remains available
    const dbVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle.id } })
    expect(dbVehicle?.status).toBe('available')
  })

  test('Application Guard: Concurrent createVehicle duplicate plate returns friendly user message', async () => {
    const plate = `${testPlatePrefix}RACE-01`
    
    // First create succeeds
    const res1 = await createVehicle({
      name: 'Unit Race 1',
      plateNumber: plate,
      branchId: branchA.id,
      categoryId: category.id,
      dailyRate: 500000,
      actor: { id: adminUserId, role: 'admin_pusat' }
    })
    expect(res1.success).toBe(true)

    // Second create with same plate must return friendly error, not raw DB error
    const res2 = await createVehicle({
      name: 'Unit Race 2',
      plateNumber: plate,
      branchId: branchB.id,
      categoryId: category.id,
      dailyRate: 600000,
      actor: { id: adminUserId, role: 'admin_pusat' }
    })
    expect(res2.error).toBe('Plat nomor sudah terdaftar pada armada aktif lain.')
  })

  test('Core Relocation Flow: Atomic Linked Record transition from Branch A to Branch B with Transit Window', async () => {
    const plate = `${testPlatePrefix}FLOW-01`
    const sourceVehicle = await prisma.vehicle.create({
      data: {
        name: 'Innova Reborn Diesel',
        plateNumber: plate,
        branchId: branchA.id,
        categoryId: category.id,
        dailyRate: 750000,
        status: 'available',
        isActive: true
      }
    })

    const transitUntil = new Date(Date.now() + 48 * 60 * 60 * 1000) // 2 days in future
    const note = 'Mutasi unit untuk memenuhi lonjakan pesanan liburan'

    const result = await relocateVehicle(sourceVehicle.id, branchB.id, {
      transitUntil,
      note,
      actor: { id: adminUserId, role: 'admin_pusat' }
    })

    expect(result.success).toBe(true)
    expect(result.newVehicleId).toBeDefined()

    // 1. Verify Source Vehicle: decommissioned as moved
    const updatedSource = await prisma.vehicle.findUnique({
      where: { id: sourceVehicle.id },
      include: { relocatedTo: true }
    })
    expect(updatedSource?.isActive).toBe(false)
    expect(updatedSource?.status).toBe('moved')
    expect(updatedSource?.relocatedTo?.id).toBe(result.newVehicleId)

    // 2. Verify Target Vehicle: active, available specifications copied, linked to previousVehicleId
    const newVehicle = await prisma.vehicle.findUnique({
      where: { id: result.newVehicleId! },
      include: {
        previousVehicle: true,
        unavailabilities: { where: { actualEndAt: null } }
      }
    })
    expect(newVehicle?.isActive).toBe(true)
    expect(newVehicle?.branchId).toBe(branchB.id)
    expect(newVehicle?.plateNumber).toBe(plate)
    expect(Number(newVehicle?.dailyRate)).toBe(750000)
    expect(newVehicle?.previousVehicleId).toBe(sourceVehicle.id)
    expect(newVehicle?.previousVehicle?.id).toBe(sourceVehicle.id)

    // 3. Verify Transit Unavailability on target vehicle
    expect(newVehicle?.status).toBe('maintenance')
    expect(newVehicle?.unavailabilities.length).toBe(1)
    const unavail = newVehicle?.unavailabilities[0]
    expect(unavail?.reason).toBe('maintenance')
    expect(new Date(unavail!.estimatedEndAt!).getTime()).toBe(transitUntil.getTime())
    expect(unavail?.note).toBe(note)

    // 4. Verify Audit Log
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'vehicle.relocated',
        entityId: result.newVehicleId!
      }
    })
    expect(auditLog).toBeDefined()
    const metadata = auditLog?.metadata as any
    expect(metadata.sourceVehicleId).toBe(sourceVehicle.id)
    expect(metadata.newVehicleId).toBe(result.newVehicleId)
    expect(metadata.fromBranchId).toBe(branchA.id)
    expect(metadata.toBranchId).toBe(branchB.id)
  })

  test('Guard: Relocation fails if source vehicle has active future booking', async () => {
    const plate = `${testPlatePrefix}BOOKED-01`
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Unit With Future Booking',
        plateNumber: plate,
        branchId: branchA.id,
        categoryId: category.id,
        dailyRate: 500000,
        status: 'available',
        isActive: true
      }
    })

    // Create a future booking on source vehicle
    const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const futureEnd = new Date(Date.now() + 72 * 60 * 60 * 1000)
    await prisma.booking.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        pickupBranchId: branchA.id,
        returnBranchId: branchA.id,
        startDate: futureStart,
        endDate: futureEnd,
        rentalType: 'self_drive',
        status: 'confirmed',
        totalPrice: 1000000
      }
    })

    const result = await relocateVehicle(vehicle.id, branchB.id, {
      actor: { id: adminUserId, role: 'admin_pusat' }
    })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Kendaraan memiliki jadwal pesanan aktif di masa depan')

    // Confirm vehicle remains active in Branch A
    const current = await prisma.vehicle.findUnique({ where: { id: vehicle.id } })
    expect(current?.isActive).toBe(true)
    expect(current?.branchId).toBe(branchA.id)
  })

  test('Maintenance Continuity: Relocating vehicle currently in maintenance carries over history', async () => {
    const plate = `${testPlatePrefix}MAINT-CONT`
    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Unit Under Repair',
        plateNumber: plate,
        branchId: branchA.id,
        categoryId: category.id,
        dailyRate: 600000,
        status: 'maintenance',
        isActive: true
      }
    })

    // Active maintenance unavailability
    const originalUnavail = await prisma.vehicleUnavailability.create({
      data: {
        vehicleId: vehicle.id,
        reason: 'maintenance',
        startAt: new Date(Date.now() - 3600000),
        estimatedEndAt: new Date(Date.now() + 86400000),
        note: 'Perbaikan transmisi matic',
        createdBy: adminUserId
      }
    })

    const result = await relocateVehicle(vehicle.id, branchB.id, {
      actor: { id: adminUserId, role: 'admin_pusat' }
    })

    expect(result.success).toBe(true)

    // 1. Verify old unavailability was closed with explanatory note
    const closedUnavail = await prisma.vehicleUnavailability.findUnique({
      where: { id: originalUnavail.id }
    })
    expect(closedUnavail?.actualEndAt).not.toBeNull()
    expect(closedUnavail?.note).toContain('Ditutup otomatis karena mutasi ke Cabang')
    expect(closedUnavail?.note).toContain('Perbaikan transmisi matic')

    // 2. Verify new vehicle inherits maintenance status
    const newVehicle = await prisma.vehicle.findUnique({
      where: { id: result.newVehicleId! },
      include: { unavailabilities: { where: { actualEndAt: null } } }
    })
    expect(newVehicle?.status).toBe('maintenance')
    expect(newVehicle?.unavailabilities.length).toBe(1)
    expect(newVehicle?.unavailabilities[0].note).toContain('Lanjutan perbaikan dari Cabang')
    expect(newVehicle?.unavailabilities[0].note).toContain('Perbaikan transmisi matic')
  })

  test('UI Verification: Admin Pusat can see "Mutasi Cabang" and view lineage badges', async ({ page }) => {
    const plate = `${testPlatePrefix}UI-01`
    await prisma.vehicle.create({
      data: {
        name: 'Unit For UI Test',
        plateNumber: plate,
        branchId: branchA.id,
        categoryId: category.id,
        dailyRate: 500000,
        status: 'available',
        isActive: true
      }
    })

    // Login as admin
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/admin/login')
    await page.fill('input[name="email"]', adminEmail)
    await page.fill('input[name="password"]', adminPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/.*\/admin\/(dashboard|vehicles|bookings)/)

    // Navigate to vehicles list with query
    await page.goto(`/admin/vehicles?q=${plate}`)
    const vehicleRow = page.locator('tbody tr', { hasText: plate }).first()
    await expect(vehicleRow).toBeVisible()

    // Open row actions
    await vehicleRow.getByRole('button', { name: '•••' }).click()

    // Verify "Mutasi Cabang" option is present for admin_pusat
    const mutateBtn = vehicleRow.getByRole('button', { name: 'Mutasi Cabang' })
    await expect(mutateBtn).toBeVisible()
    await mutateBtn.click()

    // Verify Relocate Modal opens
    const modal = page.locator('div.fixed.inset-0', { hasText: 'Mutasi Armada Antar Cabang' })
    await expect(modal).toBeVisible()
    await expect(modal.getByText('Pola Mutasi Terhubung (Linked Record)')).toBeVisible()

    // Select target branch
    const branchSelect = modal.locator('select')
    await branchSelect.selectOption(branchB.id)

    // Fill note
    await modal.locator('textarea').fill('Mutasi via E2E UI Test')

    // Submit mutation
    await modal.getByRole('button', { name: 'Eksekusi Mutasi' }).click()
    await expect(modal).not.toBeVisible({ timeout: 15000 })

    // Reload page with showInactive=true to inspect both units
    await page.goto(`/admin/vehicles?q=${plate}&showInactive=true`)

    // Verify decommissioned unit shows MUTASI badge
    const oldRow = page.locator('tbody tr', { hasText: `MUTASI ➔ ${branchB.name}` })
    await expect(oldRow).toBeVisible({ timeout: 15000 })
    await expect(oldRow.getByText(branchA.name)).toBeVisible()

    // Verify new unit shows lineage badge
    const newRow = page.locator('tbody tr', { hasText: `↳ Mutasi dari ${branchA.name}` })
    await expect(newRow).toBeVisible({ timeout: 15000 })
    await expect(newRow.getByText(branchB.name)).toBeVisible()
  })
})
