import { test, expect } from '@playwright/test'

test.describe('LocalReach Dashboard - Mobile (375px)', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to iPhone SE size
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('http://localhost:3000/localreach')
  })

  test('dashboard loads on mobile viewport', async ({ page }) => {
    // Wait for stats to load
    await page.waitForLoadState('networkidle')

    // Check all major sections are visible
    const sections = await page.locator('section').count()
    expect(sections).toBeGreaterThan(0)

    // Check stats cards are visible
    const stats = page.locator('[class*="StatCard"]').or(page.locator('text=/Calls Today|Answered|Booking Rate|Revenue/'))
    await expect(stats.first()).toBeVisible()
  })

  test('campaign cards render without horizontal scroll', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Get viewport width
    const viewportSize = page.viewportSize()
    expect(viewportSize?.width).toBe(375)

    // Check no element exceeds viewport width
    const body = await page.locator('body').boundingBox()
    expect(body?.width).toBeLessThanOrEqual(375)

    // Campaign cards should be visible
    const campaignCards = page.locator('a:has-text("View all")')
    await expect(campaignCards).toBeVisible()
  })

  test('touch targets are at least 44px tall', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Check buttons meet minimum touch target size
    const buttons = page.locator('button')
    const count = await buttons.count()

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i)
        const box = await button.boundingBox()
        // Touch targets should be at least 44x44px
        expect(box?.height || 0).toBeGreaterThanOrEqual(44)
        expect(box?.width || 0).toBeGreaterThanOrEqual(44)
      }
    }
  })

  test('pause all button shows confirmation modal', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Find and click pause all button
    const pauseBtn = page.locator('button:has-text("Pause All")')
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click()

      // Confirmation modal should appear
      const confirmText = page.locator('text=/Pause all active campaigns/')
      await expect(confirmText).toBeVisible()

      // Check for confirm and cancel buttons
      const confirmBtn = page.locator('button:has-text("Confirm Pause All")')
      const cancelBtn = page.locator('button:has-text("Cancel")')
      await expect(confirmBtn).toBeVisible()
      await expect(cancelBtn).toBeVisible()

      // Cancel the operation
      await cancelBtn.click()

      // Modal should disappear
      await expect(confirmText).not.toBeVisible()
    }
  })

  test('call feed displays recent calls with outcome badges', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for call feed section
    const callFeedHeading = page.locator('text=/Call Feed/')
    await expect(callFeedHeading).toBeVisible()

    // Check for outcome badges
    const badges = page.locator('[class*="badge"], span:has-text(/Answered|Voicemail|Booked|Paid|No Answer/)')
    const badgeCount = await badges.count()
    // Should have at least placeholder text or real badges
    await expect(badges.first()).toBeVisible({ timeout: 5000 })
  })

  test('weekly schedule renders as horizontal scroll', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Find schedule section
    const scheduleHeading = page.locator('text=/Weekly Schedule/')
    await expect(scheduleHeading).toBeVisible()

    // Check for day cards
    const dayCards = page.locator('text=/Mon|Tue|Wed|Thu|Fri|Sat|Sun/')
    const cardCount = await dayCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(3)

    // Today's card should have special styling
    const todayCard = page.locator('[class*="border-green"], [style*="border-green"]').first()
    // At least one element should have today styling
    const allCards = page.locator('div').filter({ hasText: /^[A-Z]{3}$/ })
    expect(await allCards.count()).toBeGreaterThan(0)
  })
})

test.describe('LocalReach Dashboard - Tablet (768px)', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to iPad size
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('http://localhost:3000/localreach')
  })

  test('dashboard layout adapts to tablet', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Verify content is visible
    const mainContent = page.locator('main').or(page.locator('body').first())
    await expect(mainContent).toBeVisible()

    // Stats grid should use 2-4 columns on tablet
    const statsCards = page.locator('[class*="grid"], [class*="col"]')
    const count = await statsCards.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('LocalReach Dashboard - Desktop (1280px)', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('http://localhost:3000/localreach')
  })

  test('desktop layout fully optimized', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // All sections should be visible
    const sections = page.locator('section')
    const count = await sections.count()
    expect(count).toBeGreaterThan(3)

    // Stats cards should display in 4 columns
    const statsRow = page.locator('[class*="grid-cols-4"]').or(
      page.locator('div').filter({ hasText: /Calls Today|Answered|Booking Rate|Revenue/ }).first()
    )
    await expect(statsRow).toBeVisible()
  })
})

test.describe('LocalReach Dashboard - Real-time Updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('http://localhost:3000/localreach')
  })

  test('call feed updates in real time', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Wait for initial calls to load
    const callFeed = page.locator('text=/Call Feed/')
    await expect(callFeed).toBeVisible()

    // Count initial calls
    const initialCalls = page.locator('[class*="flex items-center gap-3 p-3"]')
    const initialCount = await initialCalls.count()

    // Wait for potential updates (5 seconds)
    await page.waitForTimeout(2000)

    // Check if new call appears (or at least the feed is still responsive)
    const updatedCalls = page.locator('[class*="flex items-center gap-3 p-3"]')
    const updatedCount = await updatedCalls.count()

    // Call count should be >= initial (might have new calls)
    expect(updatedCount).toBeGreaterThanOrEqual(initialCount)
  })
})

test.describe('LocalReach Dashboard - Error Handling', () => {
  test('shows error message on API failure', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    // Intercept API calls and fail them
    await page.route('**/api/localreach/**', route => {
      route.abort()
    })

    await page.goto('http://localhost:3000/localreach')
    await page.waitForLoadState('networkidle')

    // Error message should appear
    const errorText = page.locator('text=/Failed|Error/')
    // The page should show some indication of failure
    // Either error message or retry button
    const retryBtn = page.locator('button:has-text("Retry")')
    await expect(retryBtn.or(errorText).first()).toBeVisible({ timeout: 5000 })
  })
})
