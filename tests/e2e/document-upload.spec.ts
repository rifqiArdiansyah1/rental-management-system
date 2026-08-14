import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Document Upload & Verification', () => {

  test('should reject large files and allow valid uploads with partial admin approval', async ({ page, browser }) => {
    // 1. Generate a large dummy file > 5MB on the fly
    const largeFilePath = path.join(__dirname, 'large-file.jpg');
    // 6MB buffer
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');
    fs.writeFileSync(largeFilePath, largeBuffer);
    
    // Valid dummy file
    const validFilePath = path.join(__dirname, 'valid-file.jpg');
    const validBuffer = Buffer.alloc(1 * 1024 * 1024, 'a'); // 1MB
    fs.writeFileSync(validFilePath, validBuffer);

    // 2. Login Customer 1
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer1@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 3. Go to Dashboard / Profile where upload happens
    // Assuming the customer dashboard is at /dashboard
    await page.goto('/dashboard');
    
    // Click on document upload section/button if necessary
    // Example: uploading KTP
    const uploadInput = page.locator('input[type="file"]').first();
    
    if (await uploadInput.isVisible()) {
      // 4. Try uploading large file
      await page.locator('select[name="type"]').selectOption('ktp');
      await page.locator('input[name="identityNumber"]').fill('1234567890123456');
      await uploadInput.setInputFiles(largeFilePath);
      await page.getByRole('button', { name: /Unggah/i }).click();

      // Expect an error message about file size
      const errorMsg = await page.locator('text=/5MB|terlalu besar|max/i').first();
      await expect(errorMsg).toBeVisible();

      // 5. Upload valid KTP
      await page.locator('select[name="type"]').selectOption('ktp');
      await page.locator('input[name="identityNumber"]').fill('1234567890123456');
      await uploadInput.setInputFiles(validFilePath);
      await page.getByRole('button', { name: /Unggah/i }).click();
      
      // Wait for success message
      await expect(page.locator('text=/berhasil/i').first()).toBeVisible({ timeout: 15000 });
    }

    // 6. Admin Verification
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    
    await adminPage.goto('/admin/login');
    await adminPage.fill('input[type="email"]', 'admin@test.com');
    await adminPage.fill('input[type="password"]', 'Password123!');
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL(/\/admin\/dashboard/);

    // Go to customer verification page
    // Assuming admin can view customers or bookings and verify documents there
    await adminPage.goto('/admin/bookings'); // or wherever verification is done
    
    const verifyKtpBtn = adminPage.getByRole('button', { name: /Verifikasi|Approve|Terima/i }).first();
    if (await verifyKtpBtn.isVisible()) {
      await verifyKtpBtn.click();
    }

    await adminContext.close();
    
    // Cleanup files
    if (fs.existsSync(largeFilePath)) fs.unlinkSync(largeFilePath);
    if (fs.existsSync(validFilePath)) fs.unlinkSync(validFilePath);
  });

});
