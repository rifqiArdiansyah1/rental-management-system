import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

test.describe('Self-Drive Booking Flow & Webhook Security', () => {

  test('should complete self-drive booking and handle midtrans webhook idempotency & security', async ({ page, request }) => {
    // 1. Login Customer 1
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer1@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 2. Go to booking page
    const vehicleId = 'vehicle-self-drive';
    await page.goto(`/vehicles/${vehicleId}/book`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 2);
    
    const dateInputs = await page.locator('input[type="date"]').all();
    await dateInputs[0].fill(startDate.toISOString().split('T')[0]);
    await dateInputs[1].fill(endDate.toISOString().split('T')[0]);

    // Ensure Self-Drive is selected (default)
    await page.getByRole('button', { name: 'Self-Drive' }).click();
    await page.waitForSelector('text=Price Breakdown');

    // 3. Confirm Booking
    await page.getByRole('button', { name: 'Confirm Booking' }).click();

    // 4. Wait for redirect to Booking Detail/Payment Page
    await page.waitForURL(/\/booking\/.*/);
    
    // Check if status is PENDING PAYMENT
    await expect(page.locator('text=PENDING PAYMENT').first()).toBeVisible();

    // 5. Click "Bayar Sekarang" to generate Payment record
    const payBtn = page.getByRole('button', { name: /Bayar/i });
    await payBtn.waitFor({ state: 'visible', timeout: 5000 });
    await payBtn.click();
    // Wait for a bit for the action to complete and payment record to be created
    await page.waitForTimeout(2000);

    // Extract Booking ID from URL
    const url = page.url();
    const bookingId = url.split('/').pop() as string;

    // 6. Fetch Payment from DB to get the EXACT order_id (gatewayReference) and grossAmount
    const payment = await prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!payment) {
      throw new Error(`Payment record not found for booking ${bookingId}`);
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'Mid-server-mock-key';
    const orderId = payment.gatewayReference!;
    const statusCode = '200';
    // Midtrans webhook sends amount with .00 if it was an integer
    const grossAmount = `${payment.amount}.00`; 
    const signatureKey = crypto.createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${serverKey}`).digest('hex');

    const webhookPayload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      transaction_status: 'settlement',
      signature_key: signatureKey,
      payment_type: 'credit_card',
      transaction_id: `tx-${Date.now()}`
    };

    // Edge Case (Security): Invalid signature
    const invalidPayload = { ...webhookPayload, signature_key: 'invalid_signature' };
    const invalidResponse = await request.post('/api/webhooks/midtrans', {
      data: invalidPayload
    });
    // Should be rejected
    expect(invalidResponse.status()).not.toBe(200);

    // Valid Webhook
    const validResponse = await request.post('/api/webhooks/midtrans', {
      data: webhookPayload
    });
    expect(validResponse.status()).toBe(200);

    // Refresh page to see updated status
    await page.reload();
    await expect(page.locator('text=CONFIRMED').first()).toBeVisible();

    // Edge Case (Idempotency): Resend same payload
    const duplicateResponse = await request.post('/api/webhooks/midtrans', {
      data: webhookPayload
    });
    // Should return 200 (idempotent), but not crash or double process
    expect(duplicateResponse.status()).toBe(200);
  });

});
