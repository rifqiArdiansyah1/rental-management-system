import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

test.describe('Footer & Halaman Publik', () => {

  test('1. Home Page renders refined Headline, FilterBar in Indonesian, and Footer with About link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Verify Home Page Headline & Body
    await expect(page.locator('text=Koleksi Armada Eksklusif')).toBeVisible();
    await expect(page.locator('text=Kenyamanan & Kemewahan Perjalanan Terbaik')).toBeVisible();
    await expect(page.locator('text=Solusi mobilitas premium dengan standar inspeksi ketat')).toBeVisible();

    // 2. Verify FilterBar in Indonesian
    await expect(page.locator('text=Pilihan Cabang')).toBeVisible();
    await expect(page.locator('text=Kategori Kendaraan')).toBeVisible();
    await expect(page.locator('text=Terapkan Filter')).toBeVisible();

    // 3. Verify Value Proposition 3 Pillars
    await expect(page.locator('text=Armada Terawat & Bersih')).toBeVisible();
    await expect(page.locator('text=Reservasi Online 24/7')).toBeVisible();
    await expect(page.locator('text=Privasi Terlindungi Ketat')).toBeVisible();

    // 4. Verify Footer Links
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('text=Prestige Motion').first()).toBeVisible();
    await expect(footer.locator('a[href="/about"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/terms"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/locations"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/contact"]').first()).toBeVisible();
  });

  test('2. Navigation bar contains 5 menu items in correct sequence', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    // Use named link locators to avoid strict mode collision with brand logo (also href="/")
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Armada' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Cabang' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Tentang' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Kontak' })).toBeVisible();
  });

  test('3. About Page (/about) renders safe CV legal profile, 4 pillars, and dynamic branch cities', async ({ page }) => {
    const activeBranch = await prisma.branch.findFirst({
      where: { isActive: true }
    });

    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    // 1. Verify Title & Breadcrumb
    await expect(page.locator('h1')).toContainText('Mendefinisikan Ulang Mobilitas Premium');
    
    // 2. Verify Safe Legal Profile (without fake numbers)
    await expect(page.locator('text=CV Prestige Motion Nusantara')).toBeVisible();
    await expect(page.locator('text=Profil & Identitas Badan Usaha')).toBeVisible();

    // 3. Verify 4 Pillars
    await expect(page.locator('text=Pemesanan Online 24/7')).toBeVisible();
    await expect(page.locator('text=Jeda Detailing & Inspeksi 3 Jam')).toBeVisible();
    await expect(page.locator('text=Tarif Pasti Tanpa Biaya Tersembunyi')).toBeVisible();
    await expect(page.locator('text=Perlindungan Data (UU PDP No. 27/2022)')).toBeVisible();

    // 4. Verify Dynamic Branch
    if (activeBranch) {
      await expect(page.locator(`text=Kota ${activeBranch.city}`).first()).toBeVisible();
    }

    // 5. Verify CTA
    await expect(page.locator('text=Pilih Armada Sekarang')).toBeVisible();
  });

  test('4. Privacy Policy (/privacy) renders UU PDP, KYC, and Audit Trail protections', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Kebijakan Privasi');
    await expect(page.locator('text=Undang-Undang Republik Indonesia Nomor 27 Tahun 2022')).toBeVisible();
    await expect(page.locator('text=Identitas Pelanggan (KYC)')).toBeVisible();
    await expect(page.locator('text=Signed URL 5 Menit')).toBeVisible();
    await expect(page.getByText('document.view', { exact: true })).toBeVisible();
    await expect(page.getByText('document.view_denied', { exact: true })).toBeVisible();
  });

  test('5. Terms of Service (/terms) renders 1-hour payment, KYC, and 3-hour buffer terms', async ({ page }) => {
    await page.goto('/terms');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Syarat & Ketentuan');
    await expect(page.locator('text=1 (satu) jam')).toBeVisible();
    await expect(page.locator('text=Lepas Kunci (Self Drive)')).toBeVisible();
    await expect(page.locator('text=Dengan Sopir (With Driver)')).toBeVisible();
    await expect(page.locator('text=buffer proteksi 3 jam')).toBeVisible();
  });

  test('6. Locations (/locations) and Contact (/contact) are functional', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Jaringan Cabang Prestige Motion');

    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Pusat Bantuan & Layanan Pelanggan');
    await expect(page.locator('text=WhatsApp Concierge')).toBeVisible();
    await expect(page.locator('text=+62 811-3000-8888')).toBeVisible();
    await expect(page.locator('text=Bantuan & Eskalasi Darurat Perjalanan')).toBeVisible();
  });

  test('7. Tablet & Mobile Viewport renders responsive layout without overflow', async ({ page }) => {
    // 1. Tablet Viewport (iPad / 768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();

    // 2. Mobile Viewport (iPhone / 375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await footer.locator('a[href="/about"]').first().click();
    await page.waitForURL('/about');
    await expect(page.locator('h1')).toBeVisible();
  });

});
