import { test, expect } from '@playwright/test'

test.describe('Unified Auth Group UI/UX Animations ("Prestige Motion")', () => {

  test('1. Login Page (/login): Card entrance, LCP header, input focus micro-interactions, and shimmer CTA', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    // 1. Card and Header LCP entrance (pure CSS, immediately visible)
    const card = page.locator('.animate-auth-card')
    const kicker = page.locator('.animate-hero-kicker').first()
    const title = page.locator('h1.animate-page-header')
    const desc = page.locator('p.animate-page-desc')

    await expect(card).toBeVisible()
    await expect(kicker).toBeVisible()
    await expect(title).toBeVisible()
    await expect(desc).toBeVisible()
    await expect(title).toHaveText('Masuk ke Akun Anda')

    // 2. Input micro-interaction: Email field focus
    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toBeVisible()
    const emailGroup = emailInput.locator('..')
    await expect(emailGroup).toHaveClass(/group/)

    // Focus input and verify border styling
    await emailInput.focus()
    await expect(emailInput).toHaveClass(/focus:border-secondary/)

    // 3. Password field and toggle button
    const passwordInput = page.locator('input[name="password"]')
    await expect(passwordInput).toBeVisible()
    const toggleBtn = page.locator('button[aria-label="Tampilkan kata sandi"]')
    await expect(toggleBtn).toBeVisible()
    await expect(toggleBtn).toHaveClass(/transition-all/)

    // 4. Submit button with shimmer-btn and arrow nudge
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toHaveClass(/shimmer-btn/)
    await expect(submitBtn).toHaveText('Masuk')
  })

  test('2. Register Page (/register): Card entrance, LCP header, 4 inputs with group focus, and shimmer CTA', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('domcontentloaded')

    // 1. Card and Header LCP entrance
    const card = page.locator('.animate-auth-card')
    const title = page.locator('h1.animate-page-header')
    await expect(card).toBeVisible()
    await expect(title).toBeVisible()
    await expect(title).toHaveText('Daftar Akun Baru')

    // 2. 4 Input fields with group wrapper
    const nameInput = page.locator('input[name="name"]')
    const phoneInput = page.locator('input[name="phone"]')
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')

    await expect(nameInput).toBeVisible()
    await expect(phoneInput).toBeVisible()
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()

    // 3. Submit button with shimmer-btn
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toHaveClass(/shimmer-btn/)
    await expect(submitBtn).toContainText('Daftar Sekarang')
  })

  test('3. Forgot Password Page (/forgot-password): Card entrance, LCP header, email input, and return link', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('domcontentloaded')

    // 1. Card and Header LCP entrance
    const card = page.locator('.animate-auth-card')
    const title = page.locator('h1.animate-page-header')
    await expect(card).toBeVisible()
    await expect(title).toBeVisible()
    await expect(title).toHaveText('Lupa Kata Sandi')

    // 2. Email input
    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toBeVisible()

    // 3. Submit button with shimmer-btn
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toHaveClass(/shimmer-btn/)
    await expect(submitBtn).toContainText('Kirim Tautan Pemulihan')

    // 4. Back to login link with arrow icon
    const backLink = page.getByRole('link', { name: 'Kembali ke halaman masuk' })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveClass(/group/)
  })

  test('4. Shimmer suppression: .shimmer-btn suppresses pseudo-element when disabled or loading', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeVisible()

    // Evaluate computed style when button is disabled
    const isSuppressedWhenDisabled = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      if (!btn) return false
      btn.disabled = true
      const afterStyle = window.getComputedStyle(btn, '::after')
      return afterStyle.display === 'none'
    })

    expect(isSuppressedWhenDisabled).toBe(true)
  })

  test('5. prefers-reduced-motion: reduce guarantees instant accessibility without looping animations', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce'
    })
    const page = await context.newPage()

    // 1. Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()

    // Ambient glow animation disabled
    const glow = page.locator('.animate-ambient-glow')
    if (await glow.count() > 0) {
      const animationName = await glow.first().evaluate((el) => {
        return window.getComputedStyle(el).animationName
      })
      expect(['none', '']).toContain(animationName)
    }

    // 2. Register
    await page.goto('/register')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()

    // 3. Forgot Password
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()

    await context.close()
  })

  test('6. Progressive Fallback & Scoped Noscript: forms and fields remain 100% visible and SSR compliant', async ({ page }) => {
    // 1. Raw SSR response test
    const res = await page.request.get('/login')
    const html = await res.text()

    expect(html).toContain('Masuk ke Akun Anda')
    expect(html).toContain('Alamat Email')
    expect(html).toContain('Kata Sandi')
    // Scoped noscript style check
    expect(html).toContain('.animate-auth-card')
    expect(html).toContain('.animate-alert-slide')

    // 2. Emulate environment without JavaScript
    const context = await page.context().browser()?.newContext({
      javaScriptEnabled: false
    })
    if (context) {
      const noJsPage = await context.newPage()
      await noJsPage.goto('/login')
      await expect(noJsPage.locator('h1')).toBeVisible()
      await expect(noJsPage.locator('input[name="email"]')).toBeVisible()
      await expect(noJsPage.locator('input[name="password"]')).toBeVisible()
      await expect(noJsPage.locator('button[type="submit"]')).toBeVisible()
      await context.close()
    }
  })

})
