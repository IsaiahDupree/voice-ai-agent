/**
 * Error Crawler — hits every deployed route and collects:
 *   - 404 / 500 page titles
 *   - JS console errors
 *   - Failed network requests (4xx / 5xx)
 *   - Uncaught exceptions
 *
 * Outputs a JSON report to: test-results/error-report.json
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=https://voice-ai-agent-roan.vercel.app \
 *   npx playwright test error-crawler --project=chromium-desktop --reporter=json
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// All static UI routes
const UI_ROUTES = [
  '/dashboard',
  '/dashboard/business-context',
  '/dashboard/caller-memory',
  '/dashboard/calls',
  '/dashboard/campaigns',
  '/dashboard/contacts',
  '/dashboard/dtmf-menus',
  '/dashboard/enhanced',
  '/dashboard/evaluation',
  '/dashboard/flows',
  '/dashboard/handoff',
  '/dashboard/interruption-settings',
  '/dashboard/knowledge-base',
  '/dashboard/language-variants',
  '/dashboard/mcp-registry',
  '/dashboard/personas',
  '/dashboard/scheduling',
  '/dashboard/settings',
  '/dashboard/setup',
  '/dashboard/tenants',
  '/localreach',
  '/localreach/campaigns',
  '/localreach/campaigns/new',
  '/localreach/compliance',
  '/localreach/map',
  '/localreach/offers',
]

// API routes to health-check (GET only)
const API_ROUTES = [
  '/api/health',
  '/api/analytics/calls',
  '/api/analytics/dashboard',
  '/api/analytics/conversion',
  '/api/analytics/bookings',
  '/api/analytics/campaigns',
  '/api/calls',
  '/api/contacts',
  '/api/campaigns',
  '/api/bookings',
  '/api/agent/config',
  '/api/analytics/stats',
  '/api/analytics/trends',
]

interface PageError {
  route: string
  type: 'page-404' | 'page-500' | 'js-error' | 'network-error' | 'api-error'
  message: string
  url?: string
  status?: number
}

const allErrors: PageError[] = []

// ─────────────────────────────────────────────────────────────────────────────
// UI Route scan
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UI Route Error Scan', () => {
  for (const route of UI_ROUTES) {
    test(`scan: ${route}`, async ({ page }) => {
      const jsErrors: string[] = []
      const networkErrors: Array<{ url: string; status: number }> = []

      // Capture JS errors
      page.on('pageerror', (err) => {
        if (!err.message.includes('ResizeObserver') && !err.message.includes('Non-Error')) {
          jsErrors.push(err.message)
        }
      })

      // Capture failed network requests
      page.on('requestfailed', (req) => {
        const url = req.url()
        if (!url.includes('analytics') && !url.includes('hotjar') && !url.includes('sentry')) {
          networkErrors.push({ url, status: 0 })
        }
      })

      // Capture 4xx/5xx responses
      page.on('response', (resp) => {
        const status = resp.status()
        const url = resp.url()
        if (status >= 400 && !url.includes('favicon') && !url.includes('.well-known')) {
          networkErrors.push({ url, status })
        }
      })

      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15000 })

      // Wait for client-side rendering
      await page.waitForTimeout(2000)

      const title = await page.title()
      const bodyText = await page.locator('body').textContent().catch(() => '')

      // Check for 404 page
      if (title.match(/404|not found|page not found/i) || bodyText?.match(/^404$|This page could not be found/i)) {
        const err: PageError = { route, type: 'page-404', message: `404: ${title}` }
        allErrors.push(err)
        console.log(`❌ 404: ${route}`)
      }

      // Check for 500 / error page
      if (title.match(/500|internal server error|application error/i) || bodyText?.match(/Application error|Server Error/i)) {
        const err: PageError = { route, type: 'page-500', message: `500: ${title}` }
        allErrors.push(err)
        console.log(`❌ 500: ${route}`)
      }

      // Log JS errors
      for (const msg of jsErrors) {
        const err: PageError = { route, type: 'js-error', message: msg }
        allErrors.push(err)
        console.log(`⚠️  JS: ${route} — ${msg.substring(0, 100)}`)
      }

      // Log network errors
      for (const ne of networkErrors) {
        // Only flag if it's a first-party API route
        if (ne.url.includes('/api/') || ne.status === 404 || ne.status === 500) {
          const err: PageError = { route, type: 'network-error', message: `HTTP ${ne.status || 'FAILED'}: ${ne.url}`, url: ne.url, status: ne.status }
          allErrors.push(err)
          console.log(`🔴 Net: ${route} — ${ne.status} ${ne.url.substring(0, 80)}`)
        }
      }

      // Always pass — we collect errors rather than fail on them
      expect(true).toBe(true)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// API Route scan
// ─────────────────────────────────────────────────────────────────────────────

test.describe('API Route Health Scan', () => {
  for (const route of API_ROUTES) {
    test(`api: ${route}`, async ({ page }) => {
      const response = await page.goto(route, { timeout: 10000 }).catch(() => null)
      const status = response?.status() ?? 0

      if (!response || status === 404) {
        const err: PageError = { route, type: 'api-error', message: `404 Not Found`, status: 404 }
        allErrors.push(err)
        console.log(`❌ API 404: ${route}`)
      } else if (status >= 500) {
        const body = await response.text().catch(() => '')
        const err: PageError = { route, type: 'api-error', message: `${status}: ${body.substring(0, 200)}`, status }
        allErrors.push(err)
        console.log(`❌ API 500: ${route} — ${body.substring(0, 80)}`)
      } else if (status >= 400 && status !== 401) {
        // 401 is expected for auth-protected routes without credentials
        const body = await response.text().catch(() => '')
        const err: PageError = { route, type: 'api-error', message: `${status}: ${body.substring(0, 200)}`, status }
        allErrors.push(err)
        console.log(`⚠️  API ${status}: ${route}`)
      } else {
        console.log(`✅ API OK (${status}): ${route}`)
      }

      expect(true).toBe(true)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Write report after all tests
// ─────────────────────────────────────────────────────────────────────────────

test.afterAll(async () => {
  const reportDir = 'test-results'
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })

  const report = {
    crawled_at: new Date().toISOString(),
    base_url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    total_routes_scanned: UI_ROUTES.length + API_ROUTES.length,
    total_errors: allErrors.length,
    errors_by_type: allErrors.reduce((acc: Record<string, number>, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1
      return acc
    }, {}),
    errors: allErrors,
  }

  fs.writeFileSync(
    path.join(reportDir, 'error-report.json'),
    JSON.stringify(report, null, 2)
  )

  console.log('\n' + '═'.repeat(60))
  console.log('ERROR CRAWLER REPORT')
  console.log('═'.repeat(60))
  console.log(`Scanned: ${report.total_routes_scanned} routes`)
  console.log(`Errors found: ${report.total_errors}`)
  for (const [type, count] of Object.entries(report.errors_by_type)) {
    console.log(`  ${type}: ${count}`)
  }
  console.log('Report saved → test-results/error-report.json')
  console.log('═'.repeat(60))
})
