import { test, expect } from '@playwright/test';

test.describe('Multilanguage (ID/EN) Support & Isolation', () => {

  test('1. Default language is Indonesian (ID) without query params or cookies', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Navigation items in Indonesian
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Beranda' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Armada' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Cabang' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Tentang Kami' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Kontak' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Masuk', exact: true })).toBeVisible();

    // 2. Language Switcher ID is active
    const langSwitcher = nav.locator('[data-testid="language-switcher"]');
    await expect(langSwitcher).toBeVisible();
    const idBtn = langSwitcher.locator('[data-testid="lang-option-id"]');
    await expect(idBtn).toHaveClass(/bg-\[#d4af37\]/);

    // 3. Price formatting in ID format (using period as thousands separator)
    const priceText = page.locator('text=/Rp\\s+[0-9]{1,3}(\\.[0-9]{3})+/').first();
    await expect(priceText).toBeVisible();
  });

  test('2. Seamless switching from ID to EN via LanguageSwitcher', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav');
    const langSwitcher = nav.locator('[data-testid="language-switcher"]');
    const enBtn = langSwitcher.locator('[data-testid="lang-option-en"]');

    // Click EN
    await enBtn.click();
    await page.waitForLoadState('networkidle');

    // URL should remain clean without query param or sub-path
    expect(page.url()).not.toContain('/en');
    expect(page.url()).not.toContain('lang=');

    // Cookie NEXT_LOCALE should now be 'en'
    const cookies = await context.cookies();
    const localeCookie = cookies.find(c => c.name === 'NEXT_LOCALE');
    expect(localeCookie?.value).toBe('en');

    // Navigation items now in English
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Fleet' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Locations' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'About Us' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Contact' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();

    // Price formatting in EN format (using comma as thousands separator)
    const enPriceText = page.locator('text=/Rp\\s+[0-9]{1,3}(,[0-9]{3})+/').first();
    await expect(enPriceText).toBeVisible();
  });

  test('3. Public subpages (/about, /locations, /contact) render refined English copy', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/' }
    ]);

    // 1. About Page
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Redefining Executive Mobility');
    await expect(page.locator('text=4 Pillars of Service Excellence')).toBeVisible();
    await expect(page.locator('text=CV Prestige Motion Nusantara').first()).toBeVisible();

    // 2. Locations Page
    await page.goto('/locations');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Executive Branch Network');
    await expect(page.locator('text=08:00 – 21:00 WIB').first()).toBeVisible();
    await expect(page.locator('text=active fleet units').first()).toBeVisible();
    await expect(page.locator('text=Open Today').first()).toBeVisible();

    // 3. Contact Page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Client Assistance & Concierge Center');
    await expect(page.locator('text=24-Hour Roadside Assistance & Emergency Trip Escalation')).toBeVisible();
  });

  test('4. Legal pages (/privacy, /terms) display Notice of Governing Language in English', async ({ page, context }) => {
    // In English
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/' }
    ]);

    // Privacy in English
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');
    const privacyNotice = page.locator('[data-testid="governing-language-notice"]');
    await expect(privacyNotice).toBeVisible();
    await expect(privacyNotice).toContainText('Notice of Governing Language');
    await expect(privacyNotice).toContainText('official Indonesian version shall govern');

    // Terms in English
    await page.goto('/terms');
    await page.waitForLoadState('networkidle');
    const termsNotice = page.locator('[data-testid="governing-language-notice"]');
    await expect(termsNotice).toBeVisible();
    await expect(termsNotice).toContainText('Notice of Governing Language');
    await expect(termsNotice).toContainText('official Indonesian version shall govern');

    // Switch to Indonesian: Notice should NOT be visible
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'id', domain: 'localhost', path: '/' }
    ]);
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="governing-language-notice"]')).toHaveCount(0);
  });

  test('5. Auth Pages (/login, /register, /forgot-password) adapt to selected language', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/' }
    ]);

    // 1. Login Page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toHaveText('Sign In to Your Account');
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
    await expect(page.locator('text=Don\'t have an account?')).toBeVisible();

    // 2. Register Page
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toHaveText('Create an Account');
    await expect(page.locator('button[type="submit"]')).toContainText('Create Account');
    await expect(page.locator('text=Already have an account?')).toBeVisible();

    // 3. Forgot Password Page
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toHaveText('Forgot Password');
    await expect(page.locator('button[type="submit"]')).toContainText('Send Recovery Link');
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });

  test('6. Admin Portal Isolation: strictly Indonesian without LanguageSwitcher', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/' }
    ]);

    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');

    // Admin login must remain isolated in Indonesian / standard admin text
    await expect(page.locator('text=Admin Portal')).toBeVisible();
    await expect(page.locator('text=Sistem Manajemen Rental')).toBeVisible();
    await expect(page.locator('input[placeholder="Admin Email"]')).toBeVisible();

    // Language switcher must NOT exist on admin pages
    await expect(page.locator('[data-testid="language-switcher"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="language-switcher-footer"]')).toHaveCount(0);
  });

  test('7. Switch back to ID restores full Indonesian state', async ({ page, context }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/' }
    ]);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav');
    const langSwitcher = nav.locator('[data-testid="language-switcher"]');
    const idBtn = langSwitcher.locator('[data-testid="lang-option-id"]');

    await idBtn.click();
    await page.waitForLoadState('networkidle');

    // Navigation restored to Indonesian
    await expect(nav.getByRole('link', { name: 'Beranda' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Armada' })).toBeVisible();

    // Cookie restored to 'id'
    const cookies = await context.cookies();
    const localeCookie = cookies.find(c => c.name === 'NEXT_LOCALE');
    expect(localeCookie?.value).toBe('id');
  });

});
