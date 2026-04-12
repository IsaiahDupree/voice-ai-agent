import { test, expect } from '@playwright/test'

test.describe('LocalReach — mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/localreach')
  })

  test('localreach page loads without errors', async ({ page }) => {
    await expect(page).not.toHaveTitle(/error/i)
    await expect(page.locator('body')).toBeVisible()
  })

  test('no horizontal overflow on localreach mobile', async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 375
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })

  test('localreach has visible content sections', async ({ page }) => {
    const sections = page.locator('main section, main > div, [role="main"] > div')
    const count = await sections.count()
    expect(count).toBeGreaterThan(0)
  })

  test('interactive elements meet touch target size', async ({ page }) => {
    const buttons = await page.locator('button:visible').all()
    for (const btn of buttons.slice(0, 5)) {
      const box = await btn.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
      }
    }
  })

  test('map sub-route is reachable', async ({ page }) => {
    await page.goto('/localreach/map')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('campaigns sub-route is reachable', async ({ page }) => {
    await page.goto('/localreach/campaigns')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('offers sub-route is reachable', async ({ page }) => {
    await page.goto('/localreach/offers')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('compliance sub-route is reachable', async ({ page }) => {
    await page.goto('/localreach/compliance')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('text is not clipped on mobile', async ({ page }) => {
    const clipped = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('h1, h2, h3, p, span, li'))
      return els.filter(el => {
        const style = getComputedStyle(el)
        return style.overflow === 'hidden' && el.scrollWidth > el.clientWidth
      }).length
    })
    expect(clipped).toBe(0)
  })

  test('links and buttons are tappable', async ({ page }) => {
    const links = await page.locator('a[href]:visible').all()
    for (const link of links.slice(0, 6)) {
      const box = await link.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
      }
    }
  })
})
