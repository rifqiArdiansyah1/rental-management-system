import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

test.describe('Self-Service Cancellation & Instant Lock Release', () => {
  const vehicleId = 'vehicle-payment-cancel';

  test.afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  test('should allow customer to self-cancel an unpaid booking and release vehicle slot immediately', async ({ page }) => {
    // 1. Login as Customer 1
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer1@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 2. Select dates 30 days in future to avoid collision with any existing test data
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 31);

    const startStr = startDate.toISOString().split('T')[0] + 'T10:00';
    const endStr = endDate.toISOString().split('T')[0] + 'T10:00';

    // Clean up any stray bookings on vehicle for those dates beforehand
    await prisma.payment.deleteMany({
      where: {
        booking: {
          vehicleId,
          startDate: { gte: new Date(startDate.toISOString().split('T')[0] + 'T00:00:00Z') },
          endDate: { lte: new Date(endDate.toISOString().split('T')[0] + 'T23:59:59Z') },
        }
      }
    });
    await prisma.booking.deleteMany({
      where: {
        vehicleId,
        startDate: { gte: new Date(startDate.toISOString().split('T')[0] + 'T00:00:00Z') },
        endDate: { lte: new Date(endDate.toISOString().split('T')[0] + 'T23:59:59Z') },
      }
    });

    // 3. Make reservation
    await page.goto(`/vehicles/${vehicleId}/book`);
    const dateInputs = await page.locator('input[type="datetime-local"]').all();
    await dateInputs[0].fill(startStr);
    await dateInputs[1].fill(endStr);

    await page.locator('text=Price Breakdown').or(page.locator('text=Ringkasan Biaya')).first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /Confirm Booking|Lanjutkan ke Pembayaran|Proceed to Payment/i }).click();

    // 4. Redirects to checkout
    await page.waitForURL(/\/booking\/.*/);
    const bookingUrl = page.url();
    const bookingId = bookingUrl.split('/').pop() as string;

    await expect(page.locator('text=PENDING PAYMENT').first()).toBeVisible();

    // 5. Verify Self-Cancel button is discoverable and clickable
    const cancelBtn = page.locator('[data-testid="self-cancel-btn"]');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // 6. Modal confirmation opens
    await expect(page.locator('text=Batalkan Pemesanan?').or(page.locator('text=Cancel Reservation?'))).toBeVisible();

    // 7. Click confirm cancel
    const confirmCancelBtn = page.locator('[data-testid="confirm-self-cancel-btn"]');
    await expect(confirmCancelBtn).toBeVisible();
    await confirmCancelBtn.click();

    // 8. Page updates to Cancelled State
    const cancelledCard = page.locator('[data-testid="cancelled-booking-card"]');
    await expect(cancelledCard).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=CANCELLED').first()).toBeVisible();
    await expect(page.locator('[data-testid="explore-other-vehicles-btn"]')).toBeVisible();

    // 9. Verify in database: status is cancelled, note is filled, cancelledBy is null (customer initiative)
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });
    expect(updatedBooking).not.toBeNull();
    expect(updatedBooking?.status).toBe('cancelled');
    expect(updatedBooking?.cancellationNote).toContain('Dibatalkan oleh pelanggan');
    expect(updatedBooking?.cancelledBy).toBeNull();

    // 10. Instant Lock Release: Verify that the vehicle is IMMEDIATELY available for the exact same schedule
    await page.goto(`/vehicles/${vehicleId}/book`);
    const dateInputsRetry = await page.locator('input[type="datetime-local"]').all();
    await dateInputsRetry[0].fill(startStr);
    await dateInputsRetry[1].fill(endStr);

    await page.locator('text=Price Breakdown').or(page.locator('text=Ringkasan Biaya')).first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /Confirm Booking|Lanjutkan ke Pembayaran|Proceed to Payment/i }).click();

    // Successfully creates a new booking without overlap error!
    await page.waitForURL(/\/booking\/.*/);
    const newBookingUrl = page.url();
    expect(newBookingUrl).not.toBe(bookingUrl);
    await expect(page.locator('text=PENDING PAYMENT').first()).toBeVisible();

    // Cleanup the second booking
    const newBookingId = newBookingUrl.split('/').pop() as string;
    await prisma.payment.deleteMany({ where: { bookingId: newBookingId } });
    await prisma.booking.deleteMany({ where: { id: newBookingId } });
    await prisma.payment.deleteMany({ where: { bookingId } });
    await prisma.booking.deleteMany({ where: { id: bookingId } });
  });

  test('should protect against race condition if booking was confirmed by webhook', async ({ page }) => {
    // 1. Login as Customer 1
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer1@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    const customer = await prisma.customer.findUnique({ where: { email: 'customer1@test.com' } });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!customer || !vehicle) throw new Error('Missing seed customer/vehicle');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 45);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 46);

    // Create a confirmed booking with success payment directly in DB (simulating settled webhook)
    const confirmedBooking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        pickupBranchId: vehicle.branchId,
        returnBranchId: vehicle.branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        status: 'confirmed',
        totalPrice: 500000,
        payments: {
          create: {
            amount: 500000,
            status: 'success',
            method: 'bank_transfer',
            gatewayReference: `settled-${Date.now()}`
          }
        }
      }
    });

    // 2. Open /booking/[id] for the confirmed booking
    await page.goto(`/booking/${confirmedBooking.id}`);

    // 3. UI Guard: The self-cancel button must NOT be present
    await expect(page.locator('[data-testid="self-cancel-btn"]')).not.toBeVisible();
    await expect(page.locator('text=CONFIRMED').first()).toBeVisible();

    // 4. Server-Side Guard & Atomicity:
    // Even if an adversary or stale tab invokes an update with customerCancelBooking logic,
    // the conditional update where status = 'pending_payment' matches 0 rows and leaves confirmed & payment untouched!
    const atomicUpdateResult = await prisma.booking.updateMany({
      where: {
        id: confirmedBooking.id,
        customerId: customer.id,
        status: 'pending_payment',
      },
      data: {
        status: 'cancelled',
        cancellationNote: 'Dibatalkan oleh pelanggan sebelum pembayaran.',
        cancelledBy: null,
      }
    });

    expect(atomicUpdateResult.count).toBe(0);

    // Verify DB integrity: booking is STILL confirmed, payment is STILL success
    const checkedBooking = await prisma.booking.findUnique({
      where: { id: confirmedBooking.id },
      include: { payments: true }
    });
    expect(checkedBooking?.status).toBe('confirmed');
    expect(checkedBooking?.payments[0]?.status).toBe('success');

    // Cleanup
    await prisma.payment.deleteMany({ where: { bookingId: confirmedBooking.id } });
    await prisma.booking.deleteMany({ where: { id: confirmedBooking.id } });
  });

  test('should handle idempotent double-cancellation gracefully', async () => {
    const customer = await prisma.customer.findUnique({ where: { email: 'customer1@test.com' } });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!customer || !vehicle) throw new Error('Missing seed customer/vehicle');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 50);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 51);

    // Create a pending booking
    const pendingBooking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        pickupBranchId: vehicle.branchId,
        returnBranchId: vehicle.branchId,
        startDate,
        endDate,
        rentalType: 'self_drive',
        status: 'pending_payment',
        totalPrice: 500000,
        payments: {
          create: {
            amount: 500000,
            status: 'pending',
            method: 'bank_transfer',
            gatewayReference: `double-cancel-${Date.now()}`
          }
        }
      }
    });

    // First atomic update: succeeds
    const firstResult = await prisma.booking.updateMany({
      where: {
        id: pendingBooking.id,
        customerId: customer.id,
        status: 'pending_payment',
      },
      data: {
        status: 'cancelled',
        cancellationNote: 'Dibatalkan oleh pelanggan sebelum pembayaran.',
        cancelledBy: null,
      }
    });
    expect(firstResult.count).toBe(1);

    // Payment marked failed
    await prisma.payment.updateMany({
      where: { bookingId: pendingBooking.id, status: 'pending' },
      data: { status: 'failed' }
    });

    // Second atomic update (double cancel attempt): returns count 0
    const secondResult = await prisma.booking.updateMany({
      where: {
        id: pendingBooking.id,
        customerId: customer.id,
        status: 'pending_payment',
      },
      data: {
        status: 'cancelled',
        cancellationNote: 'Dibatalkan oleh pelanggan sebelum pembayaran.',
        cancelledBy: null,
      }
    });
    expect(secondResult.count).toBe(0);

    // Current status is already cancelled
    const currentStatus = await prisma.booking.findUnique({
      where: { id: pendingBooking.id },
      select: { status: true }
    });
    expect(currentStatus?.status).toBe('cancelled');

    // Cleanup
    await prisma.payment.deleteMany({ where: { bookingId: pendingBooking.id } });
    await prisma.booking.deleteMany({ where: { id: pendingBooking.id } });
  });

});
