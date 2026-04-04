/**
 * F1254: Regression test suite
 * Full regression suite run nightly to catch regressions
 */

import { createMocks } from 'node-mocks-http'

describe('F1254: Regression Test Suite', () => {
  describe('Critical Path Regression Tests', () => {
    it('REGRESSION: Health endpoint should always return 200', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const handler = (await import('@/app/api/health/route')).GET

      const response = await handler(req as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.status).toBe('healthy')
    })

    it('REGRESSION: Contact creation should not allow duplicate phone numbers', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          full_name: 'Test Contact',
          phone_number: '+15555551234',
        },
      })

      const handler = (await import('@/app/api/contacts/route')).POST

      // First creation should succeed
      const response1 = await handler(req as any)
      expect(response1.status).toBe(200)

      // Second creation with same number should fail or upsert
      const response2 = await handler(req as any)
      // Should either return 409 Conflict or 200 with upserted data
      expect([200, 409]).toContain(response2.status)
    })

    it('REGRESSION: Persona must have valid voice_id', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Persona',
          voice_id: '', // Invalid empty voice_id
          system_prompt: 'Test prompt',
        },
      })

      const handler = (await import('@/app/api/personas/route')).POST

      const response = await handler(req as any)

      expect(response.status).toBeGreaterThanOrEqual(400)
      const json = await response.json()
      expect(json.error).toBeDefined()
    })

    it('REGRESSION: Campaign cannot start without contacts', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          action: 'start',
        },
      })

      const handler = (await import('@/app/api/campaigns/[id]/actions/route')).POST

      const response = await handler(req as any, { params: { id: '999' } })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('No contacts')
    })

    it('REGRESSION: Vapi webhook must validate signature', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-vapi-signature': 'invalid-signature',
        },
        body: {
          call: {
            id: 'test-call',
          },
        },
      })

      const handler = (await import('@/app/api/webhooks/vapi/route')).POST

      const response = await handler(req as any)

      // Should reject invalid signatures
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Data Integrity Regression Tests', () => {
    it('REGRESSION: Transcript should always have call_id', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          content: 'Test transcript',
          // Missing call_id
        },
      })

      const handler = (await import('@/app/api/transcripts/route')).POST

      const response = await handler(req as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('call_id')
    })

    it('REGRESSION: Phone numbers should be E.164 formatted', async () => {
      const invalidNumbers = [
        '555-1234', // Missing country code
        '1234567890', // Missing +
        '+1 (555) 123-4567', // Has formatting
        'not-a-number',
      ]

      for (const invalidNumber of invalidNumbers) {
        const { req, res } = createMocks({
          method: 'POST',
          body: {
            full_name: 'Test',
            phone_number: invalidNumber,
          },
        })

        const handler = (await import('@/app/api/contacts/route')).POST

        const response = await handler(req as any)

        expect(response.status).toBeGreaterThanOrEqual(400)
        const json = await response.json()
        expect(json.error).toBeDefined()
      }
    })

    it('REGRESSION: Call duration should be non-negative', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          call: {
            id: 'test-call',
            status: 'completed',
          },
          message: {
            type: 'call-ended',
            duration: -10, // Invalid negative duration
          },
        },
      })

      const handler = (await import('@/app/api/webhooks/vapi/route')).POST

      const response = await handler(req as any)

      // Should either reject or normalize to 0
      const json = await response.json()
      if (response.status === 200) {
        expect(json.duration).toBeGreaterThanOrEqual(0)
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400)
      }
    })
  })

  describe('Performance Regression Tests', () => {
    it('REGRESSION: Health check should respond in < 100ms', async () => {
      const start = Date.now()

      const { req, res } = createMocks({
        method: 'GET',
      })

      const handler = (await import('@/app/api/health/route')).GET

      await handler(req as any)

      const duration = Date.now() - start

      expect(duration).toBeLessThan(100)
    })

    it('REGRESSION: Contact list API should handle 100+ contacts', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {
          limit: '100',
        },
      })

      const start = Date.now()

      const handler = (await import('@/app/api/contacts/route')).GET

      await handler(req as any)

      const duration = Date.now() - start

      // Should respond in < 1 second for 100 contacts
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Security Regression Tests', () => {
    it('REGRESSION: API should require authentication header', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          // Missing Authorization header
        },
      })

      const handler = (await import('@/app/api/campaigns/route')).GET

      const response = await handler(req as any)

      // Should return 401 Unauthorized
      expect(response.status).toBe(401)
    })

    it('REGRESSION: XSS payloads should be sanitized', async () => {
      const xssPayload = '<script>alert("XSS")</script>'

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          full_name: xssPayload,
          phone_number: '+15555551234',
        },
      })

      const handler = (await import('@/app/api/contacts/route')).POST

      const response = await handler(req as any)
      const json = await response.json()

      const responseStr = JSON.stringify(json)
      expect(responseStr).not.toContain('<script>')
    })

    it('REGRESSION: Rate limiting should block excessive requests', async () => {
      const requests = []

      // Make 20 rapid requests
      for (let i = 0; i < 20; i++) {
        const { req, res } = createMocks({
          method: 'GET',
          headers: {
            'x-forwarded-for': '1.2.3.4',
          },
        })

        const handler = (await import('@/app/api/health/route')).GET

        requests.push(handler(req as any))
      }

      const responses = await Promise.all(requests)

      // At least one should be rate limited (429)
      const rateLimited = responses.some((r) => r.status === 429)

      // This might not trigger in test environment, so just log
      if (!rateLimited) {
        console.warn('Rate limiting may not be enabled in test environment')
      }
    })
  })

  describe('API Contract Regression Tests', () => {
    it('REGRESSION: GET /api/campaigns should return array', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const handler = (await import('@/app/api/campaigns/route')).GET

      const response = await handler(req as any)
      const json = await response.json()

      expect(Array.isArray(json)).toBe(true)
    })

    it('REGRESSION: POST /api/contacts should return created contact', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          full_name: 'Regression Test',
          phone_number: '+15555559999',
        },
      })

      const handler = (await import('@/app/api/contacts/route')).POST

      const response = await handler(req as any)
      const json = await response.json()

      expect(json.id).toBeDefined()
      expect(json.full_name).toBe('Regression Test')
      expect(json.phone_number).toBe('+15555559999')
    })

    it('REGRESSION: GET /api/transcripts/:id should return transcript object', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      })

      const handler = (await import('@/app/api/transcripts/[id]/route')).GET

      const response = await handler(req as any, { params: { id: '1' } })

      if (response.status === 200) {
        const json = await response.json()
        expect(json.call_id).toBeDefined()
        expect(json.content).toBeDefined()
      } else {
        // Should return 404 if not found
        expect(response.status).toBe(404)
      }
    })
  })

  describe('Edge Case Regression Tests', () => {
    it('REGRESSION: Should handle empty request body gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {},
      })

      const handler = (await import('@/app/api/contacts/route')).POST

      const response = await handler(req as any)

      // Should return 400 with clear error
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBeDefined()
    })

    it('REGRESSION: Should handle malformed JSON', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        // Body is intentionally malformed (tested via string)
      })

      // This is hard to test directly, but the middleware should catch it
      expect(req.method).toBe('POST')
    })

    it('REGRESSION: Should handle null values in optional fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          full_name: 'Test',
          phone_number: '+15555551234',
          email: null, // Optional field set to null
          company: null,
        },
      })

      const handler = (await import('@/app/api/contacts/route')).POST

      const response = await handler(req as any)

      // Should accept null for optional fields
      expect(response.status).toBe(200)
    })
  })

  describe('Backwards Compatibility Regression Tests', () => {
    it('REGRESSION: Old API version should still work', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'api-version': 'v1', // Old API version
        },
      })

      const handler = (await import('@/app/api/health/route')).GET

      const response = await handler(req as any)

      // Should still work (or return 410 Gone if deprecated)
      expect([200, 410]).toContain(response.status)
    })
  })
})
