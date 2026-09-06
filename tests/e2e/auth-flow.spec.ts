import { test, expect } from '@playwright/test'

test.describe('Customer Authentication Flow & Security Guards', () => {

  test('1. Login Page renders Navy-Gold luxury theme, Navbar, Footer, and explicit labels', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // 1. Verify site chrome (Navbar & Footer)
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible()

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    await expect(footer.locator('text=Prestige Motion').first()).toBeVisible()

    // 2. Verify Card Branding & Header
    await expect(page.locator('text=Prestige Motion').nth(1)).toBeVisible()
    await expect(page.locator('h1:has-text("Masuk ke Akun Anda")')).toBeVisible()

    // 3. Verify Form Fields & Accessible Labels
    await expect(page.locator('label[for="email"]')).toHaveText('Alamat Email')
    await expect(page.locator('label[for="password"]')).toHaveText('Kata Sandi')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()

    // 4. Verify Action Button & Links
    const submitBtn = page.locator('button[type="submit"]')
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toHaveText('Masuk')

    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
    await expect(page.locator('a[href="/register"]')).toBeVisible()
  })

  test('2. Password visibility toggle switches input type between password and text', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const passwordInput = page.locator('input[name="password"]')
    await passwordInput.fill('Rahasia123!')

    // Awal: type="password"
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Klik tombol tampilkan kata sandi
    const toggleBtn = page.locator('button[aria-label="Tampilkan kata sandi"]')
    await expect(toggleBtn).toBeVisible()
    await toggleBtn.click()

    // Sekarang: type="text"
    await expect(passwordInput).toHaveAttribute('type', 'text')

    // Klik kembali untuk sembunyikan
    const hideBtn = page.locator('button[aria-label="Sembunyikan kata sandi"]')
    await expect(hideBtn).toBeVisible()
    await hideBtn.click()

    // Kembali ke: type="password"
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('3. Invalid credentials trigger localized Indonesian error message (not raw English string)', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="email"]', 'customer1@test.com')
    await page.fill('input[name="password"]', 'SalahPassword123!')
    await page.click('button[type="submit"]')

    // Menunggu alert notifikasi muncul
    const alertBox = page.getByTestId('auth-alert')
    await expect(alertBox).toBeVisible({ timeout: 15000 })
    await expect(alertBox).toContainText('Email atau kata sandi yang Anda masukkan salah. Silakan periksa kembali.')

    // Memastikan string mentah bahasa Inggris TIDAK muncul
    const rawEnglish = page.locator('text="Could not authenticate user"')
    await expect(rawEnglish).toHaveCount(0)
  })

  test('4. 🛡️ Staff account (admin@rental.com) is explicitly rejected with staff guidance and session revoked', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Masukkan kredensial akun staf
    await page.fill('input[name="email"]', 'admin@rental.com')
    await page.fill('input[name="password"]', 'Password123!')
    await page.click('button[type="submit"]')

    // Menunggu penolakan terarah
    const alertBox = page.getByTestId('auth-alert')
    await expect(alertBox).toBeVisible({ timeout: 15000 })
    await expect(alertBox).toContainText('Akun ini terdaftar sebagai staf internal. Silakan masuk melalui Portal Staf di /admin/login.')

    // Verifikasi bahwa sesi customer TIDAK terbentuk: jika mencoba akses /dashboard, tetap diarahkan ke /login
    await page.goto('/dashboard')
    await page.waitForURL('**/login**', { timeout: 10000 })
  })

  test('5. Forgot Password flow protects against user enumeration with uniform success banner', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1:has-text("Lupa Kata Sandi")')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()

    // Masukkan email acak yang tidak terdaftar
    await page.fill('input[name="email"]', 'random.unregistered.user999@test.com')
    await page.click('button[type="submit"]')

    // Menunggu banner sukses yang seragam
    const alertBox = page.getByTestId('auth-alert')
    await expect(alertBox).toBeVisible({ timeout: 15000 })
    await expect(alertBox).toContainText('Jika email terdaftar di sistem kami, tautan pemulihan kata sandi telah dikirim.')
  })

  test('6. Register page enforces synchronized MIN_PASSWORD_LENGTH (8 characters)', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="name"]', 'User Test Sandi')
    await page.fill('input[name="phone"]', '081299998888')
    await page.fill('input[name="email"]', 'pendek@test.com')
    
    // Password hanya 6 karakter (di bawah MIN_PASSWORD_LENGTH = 8)
    // Gunakan evaluate untuk bypass HTML5 client-side minLength agar dapat memvalidasi guard server action
    await page.locator('input[name="password"]').evaluate((el: HTMLInputElement) => {
      el.removeAttribute('minlength')
      el.value = 'Pass1!'
    })

    await page.click('button[type="submit"]')

    // Harus ditolak dengan pesan validasi panjang minimum
    const alertBox = page.getByTestId('auth-alert')
    await expect(alertBox).toBeVisible({ timeout: 15000 })
    await expect(alertBox).toContainText('Kata sandi minimal harus terdiri dari 8 karakter.')
  })

})
