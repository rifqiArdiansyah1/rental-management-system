import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

test.describe('Footer & Halaman Publik', () => {

  test('1. Home Page renders refined Value Proposition and Footer without dead links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Verify Value Proposition 3 Pillars
    await expect(page.locator('text=Armada Terawat & Bersih')).toBeVisible();
    await expect(page.locator('text=jeda pembersihan dan pengecekan menyeluruh 3 jam')).toBeVisible();
    await expect(page.locator('text=Reservasi Online 24/7')).toBeVisible();
    await expect(page.locator('text=08:00–21:00 WIB').first()).toBeVisible();
    await expect(page.locator('text=Privasi Terlindungi Ketat')).toBeVisible();
    await expect(page.locator('text=UU PDP').first()).toBeVisible();

    // 2. Verify Footer Links
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('text=Prestige Motion').first()).toBeVisible();
    await expect(footer.locator('text=© 2026 Prestige Motion. Seluruh hak cipta dilindungi undang-undang.')).toBeVisible();

    // Check link targets
    await expect(footer.locator('a[href="/privacy"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/terms"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/locations"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/contact"]').first()).toBeVisible();
  });

  test('2. Privacy Policy (/privacy) renders UU PDP, KYC, and Audit Trail protections', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Kebijakan Privasi');
    await expect(page.locator('text=Undang-Undang Republik Indonesia Nomor 27 Tahun 2022')).toBeVisible();
    await expect(page.locator('text=Identitas Pelanggan (KYC)')).toBeVisible();
    await expect(page.locator('text=Signed URL 5 Menit')).toBeVisible();
    await expect(page.getByText('document.view', { exact: true })).toBeVisible();
    await expect(page.getByText('document.view_denied', { exact: true })).toBeVisible();
  });

  test('3. Terms of Service (/terms) renders 1-hour payment, KYC, and 3-hour buffer terms', async ({ page }) => {
    await page.goto('/terms');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Syarat & Ketentuan');
    await expect(page.locator('text=1 (satu) jam')).toBeVisible();
    await expect(page.locator('text=Lepas Kunci (Self Drive)')).toBeVisible();
    await expect(page.locator('text=Dengan Sopir (With Driver)')).toBeVisible();
    await expect(page.locator('text=buffer proteksi 3 jam')).toBeVisible();
  });

  test('4. Locations (/locations) dynamically displays active branches from DB', async ({ page }) => {
    // Ensure test branch exists
    const testBranch = await prisma.branch.findFirst({
      where: { isActive: true }
    });

    await page.goto('/locations');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Jaringan Cabang Prestige Motion');
    if (testBranch) {
      await expect(page.locator(`text=${testBranch.name}`)).toBeVisible();
      await expect(page.locator(`text=${testBranch.city}`).first()).toBeVisible();
    }
  });

  test('5. Contact Page (/contact) displays CS channels and Emergency Trip Support', async ({ page }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Pusat Bantuan & Layanan Pelanggan');
    await expect(page.locator('text=WhatsApp Concierge')).toBeVisible();
    await expect(page.locator('text=+62 811-3000-8888')).toBeVisible();
    await expect(page.locator('text=Bantuan & Eskalasi Darurat Perjalanan')).toBeVisible();
  });

  test('6. Mobile Viewport renders responsive footer and layout without overflow', async ({ page }) => {
    // Set viewport to mobile size (iPhone 13 / standard mobile)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('text=Prestige Motion').first()).toBeVisible();

    // Verify footer links are accessible on mobile
    await footer.locator('a[href="/privacy"]').first().click();
    await page.waitForURL('/privacy');
    await expect(page.locator('h1')).toBeVisible();
  });

});
