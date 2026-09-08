import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

test.describe('Branch Location Enforcement on Customer Booking Flow', () => {
  const branchSurabayaId = 'surabaya-0000-0000-0000-000000000001';

  test.beforeAll(async () => {
    // Ensure a second branch exists (Surabaya)
    await prisma.branch.upsert({
      where: { id: branchSurabayaId },
      update: {},
      create: {
        id: branchSurabayaId,
        name: 'Cabang Kota Surabaya',
        city: 'Surabaya',
        address: 'Jl. Juanda Surabaya No. 45',
        phone: '081299998888',
        isActive: true,
      }
    });
  });

  test('should lock branch selection to vehicle home branch and disable other branches', async ({ page }) => {
    // 1. Customer Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'customer1@test.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 2. Fetch vehicle and its branch from database
    const vehicleId = 'vehicle-self-drive';
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { branch: true }
    });
    expect(vehicle).not.toBeNull();
    const homeBranch = vehicle!.branch;

    // 3. Navigate to booking page
    await page.goto(`/vehicles/${vehicleId}/book`);

    // 4. Verify Vehicle Details on left column shows home branch
    await expect(page.locator('text=Branch Location').first()).toBeVisible();
    await expect(page.locator(`text=${homeBranch.name}`).first()).toBeVisible();

    // 5. Inspect the Branch Location dropdown
    const branchSelect = page.locator('select').filter({ has: page.locator(`option:has-text("${homeBranch.name}")`) });
    await expect(branchSelect).toBeVisible();

    // The home branch option should be enabled and marked with "(Lokasi Armada)"
    const homeOption = branchSelect.locator(`option[value="${homeBranch.id}"]`);
    await expect(homeOption).toBeEnabled();
    const homeText = await homeOption.textContent();
    expect(homeText).toContain('Lokasi Armada');

    // The other branch (Surabaya) option should be DISABLED and marked with "(Armada Tidak Tersedia)"
    const otherOption = branchSelect.locator(`option[value="${branchSurabayaId}"]`);
    await expect(otherOption).toBeDisabled();
    const otherText = await otherOption.textContent();
    expect(otherText).toContain('Armada Tidak Tersedia');

    // 6. Verify guidance note below dropdown
    await expect(page.locator(`text=Armada ini berbasis di`).first()).toBeVisible();

    // 7. Complete valid booking using home branch
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 2);

    const dateInputs = await page.locator('input[type="datetime-local"]').all();
    await dateInputs[0].fill(startDate.toISOString().split('T')[0] + 'T10:00');
    await dateInputs[1].fill(endDate.toISOString().split('T')[0] + 'T10:00');

    await page.getByRole('button', { name: 'Self-Drive' }).click();
    await page.waitForSelector('text=Price Breakdown');

    // Submit booking
    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await page.waitForURL(/\/booking\/.*/);

    // Extract Booking ID from URL
    const url = page.url();
    const bookingId = url.split('/').pop() as string;

    // 8. Verify the created booking strictly has the vehicle's home branch
    const createdBooking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });
    expect(createdBooking).not.toBeNull();
    expect(createdBooking?.pickupBranchId).toBe(homeBranch.id);
    expect(createdBooking?.returnBranchId).toBe(homeBranch.id);
  });
});
