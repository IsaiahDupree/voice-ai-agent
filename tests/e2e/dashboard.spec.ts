import { test, expect } from '@playwright/test'

test.describe('Dashboard — mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('dashboard page loads without errors', async ({ page }) => {
    await expect(page).not.toHaveTitle(/error/i)
    await expect(page.locator('body')).toBeVisible()
  })

  test('no horizontal overflow on dashboard mobile', async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 375
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })

  test('dashboard navigation items are tappable', async ({ page }) => {
    const navItems = await page.locator('nav a, nav button, [role="navigation"] a').all()
    for (const item of navItems.slice(0, 6)) {
      const box = await item.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
        expect(box.width).toBeGreaterThanOrEqual(28)
      }
    }
  })

  test('dashboard has at least one visible section', async ({ page }) => {
    const sections = page.locator('main section, main > div, [role="main"] > div')
    const count = await sections.count()
    expect(count).toBeGreaterThan(0)
  })

  test('business-context sub-route is reachable', async ({ page }) => {
    const link = page.locator('a[href*="business-context"]').first()
    if (await link.count() > 0) {
      await link.click()
      await page.waitForURL(/business-context/)
      expect(page.url()).toContain('business-context')
    } else {
      await page.goto('/dashboard/business-context')
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('contacts sub-route is reachable', async ({ page }) => {
    await page.goto('/dashboard/contacts')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('scheduling sub-route is reachable', async ({ page }) => {
    await page.goto('/dashboard/scheduling')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('caller-memory sub-route is reachable', async ({ page }) => {
    await page.goto('/dashboard/caller-memory')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('interactive elements have adequate touch targets', async ({ page }) => {
    const buttons = await page.locator('button:visible').all()
    for (const btn of buttons.slice(0, 5)) {
      const box = await btn.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
      }
    }
  })

  test('text content is not clipped on mobile', async ({ page }) => {
    const clipped = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('h1, h2, h3, p, span, li'))
      return els.filter(el => {
        const style = getComputedStyle(el)
        return style.overflow === 'hidden' && el.scrollWidth > el.clientWidth
      }).length
    })
    expect(clipped).toBe(0)
  })
})
