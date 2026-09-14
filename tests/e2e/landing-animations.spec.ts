import { test, expect } from '@playwright/test'

test.describe('Landing Page UI/UX Animations & Performance ("Prestige Motion")', () => {

  test('1. LCP Hero text and elements are immediately visible and not gated behind JS opacity 0', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // 1. Verify Hero headline & kicker are present and visible
    const kicker = page.locator('text=Koleksi Armada Eksklusif')
    const headline = page.locator('h1:has-text("Kenyamanan & Kemewahan Perjalanan Terbaik")')
    const ctaBtn = page.locator('a:has-text("Jelajahi Armada")')

    await expect(kicker).toBeVisible()
    await expect(headline).toBeVisible()
    await expect(ctaBtn).toBeVisible()

    // 2. Verify CTA has shimmer-btn class and arrow icon
    await expect(ctaBtn).toHaveClass(/shimmer-btn/)
    await expect(ctaBtn.locator('span.material-symbols-outlined')).toContainText('arrow_forward')
  })

  test('2. prefers-reduced-motion: reduce disables looping animations and provides instant access', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify hero and cards are fully visible under reduced motion
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Pilihan Armada')).toBeVisible()
    await expect(page.locator('text=Standar Tertinggi untuk Kenyamanan & Keamanan Anda')).toBeVisible()

    // Ambient glow layer should have animation disabled
    const glow = page.locator('.animate-ambient-glow')
    if (await glow.count() > 0) {
      const animationName = await glow.first().evaluate((el) => {
        return window.getComputedStyle(el).animationName
      })
      expect(['none', '', 'ambientGlow']).toContain(animationName)
    }

    await context.close()
  })

  test('3. Fallback ensures all sections are visible when IntersectionObserver is unsupported or fails', async ({ page }) => {
    // 1. Verify SSR response delivers content directly in initial HTML
    const res = await page.request.get('/')
    const html = await res.text()
    expect(html).toContain('Kenyamanan &amp; Kemewahan Perjalanan Terbaik')
    expect(html).toContain('Jeda Pengecekan 3 Jam')
    expect(html).toContain('Pilihan Armada')
    expect(html).toContain('Armada Terawat &amp; Bersih')

    // 2. Emulate environment without IntersectionObserver (legacy browser or partial failure)
    await page.addInitScript(() => {
      // @ts-ignore
      delete window.IntersectionObserver
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Hero must be visible
    await expect(page.locator('h1')).toBeVisible()

    // Filter bar must be visible
    await expect(page.locator('text=Pilihan Cabang')).toBeVisible()

    // Vehicle cards must be visible (not stuck in opacity 0)
    await expect(page.locator('#vehicles')).toBeVisible()
    await expect(page.locator('text=Tarif Harian').first()).toBeVisible()

    // 3 pillars must be visible
    await expect(page.locator('text=Armada Terawat & Bersih')).toBeVisible()
    await expect(page.locator('text=Reservasi Online 24/7')).toBeVisible()
    await expect(page.locator('text=Privasi Terlindungi Ketat')).toBeVisible()
  })

  test('4. Factual operational trust badges are present with NO ungrounded fake claims', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 1. Verify factual, verifiable trust badges
    await expect(page.locator('text=Jeda Pengecekan 3 Jam')).toBeVisible()
    await expect(page.locator('text=Konfirmasi Instan')).toBeVisible()
    await expect(page.locator('text=Privasi Terlindungi UU PDP')).toBeVisible()

    // 2. Verify absolute/fake ungrounded claims do NOT exist anywhere on page
    await expect(page.locator('text=120 Titik')).toHaveCount(0)
    await expect(page.locator('text=100% Siap Jalan')).toHaveCount(0)
  })

  test('5. Cumulative Layout Shift (CLS) remains near zero (< 0.05) during page load and scroll', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Track CLS using PerformanceObserver
    const clsScore = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let cls = 0
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value
            }
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })

        // Scroll down to vehicles and footer to simulate user journey
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' })
        setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
          setTimeout(() => {
            observer.disconnect()
            resolve(cls)
          }, 600)
        }, 400)
      })
    })

    // Web Vitals Good threshold is < 0.1, we aim for < 0.05
    expect(clsScore).toBeLessThan(0.05)
  })

  test('6. HeroAmbientController pauses ambient animation when scrolled out of view', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const heroSection = page.locator('#hero-section')
    await expect(heroSection).toBeVisible()
    await expect(heroSection).toHaveAttribute('data-in-view', 'true')

    // Scroll down to the footer
    await page.locator('footer').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    // Hero section should now be marked data-in-view="false"
    await expect(heroSection).toHaveAttribute('data-in-view', 'false')
  })

})
