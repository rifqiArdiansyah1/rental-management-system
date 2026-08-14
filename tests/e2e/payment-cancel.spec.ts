import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

test.describe('Payment Cancellation & Vehicle Lock Release', () => {

  test('should release vehicle lock when payment is cancelled', async ({ page, request }) => {
    // 1. Login Customer 1
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer1@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 2. Go to booking page
    const vehicleId = 'vehicle-payment-cancel';
    await page.goto(`/vehicles/${vehicleId}/book`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 20);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 21);
    
    const dateInputs = await page.locator('input[type="date"]').all();
    await dateInputs[0].fill(startDate.toISOString().split('T')[0]);
    await dateInputs[1].fill(endDate.toISOString().split('T')[0]);

    await page.waitForSelector('text=Price Breakdown');
    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await page.waitForURL(/\/booking\/.*/);
    
    const url = page.url();
    const bookingId = url.split('/').pop() as string;

    // Check if status is PENDING PAYMENT to ensure page is loaded
    await expect(page.locator('text=PENDING PAYMENT').first()).toBeVisible();

    // 3. Simulate Webhook (Payment Cancel/Deny)
    // First, click "Bayar Sekarang" to generate Payment record
    const payBtn = page.getByRole('button', { name: /Bayar/i });
    await payBtn.waitFor({ state: 'visible', timeout: 5000 });
    await payBtn.click();
    await page.waitForTimeout(2000); // wait for payment creation

    // Fetch Payment from DB to get the EXACT order_id (gatewayReference) and grossAmount
    const payment = await prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!payment) {
      throw new Error(`Payment record not found for booking ${bookingId}`);
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'Mid-server-mock-key';
    const orderId = payment.gatewayReference!;
    const statusCode = '202'; // cancel or deny status
    const grossAmount = `${payment.amount}.00`; 
    const signatureKey = crypto.createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${serverKey}`).digest('hex');

    const webhookPayload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      transaction_status: 'cancel',
      signature_key: signatureKey,
      payment_type: 'credit_card',
      transaction_id: `tx-cancel-${Date.now()}`
    };

    const cancelResponse = await request.post('/api/webhooks/midtrans', {
      data: webhookPayload
    });
    expect(cancelResponse.status()).toBe(200);

    // Refresh page
    await page.reload();
    await expect(page.locator('text=CANCELLED').first()).toBeVisible();

    // 4. Verify vehicle is available again for the same dates by attempting to book it again
    await page.goto(`/vehicles/${vehicleId}/book`);
    await dateInputs[0].fill(startDate.toISOString().split('T')[0]);
    await dateInputs[1].fill(endDate.toISOString().split('T')[0]);
    await page.waitForSelector('text=Price Breakdown');
    
    // Attempt booking again
    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    
    // Should succeed and redirect to new booking
    await page.waitForURL(/\/booking\/.*/);
    expect(page.url()).not.toBe(url); // Must be a new booking ID
  });

});
