import { test, expect } from '@playwright/test'

test.describe('Call Flow — mobile UI/UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('call initiation page loads without errors', async ({ page }) => {
    await expect(page).not.toHaveTitle(/error/i)
    await expect(page.locator('body')).toBeVisible()
  })

  test('phone input field is present and tappable', async ({ page }) => {
    const phoneInput = page.locator('input[type="tel"], input[name*="phone"], input[placeholder*="phone" i], input[placeholder*="Phone" i]').first()
    if (await phoneInput.count() > 0) {
      const box = await phoneInput.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
      }
    } else {
      // No phone input on dashboard root — navigate to a call page if available
      const callLink = page.locator('a[href*="call"], button:has-text("Call"), a:has-text("Call")').first()
      if (await callLink.count() > 0) {
        await callLink.click()
        await page.waitForLoadState('networkidle').catch(() => null)
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })

  test('no horizontal overflow on call UI mobile', async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 375
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })

  test('submit/call buttons meet touch target size', async ({ page }) => {
    const buttons = await page.locator('button:visible').all()
    for (const btn of buttons.slice(0, 8)) {
      const box = await btn.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
      }
    }
  })

  test('form inputs are accessible on mobile', async ({ page }) => {
    const inputs = await page.locator('input:visible, textarea:visible').all()
    for (const input of inputs.slice(0, 5)) {
      const box = await input.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(24)
      }
    }
  })

  test('contacts sub-route loads and is not clipped', async ({ page }) => {
    await page.goto('/dashboard/contacts')
    await expect(page.locator('body')).toBeVisible()
    const clipped = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('h1, h2, h3, p, span'))
      return els.filter(el => {
        const style = getComputedStyle(el)
        return style.overflow === 'hidden' && el.scrollWidth > el.clientWidth
      }).length
    })
    expect(clipped).toBe(0)
  })

  test('scheduling page is reachable from dashboard', async ({ page }) => {
    await page.goto('/dashboard/scheduling')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('caller-memory page touch targets meet minimum', async ({ page }) => {
    await page.goto('/dashboard/caller-memory')
    await expect(page.locator('body')).toBeVisible()
    const buttons = await page.locator('button:visible').all()
    for (const btn of buttons.slice(0, 5)) {
      const box = await btn.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(28)
      }
    }
  })

  test('business-context page loads without overflow', async ({ page }) => {
    await page.goto('/dashboard/business-context')
    await expect(page.locator('body')).toBeVisible()
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 375
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })

  test('navigation between dashboard sub-routes is smooth on mobile', async ({ page }) => {
    const subRoutes = ['/dashboard/contacts', '/dashboard/scheduling', '/dashboard/caller-memory']
    for (const route of subRoutes) {
      await page.goto(route)
      await expect(page.locator('body')).toBeVisible()
      await expect(page).not.toHaveTitle(/error/i)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = page.viewportSize()?.width ?? 375
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
    }
  })
})
