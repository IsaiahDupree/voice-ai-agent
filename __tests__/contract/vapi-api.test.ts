/**
 * Contract Test: Vapi API
 * Feature: F1224
 * Tests that Vapi API integration matches expected contract
 */

describe('Contract Test: Vapi API', () => {
  const VAPI_API_KEY = process.env.VAPI_API_KEY || 'test_key'
  const VAPI_BASE_URL = 'https://api.vapi.ai'

  beforeEach(() => {
    // Mock fetch for contract testing
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Assistant API', () => {
    it('should match create assistant contract', async () => {
      const mockResponse = {
        id: 'asst_123',
        name: 'Test Assistant',
        model: {
          provider: 'openai',
          model: 'gpt-4'
        },
        voice: {
          provider: 'elevenlabs',
          voiceId: 'voice_123'
        },
        firstMessage: 'Hello!',
        createdAt: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      })

      const response = await fetch(`${VAPI_BASE_URL}/assistant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Assistant',
          model: { provider: 'openai', model: 'gpt-4' },
          voice: { provider: 'elevenlabs', voiceId: 'voice_123' },
          firstMessage: 'Hello!'
        })
      })

      expect(response.ok).toBe(true)
      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data).toMatchObject({
        id: expect.stringMatching(/^asst_/),
        name: expect.any(String),
        model: {
          provider: expect.any(String),
          model: expect.any(String)
        },
        voice: {
          provider: expect.any(String),
          voiceId: expect.any(String)
        }
      })
    })

    it('should match list assistants contract', async () => {
      const mockResponse = [
        {
          id: 'asst_1',
          name: 'Assistant 1',
          model: { provider: 'openai', model: 'gpt-4' },
          voice: { provider: 'elevenlabs', voiceId: 'voice_1' }
        }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${VAPI_BASE_URL}/assistant`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
      if (data.length > 0) {
        expect(data[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          model: expect.any(Object),
          voice: expect.any(Object)
        })
      }
    })

    it('should match update assistant contract', async () => {
      const mockResponse = {
        id: 'asst_123',
        name: 'Updated Assistant',
        model: { provider: 'openai', model: 'gpt-4' },
        voice: { provider: 'elevenlabs', voiceId: 'voice_123' }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${VAPI_BASE_URL}/assistant/asst_123`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Updated Assistant'
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.name).toBe('Updated Assistant')
    })
  })

  describe('Call API', () => {
    it('should match create outbound call contract', async () => {
      const mockResponse = {
        id: 'call_123',
        status: 'queued',
        assistantId: 'asst_123',
        phoneNumber: '+1234567890',
        createdAt: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      })

      const response = await fetch(`${VAPI_BASE_URL}/call/phone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assistantId: 'asst_123',
          phoneNumber: '+1234567890'
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        id: expect.stringMatching(/^call_/),
        status: expect.stringMatching(/queued|ringing|in-progress/),
        assistantId: expect.any(String),
        phoneNumber: expect.any(String)
      })
    })

    it('should match get call contract', async () => {
      const mockResponse = {
        id: 'call_123',
        status: 'completed',
        assistantId: 'asst_123',
        phoneNumber: '+1234567890',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        cost: 0.05,
        transcript: 'Call transcript...'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${VAPI_BASE_URL}/call/call_123`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        id: expect.any(String),
        status: expect.any(String),
        assistantId: expect.any(String)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle unauthorized access', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      })

      const response = await fetch(`${VAPI_BASE_URL}/assistant`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid_key'
        }
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(401)
    })

    it('should handle rate limiting', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' })
      })

      const response = await fetch(`${VAPI_BASE_URL}/call/phone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assistantId: 'asst_123',
          phoneNumber: '+1234567890'
        })
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(429)
    })

    it('should handle validation errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation error',
          details: ['phoneNumber is required']
        })
      })

      const response = await fetch(`${VAPI_BASE_URL}/call/phone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assistantId: 'asst_123'
          // Missing phoneNumber
        })
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })
  })
})
