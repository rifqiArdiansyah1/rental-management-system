import { test, expect, BrowserContext } from '@playwright/test';

test.describe('Race Condition & Double Submit Protection', () => {

  test('should prevent double booking on the same vehicle and dates via Promise.all', async ({ browser }) => {
    // 1. Setup two contexts for two different customers
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Login Customer 1
    await page1.goto('/login');
    await page1.fill('input[type="email"]', 'customer1@test.com');
    await page1.fill('input[type="password"]', 'Password123!');
    await page1.click('button[type="submit"]');
    await page1.waitForURL('/'); // Wait for redirect to home

    // Login Customer 2
    await page2.goto('/login');
    await page2.fill('input[type="email"]', 'customer2@test.com');
    await page2.fill('input[type="password"]', 'Password123!');
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/'); // Wait for redirect to home

    // 2. Both navigate to the booking page for the same vehicle
    const vehicleId = 'vehicle-race-condition';
    await page1.goto(`/vehicles/${vehicleId}/book`);
    await page2.goto(`/vehicles/${vehicleId}/book`);

    // 3. Fill out the exact same dates
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Tomorrow
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 3); // +3 days

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Customer 1
    await page1.fill('input[type="date"]', startStr); // Note: Assuming the first date input is Pick-up Date
    const dateInputs1 = await page1.locator('input[type="date"]').all();
    await dateInputs1[0].fill(startStr);
    await dateInputs1[1].fill(endStr);
    
    // Customer 2
    const dateInputs2 = await page2.locator('input[type="date"]').all();
    await dateInputs2[0].fill(startStr);
    await dateInputs2[1].fill(endStr);

    // Wait for pricing to appear (which enables the button)
    await page1.waitForSelector('text=Price Breakdown');
    await page2.waitForSelector('text=Price Breakdown');

    // 4. Trigger race condition by clicking the Confirm Booking button at the exact same time
    const button1 = page1.getByRole('button', { name: 'Confirm Booking' });
    const button2 = page2.getByRole('button', { name: 'Confirm Booking' });

    // Enable network interception if needed, but Promise.all on click is often close enough
    await Promise.allSettled([
      button1.click(),
      button2.click()
    ]);

    // Wait for both to either redirect or show error
    // One should redirect to /booking/[id], the other should show an error
    await Promise.allSettled([
      page1.waitForURL(/\/booking\/.*/, { timeout: 10000 }).catch(() => {}),
      page2.waitForURL(/\/booking\/.*/, { timeout: 10000 }).catch(() => {})
    ]);

    const url1 = page1.url();
    const url2 = page2.url();

    const success1 = url1.includes('/booking/');
    const success2 = url2.includes('/booking/');

    // Exclusively one must succeed
    expect(success1 !== success2).toBeTruthy();

    if (!success1) {
      const errorMsg = await page1.locator('.bg-error-container\\/20').textContent();
      expect(errorMsg).toContain('tidak tersedia');
    }

    if (!success2) {
      const errorMsg = await page2.locator('.bg-error-container\\/20').textContent();
      expect(errorMsg).toContain('Mobil sudah dipesan');
    }

    await context1.close();
    await context2.close();
  });

  test('should disable button after first click to prevent double-submit (UI)', async ({ page }) => {
    // Login Customer 1
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer1@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/vehicles/vehicle-race-condition/book');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 5);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 6);
    
    const dateInputs = await page.locator('input[type="date"]').all();
    await dateInputs[0].fill(startDate.toISOString().split('T')[0]);
    await dateInputs[1].fill(endDate.toISOString().split('T')[0]);

    await page.waitForSelector('text=Price Breakdown');

    // Select the button by its type instead of name since it changes to "Processing..." immediately
    const submitBtn = page.locator('button[type="submit"]');

    // Double click to simulate race condition
    await submitBtn.click();

    // Check if it's disabled immediately
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toContainText('Processing');
  });

});
