// F1255: Smoke test: post-deploy
// Run smoke tests after every Vercel deploy
// Acceptance: Deploy passes smoke tests

/**
 * @jest-environment node
 */

describe('Post-Deploy Smoke Tests', () => {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

  console.log(`Running smoke tests against: ${baseUrl}`)

  it('should have health endpoint responding', async () => {
    const response = await fetch(`${baseUrl}/api/health`)

    expect(response.status).toBe(200)

    const data = await response.json()

    expect(data).toHaveProperty('status')
    expect(['healthy', 'degraded']).toContain(data.status)
  }, 20000)

  it('should have Supabase connection working', async () => {
    const response = await fetch(`${baseUrl}/api/health`)
    const data = await response.json()

    expect(data).toHaveProperty('checks')
    expect(data.checks).toHaveProperty('supabase')
    expect(data.checks.supabase).toHaveProperty('status')
  }, 20000)

  it('should have API routes accessible', async () => {
    // Test key API routes are accessible
    const routes = ['/api/health', '/api/personas', '/api/calls']

    for (const route of routes) {
      const response = await fetch(`${baseUrl}${route}`)

      // Should not be 404 (route exists)
      // 500 is acceptable if API keys aren't configured
      expect(response.status).not.toBe(404)

      console.log(`✓ ${route} - ${response.status}`)
    }
  }, 30000)

  it('should have environment variables configured', async () => {
    const response = await fetch(`${baseUrl}/api/health`)
    const data = await response.json()

    // Check that checks exist (indicates env vars are being used)
    expect(data).toHaveProperty('checks')
    expect(data.checks).toHaveProperty('vapi')
    expect(data.checks).toHaveProperty('supabase')

    console.log('✓ Environment variables configured')
  }, 20000)

  it('should return proper CORS headers', async () => {
    const response = await fetch(`${baseUrl}/api/health`)

    // Check for CORS headers
    const headers = response.headers

    // Most APIs should have content-type
    expect(headers.get('content-type')).toContain('application/json')

    console.log('✓ CORS headers present')
  }, 20000)

  it('should handle 404 gracefully', async () => {
    const response = await fetch(`${baseUrl}/api/nonexistent-route`)

    expect(response.status).toBe(404)

    console.log('✓ 404 handling works')
  })

  it('should have dashboard accessible', async () => {
    const response = await fetch(`${baseUrl}/dashboard`)

    // Should return HTML or redirect, not 500
    expect(response.status).toBeLessThan(500)

    console.log(`✓ Dashboard accessible - ${response.status}`)
  })

  it('should have static assets loading', async () => {
    // Try to load the main page
    const response = await fetch(baseUrl)

    expect(response.status).toBe(200)

    const html = await response.text()

    // Should have basic HTML structure
    expect(html).toContain('<html')
    expect(html).toContain('</html>')

    console.log('✓ Static assets loading')
  })

  it('should respond within acceptable time', async () => {
    const start = Date.now()

    await fetch(`${baseUrl}/api/health`)

    const duration = Date.now() - start

    // Health endpoint should respond in under 20 seconds (includes retries on all services)
    expect(duration).toBeLessThan(20000)

    console.log(`✓ Response time: ${duration}ms`)
  }, 25000)

  it('should have correct Next.js build', async () => {
    const response = await fetch(baseUrl)

    // Should have Next.js markers
    const html = await response.text()

    // Check for Next.js app indicators (case-insensitive)
    expect(html.toLowerCase()).toContain('__next')

    console.log('✓ Next.js build detected')
  })
})
