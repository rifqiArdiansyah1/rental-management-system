import { test, expect } from '@playwright/test'
import { PrismaClient, BookingStatus, UserRole, RentalType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createVehicle, updateVehicle, relocateVehicle, recordVehicleServiceAction } from '../../src/actions/adminVehicle'
import { startRental, endRental } from '../../src/actions/admin'
import { calculateVehicleServiceStatus } from '../../src/lib/vehicleService'

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

const supabaseAdmin = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

test.describe.configure({ mode: 'serial' })

test.describe('Pelacakan Odometer Armada & Preventive Maintenance (Non-Blocking & Multi-Role)', () => {
  const timestamp = Date.now()
  const testPrefix = `ODO_${timestamp}`

  let branchAId = ''
  let branchBId = ''
  let categoryId = ''
  let customerId = ''
  let adminPusatId = ''
  let adminCabangId = ''
  let staffCabangId = ''

  const pusatActor = () => ({ id: adminPusatId, role: 'admin_pusat' as UserRole, branchId: null })
  const cabangActor = (bId: string) => ({ id: adminCabangId, role: 'admin_cabang' as UserRole, branchId: bId })
  const staffActor = (bId: string) => ({ id: staffCabangId, role: 'staff_cabang' as UserRole, branchId: bId })

  test.beforeAll(async () => {
    // 1. Create Branches
    const branchA = await prisma.branch.create({
      data: {
        name: `Cabang A ${testPrefix}`,
        city: 'Surabaya',
        address: 'Jl. Pemuda No. 10',
        phone: '08111111111',
        isActive: true,
      }
    })
    branchAId = branchA.id

    const branchB = await prisma.branch.create({
      data: {
        name: `Cabang B ${testPrefix}`,
        city: 'Malang',
        address: 'Jl. Ijen No. 20',
        phone: '08222222222',
        isActive: true,
      }
    })
    branchBId = branchB.id

    // 2. Create Vehicle Category
    const category = await prisma.vehicleCategory.create({
      data: {
        name: `Category ${testPrefix}`,
        capacity: 7,
        transmission: 'Matic',
        features: ['AC', 'Audio'],
        imageUrl: null,
      }
    })
    categoryId = category.id

    // 3. Create Admin Users in DB
    const adminPusat = await prisma.user.create({
      data: {
        id: `pusat_${testPrefix.toLowerCase()}`,
        name: `Admin Pusat ${testPrefix}`,
        email: `pusat_${testPrefix.toLowerCase()}@test.com`,
        role: 'admin_pusat',
        isActive: true,
        branchId: null,
      }
    })
    adminPusatId = adminPusat.id

    const adminCabang = await prisma.user.create({
      data: {
        id: `cabang_${testPrefix.toLowerCase()}`,
        name: `Admin Cabang ${testPrefix}`,
        email: `cabang_${testPrefix.toLowerCase()}@test.com`,
        role: 'admin_cabang',
        isActive: true,
        branchId: branchAId,
      }
    })
    adminCabangId = adminCabang.id

    const staffCabang = await prisma.user.create({
      data: {
        id: `staff_${testPrefix.toLowerCase()}`,
        name: `Staff Cabang ${testPrefix}`,
        email: `staff_${testPrefix.toLowerCase()}@test.com`,
        role: 'staff_cabang',
        isActive: true,
        branchId: branchAId,
      }
    })
    staffCabangId = staffCabang.id

    // 4. Create Verified Customer
    const customer = await prisma.customer.create({
      data: {
        id: `cust_${testPrefix.toLowerCase()}`,
        name: `Customer ${testPrefix}`,
        email: `cust_${testPrefix.toLowerCase()}@test.com`,
        phone: '08999999999',
        verificationStatus: 'verified',
      }
    })
    customerId = customer.id
  })

  test.afterAll(async () => {
    // Cleanup
    await prisma.incidentReport.deleteMany({ where: { customerId } })
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [adminPusatId, adminCabangId, staffCabangId] } } })
    await prisma.payment.deleteMany({ where: { booking: { customerId } } })
    await prisma.booking.deleteMany({ where: { customerId } })
    await prisma.vehicleUnavailability.deleteMany({ where: { vehicle: { branchId: { in: [branchAId, branchBId] } } } })
    await prisma.vehicle.deleteMany({ where: { branchId: { in: [branchAId, branchBId] } } })
    await prisma.vehicleCategory.deleteMany({ where: { id: categoryId } })
    await prisma.user.deleteMany({ where: { id: { in: [adminPusatId, adminCabangId, staffCabangId] } } })
    await prisma.customer.deleteMany({ where: { id: customerId } })
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } })
    await pool.end()
  })

  test('1. Pengadaan armada baru/second: inisialisasi odometer dan validasi servis terakhir', async () => {
    // Validasi penolakan jika lastServiceOdometerKm > initialOdometerKm
    const invalidRes = await createVehicle({
      name: 'Innova Reborn Invalid',
      plateNumber: `L1000${testPrefix.slice(-3)}`,
      categoryId,
      branchId: branchAId,
      dailyRate: 600000,
      initialOdometerKm: 20000,
      lastServiceOdometerKm: 25000, // Error: servis melebihi KM fisik awal
      actor: pusatActor(),
    })
    expect(invalidRes.error).toContain('tidak boleh melebihi odometer awal')

    // Sukses create kendaraan dengan odometer terdefinisi
    const res = await createVehicle({
      name: 'Innova Reborn 2022',
      plateNumber: `L1111${testPrefix.slice(-3)}`,
      categoryId,
      branchId: branchAId,
      dailyRate: 600000,
      initialOdometerKm: 25000,
      lastServiceOdometerKm: 20000,
      serviceIntervalKm: 10000,
      actor: pusatActor(),
    })
    expect(res.success).toBe(true)
    expect(res.vehicle).toBeDefined()
    expect(res.vehicle?.currentOdometerKm).toBe(25000)
    expect(res.vehicle?.initialOdometerKm).toBe(25000)
    expect(res.vehicle?.lastServiceOdometerKm).toBe(20000)
    expect(res.vehicle?.serviceIntervalKm).toBe(10000)

    // Helper status servis
    const status = calculateVehicleServiceStatus(res.vehicle!)
    expect(status.status).toBe('healthy')
    expect(status.kmSinceLastService).toBe(5000)
    expect(status.kmUntilNextService).toBe(5000)
    expect(status.label).toContain('5.000 km')
  })

  test('2. Non-blocking startRental: typo staf dengan angka di bawah unit tetap meloloskan serah terima kunci', async () => {
    const vehicle = await prisma.vehicle.findFirst({
      where: { plateNumber: `L1111${testPrefix.slice(-3)}` }
    })
    expect(vehicle).toBeDefined()

    // Buat booking confirmed
    const startDate = new Date(Date.now() + 100000)
    const endDate = new Date(Date.now() + 86400000 + 100000)
    const booking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle!.id,
        pickupBranchId: branchAId,
        returnBranchId: branchAId,
        startDate,
        endDate,
        totalPrice: 600000,
        status: 'confirmed',
        rentalType: 'self_drive',
      }
    })

    // Staf input typo odometerStart = 24.500 km (mobil ada di 25.000 km)
    const startRes = await startRental(booking.id, { odometerStart: 24500, actor: cabangActor(branchAId) })
    if (startRes.error) console.error('startRes error:', startRes.error)
    expect(startRes.success).toBe(true)

    // Booking berstatus ongoing dan odometerStart tersimpan
    const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(updatedBooking?.status).toBe('ongoing')
    expect(updatedBooking?.odometerStart).toBe(24500)

    // Kendaraan menjadi rented dan kilometer armada tetap aman
    const updatedVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle!.id } })
    expect(updatedVehicle?.status).toBe('rented')
    expect(updatedVehicle?.currentOdometerKm).toBe(25000)

    // Audit log mencatat anomali start secara simetris dengan endRental
    const anomalyLog = await prisma.auditLog.findFirst({
      where: {
        entityId: vehicle!.id,
        action: 'vehicle.odometer_start_anomaly',
      }
    })
    expect(anomalyLog).toBeDefined()
    expect((anomalyLog?.metadata as any)?.odometerStart).toBe(24500)
    expect((anomalyLog?.metadata as any)?.currentVehicleOdometer).toBe(25000)
  })

  test('3. Non-blocking endRental: input odometer mundur tetap menyelesaikan sewa (skip update & audit)', async () => {
    const vehicle = await prisma.vehicle.findFirst({
      where: { plateNumber: `L1111${testPrefix.slice(-3)}` }
    })
    const booking = await prisma.booking.findFirst({
      where: { vehicleId: vehicle!.id, status: 'ongoing' }
    })
    expect(booking).toBeDefined()

    // Staf salah ketik odometerEnd = 24.000 km (di bawah unit 25.000 km)
    const endRes = await endRental(booking!.id, { odometerEnd: 24000, actor: cabangActor(branchAId) })
    expect(endRes.success).toBe(true)

    // Booking tetap sukses terselesaikan
    const completedBooking = await prisma.booking.findUnique({ where: { id: booking!.id } })
    expect(completedBooking?.status).toBe('completed')
    expect(completedBooking?.odometerEnd).toBe(24000)

    // Kendaraan kembali available & KM armada TIDAK mundur (Skip-and-Audit)
    const currentVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle!.id } })
    expect(currentVehicle?.status).toBe('available')
    expect(currentVehicle?.currentOdometerKm).toBe(25000) // Tetap 25.000 km!

    // Audit log mencatat anomali rollback
    const rollbackLog = await prisma.auditLog.findFirst({
      where: {
        entityId: vehicle!.id,
        action: 'vehicle.odometer_anomaly',
      }
    })
    expect(rollbackLog).toBeDefined()
    expect((rollbackLog?.metadata as any)?.odometerEnd).toBe(24000)
    expect((rollbackLog?.metadata as any)?.currentVehicleOdometer).toBe(25000)
  })

  test('4. Akumulasi normal sewa: odometer bertambah dan memperbarui Vehicle.currentOdometerKm', async () => {
    const vehicle = await prisma.vehicle.findFirst({
      where: { plateNumber: `L1111${testPrefix.slice(-3)}` }
    })

    // Sewa kedua
    const startDate = new Date(Date.now() + 200000000)
    const endDate = new Date(Date.now() + 286400000)
    const booking2 = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle!.id,
        pickupBranchId: branchAId,
        returnBranchId: branchAId,
        startDate,
        endDate,
        totalPrice: 600000,
        status: 'confirmed',
        rentalType: 'self_drive',
      }
    })

    await startRental(booking2.id, { odometerStart: 25000, actor: cabangActor(branchAId) })

    // Trip selesai menempuh 1.200 km -> odometerEnd = 26.200 km
    const endRes = await endRental(booking2.id, { odometerEnd: 26200, actor: cabangActor(branchAId) })
    expect(endRes.success).toBe(true)

    const updatedVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle!.id } })
    expect(updatedVehicle?.currentOdometerKm).toBe(26200)

    // Status servis: base 20.000, sekarang 26.200 -> sudah jalan 6.200 km, sisa 3.800 km
    const s = calculateVehicleServiceStatus(updatedVehicle!)
    expect(s.status).toBe('healthy')
    expect(s.kmSinceLastService).toBe(6200)
    expect(s.kmUntilNextService).toBe(3800)
  })

  test('5. Pemicu servis berkala (due/overdue) dan pencatatan servis (recordVehicleServiceAction)', async () => {
    const vehicle = await prisma.vehicle.findFirst({
      where: { plateNumber: `L1111${testPrefix.slice(-3)}` }
    })

    // Sewa ketiga menempuh jarak jauh -> odometerEnd = 30.500 km (lewat dari batas servis 10.000 km sejak 20.000)
    const startDate = new Date(Date.now() + 400000000)
    const endDate = new Date(Date.now() + 486400000)
    const booking3 = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle!.id,
        pickupBranchId: branchAId,
        returnBranchId: branchAId,
        startDate,
        endDate,
        totalPrice: 1200000,
        status: 'confirmed',
        rentalType: 'self_drive',
      }
    })

    await startRental(booking3.id, { odometerStart: 26200, actor: cabangActor(branchAId) })
    await endRental(booking3.id, { odometerEnd: 30500, actor: cabangActor(branchAId) })

    const updatedVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle!.id } })
    expect(updatedVehicle?.currentOdometerKm).toBe(30500)

    // Status servis terdeteksi overdue (jalan 10.500 km sejak servis terakhir di 20.000)
    const overdueStatus = calculateVehicleServiceStatus(updatedVehicle!)
    expect(overdueStatus.status).toBe('overdue')
    expect(overdueStatus.kmUntilNextService).toBe(-500)
    expect(overdueStatus.label).toContain('Lewat 500 km')

    // A. Percobaan catat servis oleh staf cabang lain (out of scope) -> Ditolak
    const outOfScopeRes = await recordVehicleServiceAction(vehicle!.id, {
      servicedAtKm: 30500,
      note: 'Staf cabang lain mencoba catat servis',
      actor: staffActor(branchBId),
    })
    expect(outOfScopeRes.error).toBeDefined()

    // B. Catat servis berkala selesai oleh staff_cabang armada (in scope) -> SUKSES
    const serviceRes = await recordVehicleServiceAction(vehicle!.id, {
      servicedAtKm: 30500,
      note: 'Ganti oli mesin & filter oli selesai di bengkel resmi',
      actor: staffActor(branchAId),
    })
    expect(serviceRes.success).toBe(true)

    const servicedVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle!.id } })
    expect(servicedVehicle?.lastServiceOdometerKm).toBe(30500)
    expect(servicedVehicle?.currentOdometerKm).toBe(30500)

    // Status servis kembali sehat
    const healthyStatus = calculateVehicleServiceStatus(servicedVehicle!)
    expect(healthyStatus.status).toBe('healthy')
    expect(healthyStatus.kmSinceLastService).toBe(0)
    expect(healthyStatus.kmUntilNextService).toBe(10000)
  })

  test('6. Kontinuitas mutasi armada (relocateVehicle): mewariskan data odometer & status servis secara utuh', async () => {
    const sourceVehicle = await prisma.vehicle.findFirst({
      where: { plateNumber: `L1111${testPrefix.slice(-3)}`, isActive: true }
    })
    expect(sourceVehicle).toBeDefined()

    const relocateRes = await relocateVehicle(sourceVehicle!.id, branchBId, {
      note: 'Mutasi armada ke Cabang Malang',
      actor: pusatActor(),
    })
    expect(relocateRes.success).toBe(true)
    expect(relocateRes.newVehicleId).toBeDefined()

    const newVehicle = await prisma.vehicle.findUnique({
      where: { id: relocateRes.newVehicleId! }
    })
    expect(newVehicle).toBeDefined()
    expect(newVehicle?.branchId).toBe(branchBId)
    expect(newVehicle?.initialOdometerKm).toBe(sourceVehicle?.initialOdometerKm)
    expect(newVehicle?.currentOdometerKm).toBe(sourceVehicle?.currentOdometerKm)
    expect(newVehicle?.lastServiceOdometerKm).toBe(sourceVehicle?.lastServiceOdometerKm)
    expect(newVehicle?.serviceIntervalKm).toBe(sourceVehicle?.serviceIntervalKm)
  })

  test('7. Guard role & batas bawah historis pada koreksi manual updateVehicle', async () => {
    const activeVehicle = await prisma.vehicle.findFirst({
      where: { plateNumber: `L1111${testPrefix.slice(-3)}`, isActive: true }
    })
    expect(activeVehicle).toBeDefined()
    // Di trip sebelumnya, odometerEnd tertinggi yang selesai adalah 30.500 km.

    // A. Percobaan koreksi odometer oleh admin_cabang -> DITOLAK
    const rejectCabang = await updateVehicle(activeVehicle!.id, {
      name: activeVehicle!.name,
      plateNumber: activeVehicle!.plateNumber,
      categoryId: activeVehicle!.categoryId,
      branchId: activeVehicle!.branchId,
      dailyRate: Number(activeVehicle!.dailyRate),
      currentOdometerKm: 32000,
      actor: cabangActor(branchBId),
    })
    expect(rejectCabang.error).toContain('Hanya Admin Pusat yang berwenang')

    // B. Percobaan koreksi oleh admin_pusat di bawah riwayat sewa tertinggi (30.500) -> DITOLAK
    const rejectLowerBound = await updateVehicle(activeVehicle!.id, {
      name: activeVehicle!.name,
      plateNumber: activeVehicle!.plateNumber,
      categoryId: activeVehicle!.categoryId,
      branchId: activeVehicle!.branchId,
      dailyRate: Number(activeVehicle!.dailyRate),
      currentOdometerKm: 28000, // Di bawah rekam jejak riil 30.500 km
      actor: pusatActor(),
    })
    expect(rejectLowerBound.error).toContain('tidak boleh disetel lebih rendah dari riwayat sewa tertinggi')

    // C. Koreksi valid oleh admin_pusat (misal kalibrasi ke 31.000 km) -> SUKSES
    const successPusat = await updateVehicle(activeVehicle!.id, {
      name: activeVehicle!.name,
      plateNumber: activeVehicle!.plateNumber,
      categoryId: activeVehicle!.categoryId,
      branchId: activeVehicle!.branchId,
      dailyRate: Number(activeVehicle!.dailyRate),
      currentOdometerKm: 31000,
      actor: pusatActor(),
    })
    expect(successPusat.success).toBe(true)

    const finalVehicle = await prisma.vehicle.findUnique({ where: { id: activeVehicle!.id } })
    expect(finalVehicle?.currentOdometerKm).toBe(31000)
    expect(finalVehicle?.lastServiceOdometerKm).toBe(30500) // Nilai servis terlindungi & tidak terpengaruh updateVehicle
  })
})
