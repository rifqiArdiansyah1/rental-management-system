import { test, expect } from '@playwright/test'
import { PrismaClient, VehicleStatus, BookingStatus, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { checkVehicleAvailability, createDraftBookingCore } from '@/lib/booking'
import { updateVehicleStatus, updateVehicleUnavailabilityEstimate } from '@/actions/adminVehicle'
import { findConflictRiskBookingIds, detectScheduleConflict } from '@/lib/scheduleConflict'
import { TURNOVER_BUFFER_MS } from '@/lib/constants'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const testPlate1 = 'TEST-MAINT-01'
const testPlate2 = 'TEST-MOVED-02'

async function cleanupTestData() {
  await prisma.vehicleUnavailability.deleteMany({
    where: { vehicle: { plateNumber: { in: [testPlate1, testPlate2] } } }
  })
  await prisma.payment.deleteMany({
    where: { booking: { vehicle: { plateNumber: { in: [testPlate1, testPlate2] } } } }
  })
  await prisma.booking.deleteMany({
    where: { vehicle: { plateNumber: { in: [testPlate1, testPlate2] } } }
  })
  await prisma.vehicle.deleteMany({
    where: { plateNumber: { in: [testPlate1, testPlate2] } }
  })
}

test.describe('Vehicle Maintenance & Unavailability Scheduling (Opsi A)', () => {
  let branch1Id: string
  let branch2Id: string
  let categoryId: string
  let customerId: string
  let adminActor: { id: string; role: UserRole }
  let vehicle1Id: string
  let vehicle2Id: string

  test.beforeAll(async () => {
    await cleanupTestData()

    const branches = await prisma.branch.findMany({ where: { isActive: true }, take: 2 })
    if (branches.length < 1) {
      throw new Error('Minimal 1 cabang aktif diperlukan untuk pengujian.')
    }
    branch1Id = branches[0].id
    if (branches.length >= 2) {
      branch2Id = branches[1].id
    } else {
      const b2 = await prisma.branch.create({
        data: {
          name: 'Cabang Test Bandung (Maint Test)',
          city: 'Bandung',
          address: 'Jl. Bandung Test No 45',
          phone: '081299998888',
          isActive: true,
        }
      })
      branch2Id = b2.id
    }

    const category = await prisma.vehicleCategory.findFirst()
    if (!category) throw new Error('Kategori kendaraan tidak ditemukan.')
    categoryId = category.id

    const customer = await prisma.customer.findFirst()
    if (!customer) throw new Error('Customer tidak ditemukan.')
    customerId = customer.id

    // Ensure mock admin session user exists for server actions
    let adminUser = await prisma.user.findFirst({
      where: { role: 'admin_pusat', isActive: true }
    })
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          id: 'test-admin-pusat-id',
          email: 'admin-maint-test@rental.com',
          name: 'Admin Maint Test',
          role: 'admin_pusat',
          isActive: true
        }
      })
    }
    adminActor = { id: adminUser.id, role: adminUser.role }

    // Create 2 test vehicles
    const v1 = await prisma.vehicle.create({
      data: {
        name: 'Toyota Alphard Maint Test',
        plateNumber: testPlate1,
        categoryId,
        branchId: branch1Id,
        dailyRate: 1500000,
        status: 'available',
        isActive: true,
      }
    })
    vehicle1Id = v1.id

    const v2 = await prisma.vehicle.create({
      data: {
        name: 'Honda CR-V Moved Test',
        plateNumber: testPlate2,
        categoryId,
        branchId: branch1Id,
        dailyRate: 800000,
        status: 'available',
        isActive: true,
      }
    })
    vehicle2Id = v2.id
  })

  test.afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
    await pool.end()
  })

  test('1. Presisi Buffer 3 Jam: Unit maintenance dapat dipesan tepat setelah estimasi + 3 jam buffer', async () => {
    // Set vehicle1 to maintenance with estimatedEndAt tomorrow 12:00 UTC
    const tomorrow12 = new Date(Date.now() + 24 * 60 * 60 * 1000)
    tomorrow12.setUTCHours(12, 0, 0, 0)

    const maintRes = await updateVehicleStatus(vehicle1Id, 'maintenance', {
      estimatedEndAt: tomorrow12,
      note: 'Ganti oli & servis berkala',
      actor: adminActor
    })
    expect(maintRes.success).toBe(true)

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle1Id },
      include: { unavailabilities: { where: { actualEndAt: null } } }
    })
    expect(vehicle?.status).toBe('maintenance')
    expect(vehicle?.unavailabilities.length).toBe(1)
    expect(vehicle?.unavailabilities[0].reason).toBe('maintenance')

    // Case A: Booking starting 2 hours after maintenance (kurang dari 3 jam buffer) -> HARUS DITOLAK
    const bookingStartTooEarly = new Date(tomorrow12.getTime() + 2 * 60 * 60 * 1000) // 14:00
    const bookingEndTooEarly = new Date(bookingStartTooEarly.getTime() + 24 * 60 * 60 * 1000)

    const isAvailableTooEarly = await checkVehicleAvailability(vehicle1Id, bookingStartTooEarly, bookingEndTooEarly)
    expect(isAvailableTooEarly).toBe(false)

    // Attempting draft creation must throw availability error
    await expect(createDraftBookingCore({
      customerId,
      vehicleId: vehicle1Id,
      pickupBranchId: branch1Id,
      returnBranchId: branch1Id,
      startDate: bookingStartTooEarly,
      endDate: bookingEndTooEarly,
      rentalType: 'self_drive'
    })).rejects.toThrow('Mobil tidak tersedia pada rentang tanggal tersebut.')

    // Case B: Booking starting exactly 3 hours after maintenance (15:00 UTC) -> HARUS DITERIMA
    const bookingStartExactBuffer = new Date(tomorrow12.getTime() + TURNOVER_BUFFER_MS) // 15:00
    const bookingEndExactBuffer = new Date(bookingStartExactBuffer.getTime() + 24 * 60 * 60 * 1000)

    const isAvailableExact = await checkVehicleAvailability(vehicle1Id, bookingStartExactBuffer, bookingEndExactBuffer)
    expect(isAvailableExact).toBe(true)

    const booking = await createDraftBookingCore({
      customerId,
      vehicleId: vehicle1Id,
      pickupBranchId: branch1Id,
      returnBranchId: branch1Id,
      startDate: bookingStartExactBuffer,
      endDate: bookingEndExactBuffer,
      rentalType: 'self_drive'
    })
    expect(booking.id).toBeDefined()
    expect(booking.status).toBe(BookingStatus.pending_payment)
  })

  test('2. Idempotensi & Partial Unique Index: Memperbarui maintenance yang aktif tidak membuat baris duplikat', async () => {
    const activeBefore = await prisma.vehicleUnavailability.findFirst({
      where: { vehicleId: vehicle1Id, actualEndAt: null }
    })
    expect(activeBefore).toBeDefined()
    const updatedEnd = new Date(activeBefore!.estimatedEndAt!.getTime() - 60 * 60 * 1000)
    
    // Call updateVehicleStatus with 'maintenance' again
    const res = await updateVehicleStatus(vehicle1Id, 'maintenance', {
      estimatedEndAt: updatedEnd,
      note: 'Estimasi diperpanjang karena menunggu suku cadang',
      actor: adminActor
    })
    expect(res.success).toBe(true)

    // Query active unavailabilities
    const activeUnavails = await prisma.vehicleUnavailability.findMany({
      where: { vehicleId: vehicle1Id, actualEndAt: null }
    })
    // Must remain exactly 1 active row
    expect(activeUnavails.length).toBe(1)
    expect(activeUnavails[0].note).toBe('Estimasi diperpanjang karena menunggu suku cadang')
  })

  test('3. Guard Unbounded "moved": Unit tidak dapat dimutasi jika ada pesanan terjadwal di masa depan', async () => {
    // vehicle1 currently has a pending_payment booking created in test 1
    const res = await updateVehicleStatus(vehicle1Id, 'moved', {
      note: 'Mencoba memindahkan unit yang punya jadwal sewa',
      actor: adminActor
    })
    expect(res.success).toBeFalsy()
    expect(res.error).toContain('Kendaraan memiliki jadwal pesanan aktif di masa depan')

    // Verify status vehicle1 is still maintenance
    const v = await prisma.vehicle.findUnique({ where: { id: vehicle1Id } })
    expect(v?.status).toBe('maintenance')
  })

  test('4. Relokasi Cabang: Transisi "moved" -> "available" memperbarui branchId secara atomik', async () => {
    // vehicle2 has no bookings
    const moveRes = await updateVehicleStatus(vehicle2Id, 'moved', {
      note: 'Mutasi unit ke cabang 2',
      actor: adminActor
    })
    expect(moveRes.success).toBe(true)

    let v2 = await prisma.vehicle.findUnique({
      where: { id: vehicle2Id },
      include: { unavailabilities: { where: { actualEndAt: null } } }
    })
    expect(v2?.status).toBe('moved')
    expect(v2?.unavailabilities.length).toBe(1)
    expect(v2?.unavailabilities[0].reason).toBe('moved')

    // Moved vehicle is strictly unavailable for booking
    const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000)
    const nextDay = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
    const availInMoved = await checkVehicleAvailability(vehicle2Id, tomorrow, nextDay)
    expect(availInMoved).toBe(false)

    // Arrive at Branch 2 -> Set to available with targetBranchId = branch2Id
    const availRes = await updateVehicleStatus(vehicle2Id, 'available', {
      targetBranchId: branch2Id,
      actor: adminActor
    })
    expect(availRes.success).toBe(true)

    v2 = await prisma.vehicle.findUnique({
      where: { id: vehicle2Id },
      include: { unavailabilities: { where: { actualEndAt: null } } }
    })
    expect(v2?.status).toBe('available')
    expect(v2?.branchId).toBe(branch2Id) // Branch relocated!
    expect(v2?.unavailabilities.length).toBe(0) // Active unavailability closed!
  })

  test('5. Deteksi Konflik Seketika Saat Perpanjangan: Booking tertabrak perpanjangan masuk ke conflict risk', async () => {
    // Create a confirmed future booking on vehicle2 (now available at branch2)
    const bookingStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days ahead
    const bookingEnd = new Date(bookingStart.getTime() + 2 * 24 * 60 * 60 * 1000) // 2 days duration

    const confirmedBooking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle2Id,
        pickupBranchId: branch2Id,
        returnBranchId: branch2Id,
        startDate: bookingStart,
        endDate: bookingEnd,
        rentalType: 'self_drive',
        totalPrice: 1600000,
        status: BookingStatus.confirmed,
      }
    })

    // Put vehicle2 into maintenance ending 2 days ahead (before the booking)
    const initialMaintEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    await updateVehicleStatus(vehicle2Id, 'maintenance', {
      estimatedEndAt: initialMaintEnd,
      note: 'Pengecekan rem berkala',
      actor: adminActor
    })

    // Initially, no conflict with confirmedBooking
    let conflict = await detectScheduleConflict(confirmedBooking.id)
    expect(conflict.hasConflict).toBe(false)

    // Now extend maintenance estimate so that it overlaps with confirmedBooking!
    const extendedMaintEnd = new Date(bookingStart.getTime() + 12 * 60 * 60 * 1000) // Extends into booking!
    const extendRes = await updateVehicleUnavailabilityEstimate(vehicle2Id, {
      estimatedEndAt: extendedMaintEnd,
      note: 'Part indent dari Jepang, estimasi molor',
      actor: adminActor
    })

    expect(extendRes.success).toBe(true)
    expect(extendRes.conflictWarning).toBe(true)
    expect(extendRes.conflictingBookings?.some((b: any) => b.id === confirmedBooking.id)).toBe(true)

    // Verify detectScheduleConflict now flags maintenance_risk
    conflict = await detectScheduleConflict(confirmedBooking.id)
    expect(conflict.hasConflict).toBe(true)
    expect(conflict.type).toBe('maintenance_risk')

    // Verify findConflictRiskBookingIds includes confirmedBooking
    const riskIds = await findConflictRiskBookingIds()
    expect(riskIds).toContain(confirmedBooking.id)
  })

  test('6. Defensive Fallback: Status maintenance/moved tanpa baris unavailability aktif ditolak', async () => {
    // Manually simulate an anomalous vehicle with status 'maintenance' but no active unavailability row
    const anomalousVehicle = await prisma.vehicle.create({
      data: {
        name: 'Anomalous Vehicle',
        plateNumber: 'TEST-ANOMALY-01',
        categoryId,
        branchId: branch1Id,
        dailyRate: 500000,
        status: 'maintenance',
        isActive: true,
      }
    })

    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    const nextFutureDate = new Date(futureDate.getTime() + 24 * 60 * 60 * 1000)

    const isAvailable = await checkVehicleAvailability(anomalousVehicle.id, futureDate, nextFutureDate)
    expect(isAvailable).toBe(false)

    // Clean up
    await prisma.vehicle.delete({ where: { id: anomalousVehicle.id } })
  })
})
