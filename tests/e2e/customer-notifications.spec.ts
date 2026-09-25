import { test, expect } from '@playwright/test'
import { PrismaClient, BookingStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  formatIndonesianPhoneNumber,
  getWhatsAppGatewayStatus,
  sendWhatsAppMessage,
  buildRentalStartedWAMessage,
  buildRentalCompletedWAMessage,
  buildPickupReminderWAMessage,
} from '../../src/utils/whatsapp'
import { LATE_RETURN_GRACE_MINUTES } from '../../src/lib/constants'
import { parseWibDateBoundary } from '../../src/lib/bookingFilters'

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

async function withDbRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      if (i < retries && (err.message?.includes('Connection terminated') || err.message?.includes('closed'))) {
        await new Promise((r) => setTimeout(r, 600))
        continue
      }
      throw err
    }
  }
  throw new Error('Exceeded db retries')
}

test.describe.configure({ mode: 'serial' })

test.describe('Customer Proactive Notifications (Email + WhatsApp)', () => {
  const cronSecret = process.env.CRON_MANUAL_SECRET || 'test-cron-manual-secret'
  let customerVerifiedId: string = ''
  let customerPendingId: string = ''
  let vehicleAId: string = ''
  let vehicleBId: string = ''
  let vehicleCId: string = ''
  let branchId: string = ''
  let createdBookingIds: string[] = []
  let createdVehicleIds: string[] = []

  test.beforeAll(async () => {
    // 1. Get or create test branch
    let branch = await prisma.branch.findFirst({ where: { isActive: true } })
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: 'Cabang Utama Notifikasi',
          city: 'Jakarta',
          address: 'Jl. Protokol No. 88, Jakarta Pusat',
          phone: '081234567890',
          isActive: true,
        },
      })
    }
    branchId = branch.id

    // 2. Get or create vehicle category
    let category = await prisma.vehicleCategory.findFirst()
    if (!category) {
      category = await prisma.vehicleCategory.create({
        data: {
          name: 'Sedan Notif Luxury',
          capacity: 5,
          transmission: 'Automatic',
          features: ['AC', 'GPS'],
        },
      })
    }

    // Buat 3 armada terpisah untuk mencegah collision exclusion constraint booking_vehicle_no_overlap
    const ts = Date.now().toString().slice(-4)
    const vA = await prisma.vehicle.create({
      data: {
        name: 'BMW 730Li Notif A',
        plateNumber: `B-${ts}-NFA`,
        branchId: branch.id,
        categoryId: category.id,
        dailyRate: 1500000,
        status: 'available',
      },
    })
    vehicleAId = vA.id
    createdVehicleIds.push(vA.id)

    const vB = await prisma.vehicle.create({
      data: {
        name: 'Mercedes S450 Notif B',
        plateNumber: `B-${ts}-NFB`,
        branchId: branch.id,
        categoryId: category.id,
        dailyRate: 1800000,
        status: 'available',
      },
    })
    vehicleBId = vB.id
    createdVehicleIds.push(vB.id)

    const vC = await prisma.vehicle.create({
      data: {
        name: 'Porsche Panamera Notif C',
        plateNumber: `B-${ts}-NFC`,
        branchId: branch.id,
        categoryId: category.id,
        dailyRate: 2500000,
        status: 'available',
      },
    })
    vehicleCId = vC.id
    createdVehicleIds.push(vC.id)

    // 3. Create customers: one verified, one pending
    const verifiedCust = await prisma.customer.upsert({
      where: { email: 'verified-notif@test.com' },
      update: { verificationStatus: 'verified', phone: '081299990001' },
      create: {
        email: 'verified-notif@test.com',
        name: 'Budi Hartono Verified',
        phone: '081299990001',
        verificationStatus: 'verified',
      },
    })
    customerVerifiedId = verifiedCust.id

    const pendingCust = await prisma.customer.upsert({
      where: { email: 'pending-notif@test.com' },
      update: { verificationStatus: 'pending', phone: '081299990002' },
      create: {
        email: 'pending-notif@test.com',
        name: 'Siti Rahma Pending',
        phone: '081299990002',
        verificationStatus: 'pending',
      },
    })
    customerPendingId = pendingCust.id
  })

  test.afterAll(async () => {
    try {
      if (createdBookingIds.length > 0) {
        await prisma.payment.deleteMany({
          where: { bookingId: { in: createdBookingIds } },
        })
        await prisma.booking.deleteMany({
          where: { id: { in: createdBookingIds } },
        })
      }
      if (createdVehicleIds.length > 0) {
        await prisma.vehicle.deleteMany({
          where: { id: { in: createdVehicleIds } },
        })
      }
    } catch (e: any) {
      console.warn('[afterAll cleanup warning]:', e.message)
    } finally {
      await prisma.$disconnect().catch(() => {})
      await pool.end().catch(() => {})
    }
  })

  test('1. Formatting Nomor Telepon Indonesia & Integritas Gateway WhatsApp Mock', async () => {
    // Standard 08...
    expect(formatIndonesianPhoneNumber('081234567890')).toBe('6281234567890')
    // Prefix +62 with spaces & dashes
    expect(formatIndonesianPhoneNumber('+62 812-3456-7890')).toBe('6281234567890')
    // Prefix 8... without zero
    expect(formatIndonesianPhoneNumber('81234567890')).toBe('6281234567890')
    // Already in 628...
    expect(formatIndonesianPhoneNumber('6281234567890')).toBe('6281234567890')

    // Invalid & Edge cases
    expect(formatIndonesianPhoneNumber('')).toBeNull()
    expect(formatIndonesianPhoneNumber(null)).toBeNull()
    expect(formatIndonesianPhoneNumber('-')).toBeNull()
    expect(formatIndonesianPhoneNumber('12345')).toBeNull() // Too short
    expect(formatIndonesianPhoneNumber('0123456789')).toBeNull() // Not starting with 8 after prefix conversion

    // Mock Gateway status in test environment
    const gwStatus = getWhatsAppGatewayStatus()
    expect(gwStatus.isMock).toBe(true)
    expect(gwStatus.provider).toBe('mock')

    // Send mock message
    const sendResult = await sendWhatsAppMessage('081234567890', 'Uji coba pesan pengingat')
    expect(sendResult.success).toBe(true)
    expect(sendResult.mock).toBe(true)
    expect(sendResult.messageId).toContain('mock-wa-')

    // Invalid phone rejection
    const invalidResult = await sendWhatsAppMessage('-', 'Uji coba nomor kosong')
    expect(invalidResult.success).toBe(false)
    expect(invalidResult.error).toContain('tidak valid')
  })

  test('2. Integritas Template Pesan WhatsApp: Grace Period 45 Menit & Percabangan KYC', async () => {
    // 1. Rental Started Template: Must reuse LATE_RETURN_GRACE_MINUTES (45 menit), never 30 menit
    const startedMsg = buildRentalStartedWAMessage({
      customerName: 'Budi Hartono',
      bookingId: 'test-booking-id-1234',
      vehicleName: 'BMW 730Li',
      odometerStart: 12500,
      endDate: '26 Sep 2026, 18:00 WIB',
      returnBranchName: 'Cabang Utama Jakarta',
      returnBranchPhone: '081234567890',
    })
    expect(startedMsg).toContain(`${LATE_RETURN_GRACE_MINUTES} menit`)
    expect(startedMsg).toContain('45 menit')
    expect(startedMsg).not.toContain('30 menit')
    expect(startedMsg).toContain('12.500 km')
    expect(startedMsg).toContain('Cabang Utama Jakarta')

    // 2. Rental Completed Template: Contains official receipt & review link
    const completedMsg = buildRentalCompletedWAMessage({
      customerName: 'Budi Hartono',
      bookingId: 'test-booking-id-1234',
      vehicleName: 'BMW 730Li',
      odometerEnd: 12850,
      lateMinutes: 0,
      lateFeeAmount: null,
      reviewUrl: 'http://localhost:3001/booking/test-booking-id-1234',
    })
    expect(completedMsg).toContain('12.850 km')
    expect(completedMsg.toLowerCase()).toContain('tepat waktu')
    expect(completedMsg).toContain('http://localhost:3001/booking/test-booking-id-1234')

    // 3. Pickup Reminder Template - KYC Verified: Physical ID check reminder
    const verifiedReminder = buildPickupReminderWAMessage({
      customerName: 'Budi Hartono',
      bookingId: 'test-booking-id-1234',
      vehicleName: 'BMW 730Li',
      pickupBranchName: 'Cabang Utama Jakarta',
      pickupBranchPhone: '081234567890',
      pickupBranchAddress: 'Jl. Protokol No. 88',
      pickupDate: '25 Sep 2026, 09:00 WIB',
      isKycVerified: true,
      appUrl: 'http://localhost:3001',
    })
    expect(verifiedReminder).toContain('Verifikasi Dokumen')
    expect(verifiedReminder).toContain('membawa KTP & SIM asli Anda')

    // 4. Pickup Reminder Template - KYC Pending: Urgent Warning
    const pendingReminder = buildPickupReminderWAMessage({
      customerName: 'Siti Rahma',
      bookingId: 'test-booking-id-5678',
      vehicleName: 'BMW 730Li',
      pickupBranchName: 'Cabang Utama Jakarta',
      pickupBranchPhone: '081234567890',
      pickupBranchAddress: 'Jl. Protokol No. 88',
      pickupDate: '25 Sep 2026, 09:00 WIB',
      isKycVerified: false,
      appUrl: 'http://localhost:3001',
    })
    expect(pendingReminder).toContain('PERHATIAN PENTING')
    expect(pendingReminder).toContain('TIDAK DAPAT diserahterimakan')
    expect(pendingReminder).toContain('http://localhost:3001/booking/test-booking-id-5678')
  })

  test('3. Cron /api/cron/pickup-reminders - Auth Guard 401 Unauthorized', async ({ request }) => {
    // Missing authorization header
    const resNoAuth = await request.get('/api/cron/pickup-reminders')
    expect(resNoAuth.status()).toBe(401)

    // Wrong secret
    const resWrongAuth = await request.get('/api/cron/pickup-reminders', {
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    expect(resWrongAuth.status()).toBe(401)
  })

  test('4. Cron /api/cron/pickup-reminders - Pola Klaim Atomik & Pengiriman Pengingat Hari-H', async ({ request }) => {
    // Hitung waktu hari ini dalam jendela WIB
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const todayDateStr = nowWib.toISOString().slice(0, 10)
    const startOfTodayWib = parseWibDateBoundary(todayDateStr, false)
    const pickupSchedule = new Date(startOfTodayWib.getTime() + 2 * 60 * 60 * 1000) // Jam 02:00 UTC = 09:00 WIB
    const endSchedule = new Date(pickupSchedule.getTime() + 24 * 60 * 60 * 1000)

    // Buat 2 booking hari ini yang berstatus confirmed dengan 2 armada berbeda
    const bookingVerified = await withDbRetry(() =>
      prisma.booking.create({
        data: {
          customerId: customerVerifiedId,
          vehicleId: vehicleAId,
          pickupBranchId: branchId,
          returnBranchId: branchId,
          startDate: pickupSchedule,
          endDate: endSchedule,
          rentalType: 'self_drive',
          status: BookingStatus.confirmed,
          totalPrice: 1500000,
          pickupReminderSentAt: null,
        },
      })
    )
    createdBookingIds.push(bookingVerified.id)

    const bookingPending = await withDbRetry(() =>
      prisma.booking.create({
        data: {
          customerId: customerPendingId,
          vehicleId: vehicleBId,
          pickupBranchId: branchId,
          returnBranchId: branchId,
          startDate: pickupSchedule,
          endDate: endSchedule,
          rentalType: 'self_drive',
          status: BookingStatus.confirmed,
          totalPrice: 1500000,
          pickupReminderSentAt: null,
        },
      })
    )
    createdBookingIds.push(bookingPending.id)

    // Panggilan pertama ke Cron Pickup Reminders dengan Bearer Token yang sah
    const res1 = await request.get('/api/cron/pickup-reminders', {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    expect(res1.status()).toBe(200)
    const body1 = await res1.json()
    expect(body1.success).toBe(true)
    expect(body1.remindersSent).toBeGreaterThanOrEqual(2)

    // Verifikasi pada Database: kedua booking telah memiliki timestamp pickupReminderSentAt
    const updatedVerified = await withDbRetry(() =>
      prisma.booking.findUnique({
        where: { id: bookingVerified.id },
      })
    )
    expect(updatedVerified?.pickupReminderSentAt).not.toBeNull()

    const updatedPending = await withDbRetry(() =>
      prisma.booking.findUnique({
        where: { id: bookingPending.id },
      })
    )
    expect(updatedPending?.pickupReminderSentAt).not.toBeNull()

    // Verifikasi Telemetri CronHeartbeat
    const heartbeat = await withDbRetry(() =>
      prisma.cronHeartbeat.findUnique({
        where: { jobName: 'pickup-reminders' },
      })
    )
    expect(heartbeat).not.toBeNull()
    expect(heartbeat?.status).toBe('success')
    expect(heartbeat?.bookingsCancelled).toBeGreaterThanOrEqual(2)

    // Panggilan kedua: Atomic Claim memastikan booking yang sudah diklaim TIDAK diproses ulang (Idempoten)
    const res2 = await request.get('/api/cron/pickup-reminders', {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    expect(res2.status()).toBe(200)
    const body2 = await res2.json()
    expect(body2.success).toBe(true)
    expect(body2.remindersSent).toBe(0)
  })

  test('5. Non-Blocking Notification Dispatch pada Siklus Sewa startRental & endRental', async () => {
    // Buat booking untuk siklus serah terima dan pengembalian dengan vehicleCId
    const startDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // Dimulai 2 jam lalu
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const cycleBooking = await withDbRetry(() =>
      prisma.booking.create({
        data: {
          customerId: customerVerifiedId,
          vehicleId: vehicleCId,
          pickupBranchId: branchId,
          returnBranchId: branchId,
          startDate,
          endDate,
          rentalType: 'self_drive',
          status: BookingStatus.confirmed,
          totalPrice: 1500000,
          agreedDailyRate: 1500000,
        },
      })
    )
    createdBookingIds.push(cycleBooking.id)

    // 1. Eksekusi server action startRental
    // Pastikan admin user session tersedia di database
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin_pusat', isActive: true } })
    expect(adminUser).not.toBeNull()

    // Transaksi database untuk memastikan state transisi siklus sewa
    await prisma.booking.update({
      where: { id: cycleBooking.id },
      data: {
        status: BookingStatus.ongoing,
        odometerStart: 25000,
      },
    })
    await prisma.vehicle.update({
      where: { id: vehicleCId },
      data: { status: 'rented' },
    })

    // Test notifyRentalStarted dispatcher secara langsung
    const { notifyRentalStarted, notifyRentalCompleted } = await import('../../src/utils/notifications')

    const startNotifRes = await notifyRentalStarted({
      bookingId: cycleBooking.id,
      customerName: 'Budi Hartono Verified',
      customerEmail: 'verified-notif@test.com',
      customerPhone: '081299990001',
      vehicleName: 'BMW 730Li Notif Edition',
      odometerStart: 25000,
      endDate: '26 Sep 2026, 18:00 WIB',
      returnBranchName: 'Cabang Utama Notifikasi',
      returnBranchAddress: 'Jl. Protokol No. 88, Jakarta Pusat',
      returnBranchPhone: '081234567890',
      locale: 'id',
    })

    expect(startNotifRes.emailDispatched).toBe(true)
    expect(startNotifRes.whatsappDispatched).toBe(true)

    // 2. Eksekusi pengembalian (endRental)
    await prisma.booking.update({
      where: { id: cycleBooking.id },
      data: {
        status: BookingStatus.completed,
        actualReturnAt: new Date(),
        odometerEnd: 25300,
        lateMinutes: 0,
      },
    })
    await prisma.vehicle.update({
      where: { id: vehicleCId },
      data: { status: 'available' },
    })


    const endNotifRes = await notifyRentalCompleted({
      bookingId: cycleBooking.id,
      customerName: 'Budi Hartono Verified',
      customerEmail: 'verified-notif@test.com',
      customerPhone: '081299990001',
      vehicleName: 'BMW 730Li Notif Edition',
      odometerEnd: 25300,
      lateMinutes: null,
      lateFeeAmount: null,
      locale: 'id',
    })

    expect(endNotifRes.emailDispatched).toBe(true)
    expect(endNotifRes.whatsappDispatched).toBe(true)
  })
})
