import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

test.describe('With Driver Booking Flow & Admin Scoping', () => {

  test('should complete with-driver booking and allow admin to assign driver', async ({ page, browser }) => {
    // 1. Login Customer 2
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer2@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 2. Go to booking page
    const vehicleId = 'vehicle-with-driver';
    await page.goto(`/vehicles/${vehicleId}/book`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 11);
    
    const dateInputs = await page.locator('input[type="datetime-local"]').all();
    await dateInputs[0].fill(startDate.toISOString().split('T')[0] + 'T10:00');
    await dateInputs[1].fill(endDate.toISOString().split('T')[0] + 'T10:00');

    // Select With Driver
    await page.getByRole('button', { name: 'With Driver' }).click();
    await page.waitForSelector('text=Driver Fee');

    // Confirm Booking
    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await page.waitForURL(/\/booking\/.*/);

    const bookingUrl = page.url();
    const bookingId = bookingUrl.split('/').pop() as string;

    // Ubah status jadi confirmed agar form assign driver muncul
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'confirmed' }
    });

    // 3. Admin Login
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    
    await adminPage.goto('/admin/login');
    await adminPage.fill('input[type="email"]', 'admin@test.com');
    await adminPage.fill('input[type="password"]', 'Password123!');
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL(/\/admin\/dashboard/);

    // 4. Admin assigns driver
    await adminPage.goto(`/admin/bookings/${bookingId}`);
    
    await adminPage.waitForTimeout(2000); // Give the page a moment to render
    
    // Admin should see "Belum ada sopir yang ditugaskan"
    await expect(adminPage.locator('text=Belum ada sopir yang ditugaskan').first()).toBeVisible({ timeout: 10000 });

    // Select driver
    const driverSelect = adminPage.locator('select').first();
    if (await driverSelect.isVisible()) {
      await driverSelect.selectOption({ index: 1 });
      await adminPage.getByRole('button', { name: /Tugaskan Sopir/ }).click();
      
      await adminPage.waitForTimeout(2000);
      await adminPage.reload();
      await expect(adminPage.locator('text=Sopir Test').first()).toBeVisible({ timeout: 15000 });
    }

    await adminContext.close();
  });

});
