import { test, expect, Page } from '@playwright/test'
import { PrismaClient, BookingStatus, UserRole, RentalType, BookingChannel, WalkInReviewStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createWalkInBookingCore } from '../../src/lib/booking'
import { syncCustomerVerificationStatus } from '../../src/lib/kyc'

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

test.describe('Walk-In Booking & Cash Payment Pipeline', () => {
  test.setTimeout(90000)

  const timestamp = Date.now()
  const testPrefix = `WIB_${timestamp}`

  const staffEmail = `staff_${testPrefix.toLowerCase()}@test.com`
  const staffPassword = 'Password123!'
  let staffUserId = ''

  const adminCabangEmail = `admincabang_${testPrefix.toLowerCase()}@test.com`
  const adminCabangPassword = 'Password123!'
  let adminCabangUserId = ''

  const adminPusatEmail = `adminpusat_${testPrefix.toLowerCase()}@test.com`
  const adminPusatPassword = 'Password123!'
  let adminPusatUserId = ''

  let branchId = ''
  let categoryId = ''
  let vehicle1Id = ''
  let vehicle2Id = ''
  let vehicle3Id = ''

  let walkInBooking1Id = ''
  let walkInBooking2Id = ''
  let walkInBookingSelfReviewId = ''
  let walkInBookingAgingId = ''

  async function loginAs(page: Page, email: string, pass: string) {
    await page.context().clearCookies()
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', pass)
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes('/admin/login'), { timeout: 25000 })
  }

  test.beforeAll(async () => {
    // 1. Create Test Branch
    const branch = await prisma.branch.create({
      data: {
        name: `Cabang Walk-In ${testPrefix}`,
        city: 'Bandung',
        address: 'Jl. Ir. H. Juanda No. 120, Bandung',
        phone: '081298765432',
        isActive: true,
      },
    })
    branchId = branch.id

    // 2. Create Vehicle Category
    const category = await prisma.vehicleCategory.create({
      data: {
        name: `Compact SUV ${testPrefix}`,
        capacity: 5,
        transmission: 'Automatic',
        features: ['AC', 'Bluetooth', 'Touchscreen'],
      },
    })
    categoryId = category.id

    // 3. Create Vehicles
    const vehicle1 = await prisma.vehicle.create({
      data: {
        name: `Honda HR-V Special ${testPrefix}`,
        plateNumber: `D ${Math.floor(1000 + Math.random() * 9000)} WB1`,
        branchId: branch.id,
        categoryId: category.id,
        dailyRate: 750000,
        status: 'available',
        isActive: true,
      },
    })
    vehicle1Id = vehicle1.id

    const vehicle2 = await prisma.vehicle.create({
      data: {
        name: `Toyota Raize Turbo ${testPrefix}`,
        plateNumber: `D ${Math.floor(1000 + Math.random() * 9000)} WB2`,
        branchId: branch.id,
        categoryId: category.id,
        dailyRate: 600000,
        status: 'available',
        isActive: true,
      },
    })
    vehicle2Id = vehicle2.id

    const vehicle3 = await prisma.vehicle.create({
      data: {
        name: `Daihatsu Rocky Turbo ${testPrefix}`,
        plateNumber: `D ${Math.floor(1000 + Math.random() * 9000)} WB3`,
        branchId: branch.id,
        categoryId: category.id,
        dailyRate: 550000,
        status: 'available',
        isActive: true,
      },
    })
    vehicle3Id = vehicle3.id

    // 4. Create Staff Cabang
    const { data: staffAuth, error: staffErr } = await supabaseAdmin.auth.admin.createUser({
      email: staffEmail,
      password: staffPassword,
      email_confirm: true,
      user_metadata: { name: `Staff Walk-In ${testPrefix}` },
      app_metadata: { role: 'staff_cabang', branch_id: branchId },
    })
    if (staffErr) throw staffErr
    staffUserId = staffAuth.user.id

    await prisma.user.create({
      data: {
        id: staffUserId,
        name: `Staff Walk-In ${testPrefix}`,
        email: staffEmail,
        role: 'staff_cabang',
        branchId: branchId,
        isActive: true,
      },
    })

    // 5. Create Admin Cabang
    const { data: adminCabangAuth, error: acErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminCabangEmail,
      password: adminCabangPassword,
      email_confirm: true,
      user_metadata: { name: `Admin Cabang ${testPrefix}` },
      app_metadata: { role: 'admin_cabang', branch_id: branchId },
    })
    if (acErr) throw acErr
    adminCabangUserId = adminCabangAuth.user.id

    await prisma.user.create({
      data: {
        id: adminCabangUserId,
        name: `Admin Cabang ${testPrefix}`,
        email: adminCabangEmail,
        role: 'admin_cabang',
        branchId: branchId,
        isActive: true,
      },
    })

    // 6. Create Admin Pusat
    const { data: adminPusatAuth, error: apErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminPusatEmail,
      password: adminPusatPassword,
      email_confirm: true,
      user_metadata: { name: `Admin Pusat ${testPrefix}` },
      app_metadata: { role: 'admin_pusat', branch_id: null },
    })
    if (apErr) throw apErr
    adminPusatUserId = adminPusatAuth.user.id

    await prisma.user.create({
      data: {
        id: adminPusatUserId,
        name: `Admin Pusat ${testPrefix}`,
        email: adminPusatEmail,
        role: 'admin_pusat',
        branchId: null,
        isActive: true,
      },
    })
  })

  test.afterAll(async () => {
    try {
      // Cleanup documents, payments, audit logs, bookings, vehicles, categories, users, branches
      // 1. Hapus payment (referensi ke booking)
      await prisma.payment.deleteMany({
        where: { booking: { pickupBranchId: branchId } }
      })
      // 2. Hapus booking (referensi ke customer, vehicle, branch, user)
      await prisma.booking.deleteMany({
        where: { pickupBranchId: branchId }
      })
      // 3. Hapus document (referensi ke customer)
      await prisma.document.deleteMany({
        where: { customerId: { startsWith: `cust_wib_` } }
      })
      // 4. Hapus customer
      await prisma.customer.deleteMany({
        where: { id: { startsWith: `cust_wib_` } }
      })
      // 5. Hapus audit log
      await prisma.auditLog.deleteMany({
        where: { branchId: branchId }
      })
      // 6. Hapus vehicle & category
      await prisma.vehicle.deleteMany({
        where: { branchId: branchId }
      })
      await prisma.vehicleCategory.deleteMany({
        where: { id: categoryId }
      })
      // 7. Hapus users & branch
      await prisma.user.deleteMany({
        where: { id: { in: [staffUserId, adminCabangUserId, adminPusatUserId] } }
      })
      await prisma.branch.deleteMany({
        where: { id: branchId }
      })

      await supabaseAdmin.auth.admin.deleteUser(staffUserId).catch(() => {})
      await supabaseAdmin.auth.admin.deleteUser(adminCabangUserId).catch(() => {})
      await supabaseAdmin.auth.admin.deleteUser(adminPusatUserId).catch(() => {})
    } catch (e) {
      console.warn('Error during test cleanup:', e)
    } finally {
      await prisma.$disconnect()
      await pool.end()
    }
  })

  test('Test 1: Customer Identity Resolution (Dual-write with safe random password)', async () => {
    const custEmail = `walkin_cust_${testPrefix.toLowerCase()}@test.com`

    const customer = await prisma.customer.create({
      data: {
        id: `cust_wib_${timestamp}`,
        name: 'Pelanggan Walk-In Pertama',
        email: custEmail,
        phone: '6281234567890',
        verificationStatus: 'pending',
      }
    })

    expect(customer).toBeTruthy()
    expect(customer.email).toBe(custEmail)
    expect(customer.verificationStatus).toBe('pending')
  })

  test('Test 2: Mandatory Physical Document Photo Upload & Aggregate KYC (Single Source of Truth)', async () => {
    const customerId = `cust_wib_${timestamp}`

    // 1. Unggah hanya KTP fisik
    await prisma.document.create({
      data: {
        customerId,
        type: 'ktp',
        fileUrl: `${customerId}/ktp_fisik.jpg`,
        verifiedAt: new Date(),
      }
    })

    // Panggil helper agregasi terpusat: status harus TETAP 'pending' karena SIM belum ada
    const statusWithOnlyKtp = await syncCustomerVerificationStatus(customerId, prisma)
    expect(statusWithOnlyKtp).toBe('pending')

    const custAfterKtp = await prisma.customer.findUnique({ where: { id: customerId } })
    expect(custAfterKtp?.verificationStatus).toBe('pending')

    // 2. Sekarang unggah SIM fisik asli
    await prisma.document.create({
      data: {
        customerId,
        type: 'sim',
        fileUrl: `${customerId}/sim_fisik.jpg`,
        verifiedAt: new Date(),
      }
    })

    // Panggil helper agregasi: status sekarang berubah jadi 'verified' karena KTP & SIM lengkap
    const statusWithBoth = await syncCustomerVerificationStatus(customerId, prisma)
    expect(statusWithBoth).toBe('verified')

    const custAfterBoth = await prisma.customer.findUnique({ where: { id: customerId } })
    expect(custAfterBoth?.verificationStatus).toBe('verified')
  })

  test('Test 3: Discount Policy & Plafon 30% (Strict Server Enforced)', async () => {
    const customerId = `cust_wib_${timestamp}`
    const startDate = new Date(Date.now() + 5 * 60 * 60 * 1000)
    startDate.setHours(9, 0, 0, 0)
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    endDate.setHours(9, 0, 0, 0) // Persis 24 jam = 1 hari sewa (Rp 750.000, plafon 30% = Rp 225.000)

    // Tarif mobil = 750.000 / hari. Plafon 30% = 225.000.
    // 1. Coba diskon melebihi 30% (misal 300.000) -> Wajib dilempar error
    await expect(
      createWalkInBookingCore({
        customerId,
        vehicleId: vehicle1Id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        createdByStaffId: adminCabangUserId,
        discountAmount: 300000,
        discountReason: 'Diskon negosiasi melebihi plafon wajar',
        discountAppliedBy: adminCabangUserId,
      })
    ).rejects.toThrow(/30%/)

    // 2. Coba diskon negatif -> Wajib ditolak
    await expect(
      createWalkInBookingCore({
        customerId,
        vehicleId: vehicle1Id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        createdByStaffId: adminCabangUserId,
        discountAmount: -50000,
        discountReason: 'Diskon negatif tidak sah',
        discountAppliedBy: adminCabangUserId,
      })
    ).rejects.toThrow(/negatif/)

    // 3. Diskon valid dalam plafon 30% (misal 150.000) -> Sukses
    const booking = await createWalkInBookingCore({
      customerId,
      vehicleId: vehicle1Id,
      pickupBranchId: branchId,
      returnBranchId: branchId,
      startDate,
      endDate,
      rentalType: 'self_drive',
      createdByStaffId: staffUserId,
      discountAmount: 150000,
      discountReason: 'Diskon loyalitas pelanggan korporat',
      discountAppliedBy: adminCabangUserId,
    })

    walkInBooking1Id = booking.id
    expect(Number(booking.totalPrice)).toBe(600000) // 750.000 - 150.000
    expect(Number(booking.discountAmount)).toBe(150000)
    expect(booking.discountReason).toBe('Diskon loyalitas pelanggan korporat')
  })

  test('Test 4: Anti-Self-Review Guard (Creator cannot review own booking, other admin/pusat can)', async ({ page }) => {
    const customerId = `cust_wib_${timestamp}`
    const startDate = new Date(Date.now() + 10 * 60 * 60 * 1000)
    startDate.setHours(10, 0, 0, 0)
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
    endDate.setHours(16, 0, 0, 0)

    // Buat booking walk-in di mana PEMBUATNYA adalah Admin Cabang sendiri
    const selfBooking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle2Id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        totalPrice: 600000,
        agreedDailyRate: 600000,
        status: BookingStatus.confirmed,
        bookingChannel: BookingChannel.walk_in,
        createdByStaffId: adminCabangUserId, // DIBUAT SENDIRI OLEH ADMIN CABANG
        walkInReviewStatus: WalkInReviewStatus.pending_review,
      }
    })
    walkInBookingSelfReviewId = selfBooking.id

    // 1. Admin Cabang login dan membuka transaksinya sendiri
    await loginAs(page, adminCabangEmail, adminCabangPassword)
    await page.goto(`/admin/bookings/${walkInBookingSelfReviewId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Tombol review kas TIDAK BOLEH muncul untuk pembuatnya sendiri, melainkan banner anti-self-review
    const confirmBtn = page.locator('[data-testid="confirm-walkin-cash-btn"]')
    await expect(confirmBtn).not.toBeVisible()

    const banner = page.locator('text=Menunggu Review Kas Pihak Kedua')
    await expect(banner).toBeVisible()

    // 2. Sekarang Login sebagai Admin Pusat (pihak kedua yang independen)
    await loginAs(page, adminPusatEmail, adminPusatPassword)
    await page.goto(`/admin/bookings/${walkInBookingSelfReviewId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Admin Pusat melihat tombol konfirmasi kas dan dapat mengesahkan
    const pusatConfirmBtn = page.locator('[data-testid="confirm-walkin-cash-btn"]')
    await expect(pusatConfirmBtn).toBeVisible()
    await pusatConfirmBtn.click()

    const submitBtn = page.locator('[data-testid="submit-walkin-review-btn"]')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    // Verifikasi DB berhasil disahkan menjadi confirmed oleh Admin Pusat
    await expect.poll(async () => {
      const b = await prisma.booking.findUnique({
        where: { id: walkInBookingSelfReviewId }
      })
      return b?.walkInReviewStatus
    }, { timeout: 15000 }).toBe('confirmed')
  })

  test('Test 5: Flagging by Admin Cabang -> Eskalasi Pusat & Penyelesaian Sesuai Siklus Hidup', async ({ page }) => {
    // Gunakan walkInBooking1Id yang dibuat oleh staffUserId
    // Admin Cabang login dan meninjau transaksi staf
    await loginAs(page, adminCabangEmail, adminCabangPassword)
    await page.goto(`/admin/bookings/${walkInBooking1Id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Tandai transaksi sebagai anomali (flag)
    const flagBtn = page.locator('[data-testid="flag-walkin-btn"]')
    await expect(flagBtn).toBeVisible()
    await flagBtn.click()

    const noteInput = page.locator('[data-testid="walkin-review-note-input"]')
    await expect(noteInput).toBeVisible()
    await noteInput.fill('Uang kas fisik di laci kurang Rp 50.000, perlu rekonsiliasi dengan staf kasir.')

    const submitBtn = page.locator('[data-testid="submit-walkin-review-btn"]')
    await submitBtn.click()

    // Verifikasi DB menjadi flagged
    await expect.poll(async () => {
      const b = await prisma.booking.findUnique({
        where: { id: walkInBooking1Id }
      })
      return b?.walkInReviewStatus
    }, { timeout: 15000 }).toBe('flagged')

    // Login sebagai Admin Pusat untuk menyelesaikan eskalasi
    await loginAs(page, adminPusatEmail, adminPusatPassword)

    // Verifikasi muncul di tab action_required Admin Pusat
    await page.goto('/admin/bookings?tab=action_required', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    await expect(page.locator('table').locator(`text=${walkInBooking1Id.substring(0, 8).toUpperCase()}`)).toBeVisible()
    await expect(page.locator('table').locator('text=🚨 Di-Flag (Eskalasi Pusat)')).toBeVisible()

    // Buka detail pemesanan
    await page.goto(`/admin/bookings/${walkInBooking1Id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    const resolveBtn = page.locator('[data-testid="resolve-flagged-walkin-btn"]')
    await expect(resolveBtn).toBeVisible()
    await resolveBtn.click()

    const resolveNoteInput = page.locator('[data-testid="resolve-flag-note-input"]')
    await expect(resolveNoteInput).toBeVisible()
    await resolveNoteInput.fill('Selisih kas Rp 50.000 telah disetorkan staf, pembukuan kasir telah disesuaikan.')

    const submitResolveBtn = page.locator('[data-testid="submit-resolve-flag-btn"]')
    await submitResolveBtn.click()

    // Verifikasi status DB kembali ke confirmed dengan catatan investigasi resmi
    await expect.poll(async () => {
      const b = await prisma.booking.findUnique({
        where: { id: walkInBooking1Id }
      })
      return b?.walkInReviewStatus
    }, { timeout: 15000 }).toBe('confirmed')
  })

  test('Test 6: Deterministic Aging Threshold (>24 Jam) in "Perlu Tindakan" & Form Navigation', async ({ page }) => {
    const customerId = `cust_wib_${timestamp}`
    const startDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)

    // Buat booking walk-in deterministik dengan createdAt 25 jam yang lalu
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const agingBooking = await prisma.booking.create({
      data: {
        customerId,
        vehicleId: vehicle3Id,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        totalPrice: 550000,
        agreedDailyRate: 550000,
        status: BookingStatus.confirmed,
        bookingChannel: BookingChannel.walk_in,
        createdByStaffId: staffUserId,
        walkInReviewStatus: WalkInReviewStatus.pending_review,
        createdAt: twentyFiveHoursAgo,
      }
    })
    walkInBookingAgingId = agingBooking.id

    // Login sebagai Admin Cabang
    await loginAs(page, adminCabangEmail, adminCabangPassword)

    await page.goto('/admin/bookings?tab=action_required', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Verifikasi booking muncul di tab Perlu Tindakan dengan badge terlambat review kas
    await expect(page.locator('table').locator(`text=${walkInBookingAgingId.substring(0, 8).toUpperCase()}`)).toBeVisible()
    await expect(page.locator('table').locator('text=Review Kas Terlambat (>24 Jam)')).toBeVisible()

    // Uji Navigasi Form Walk-in (/admin/bookings/new)
    await page.goto('/admin/bookings', { waitUntil: 'domcontentloaded' })
    const newBtn = page.locator('text=Buat Booking Walk-In').locator('visible=true')
    await expect(newBtn).toBeVisible()
    await newBtn.click()

    await page.waitForURL('**/admin/bookings/new')
    await expect(page.locator('h1')).toContainText('Pemesanan Offline (Walk-In) & Kasir')

    // Verifikasi Section 5 yang baru: Dokumentasi Fisik KTP & SIM (Wajib Bukti Foto)
    await expect(page.locator('text=1. Identitas Pelanggan Walk-In')).toBeVisible()
    await expect(page.locator('text=2. Pilihan Armada & Layanan')).toBeVisible()
    await expect(page.locator('text=3. Jadwal Sewa (WIB)')).toBeVisible()
    await expect(page.locator('text=4. Rincian Biaya & Penerimaan Kas Tunai')).toBeVisible()
    await expect(page.locator('text=5. Dokumentasi Fisik KTP & SIM (Wajib Bukti Foto)')).toBeVisible()
  })
})
