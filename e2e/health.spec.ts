import { test, expect } from '@playwright/test';

test.describe('Voice AI Agent', () => {
  test('health endpoint returns 200', async ({ page }) => {
    const response = await page.goto('/api/health');
    expect(response?.status()).toBe(200);
  });

  test('home page loads', async ({ page }) => {
    await page.goto('/');
    const heading = await page.locator('h1, h2').first();
    expect(await heading.isVisible()).toBe(true);
  });

  test('responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const heading = await page.locator('h1, h2').first();
    expect(await heading.isVisible()).toBe(true);
  });

  test('responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    const heading = await page.locator('h1, h2').first();
    expect(await heading.isVisible()).toBe(true);
  });

  test('API endpoints are accessible', async ({ page }) => {
    const endpoints = ['/api/health'];
    for (const endpoint of endpoints) {
      const response = await page.goto(endpoint);
      expect(response?.status()).toBeLessThan(500);
    }
  });
});
