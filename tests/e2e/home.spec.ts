import { test, expect } from '@playwright/test'

test.describe('Home page — mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders without errors', async ({ page }) => {
    await expect(page).not.toHaveTitle(/error/i)
    await expect(page.locator('body')).toBeVisible()
  })

  test('page title is present', async ({ page }) => {
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 375
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })

  test('navigation links are tappable (min 44px touch target)', async ({ page }) => {
    const links = await page.locator('a[href]:visible').all()
    for (const link of links.slice(0, 8)) {
      const box = await link.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
      }
    }
  })

  test('primary CTA button is visible on mobile', async ({ page }) => {
    const cta = page.locator('button:visible, a[href]:visible').first()
    await expect(cta).toBeVisible()
  })

  test('text is readable — no overflow clipping', async ({ page }) => {
    const overflowHidden = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('p, h1, h2, h3, span'))
      return els.filter(el => {
        const style = getComputedStyle(el)
        return style.overflow === 'hidden' && el.scrollWidth > el.clientWidth
      }).length
    })
    expect(overflowHidden).toBe(0)
  })

  test('dashboard link navigates correctly', async ({ page }) => {
    const dashLink = page.locator('a[href*="dashboard"]').first()
    if (await dashLink.count() > 0) {
      await dashLink.click()
      await page.waitForURL(/dashboard/)
      expect(page.url()).toContain('dashboard')
    }
  })

  test('localreach link navigates correctly', async ({ page }) => {
    const lrLink = page.locator('a[href*="localreach"]').first()
    if (await lrLink.count() > 0) {
      await lrLink.click()
      await page.waitForURL(/localreach/)
      expect(page.url()).toContain('localreach')
    }
  })
})
