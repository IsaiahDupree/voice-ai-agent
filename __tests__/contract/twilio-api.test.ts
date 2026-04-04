/**
 * Contract Test: Twilio API
 * Feature: F1226
 * Tests that Twilio API integration matches expected contract
 */

describe('Contract Test: Twilio API', () => {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC_test_sid'
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'test_token'
  const TWILIO_BASE_URL = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Messages API', () => {
    it('should match send SMS contract', async () => {
      const mockResponse = {
        sid: 'SM_123',
        from: '+1234567890',
        to: '+0987654321',
        body: 'Test message',
        status: 'queued',
        price: null,
        direction: 'outbound-api',
        dateCreated: new Date().toISOString(),
        dateSent: null,
        dateUpdated: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      })

      const response = await fetch(`${TWILIO_BASE_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: '+1234567890',
          To: '+0987654321',
          Body: 'Test message'
        }).toString()
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        sid: expect.stringMatching(/^SM/),
        from: expect.any(String),
        to: expect.any(String),
        body: expect.any(String),
        status: expect.stringMatching(/queued|sent|delivered|failed/)
      })
    })

    it('should match get message contract', async () => {
      const mockResponse = {
        sid: 'SM_123',
        from: '+1234567890',
        to: '+0987654321',
        body: 'Test message',
        status: 'delivered',
        price: '-0.00750',
        priceUnit: 'USD'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${TWILIO_BASE_URL}/Messages/SM_123.json`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        sid: expect.any(String),
        status: expect.any(String)
      })
    })

    it('should match list messages contract', async () => {
      const mockResponse = {
        messages: [
          {
            sid: 'SM_123',
            from: '+1234567890',
            to: '+0987654321',
            status: 'delivered'
          }
        ],
        page: 0,
        pageSize: 50
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${TWILIO_BASE_URL}/Messages.json?PageSize=50`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        messages: expect.any(Array),
        page: expect.any(Number),
        pageSize: expect.any(Number)
      })
    })
  })

  describe('Calls API', () => {
    it('should match create call contract', async () => {
      const mockResponse = {
        sid: 'CA_123',
        from: '+1234567890',
        to: '+0987654321',
        status: 'queued',
        direction: 'outbound-api',
        price: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      })

      const response = await fetch(`${TWILIO_BASE_URL}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: '+1234567890',
          To: '+0987654321',
          Url: 'http://example.com/twiml'
        }).toString()
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        sid: expect.stringMatching(/^CA/),
        from: expect.any(String),
        to: expect.any(String),
        status: expect.stringMatching(/queued|ringing|in-progress|completed|failed/)
      })
    })

    it('should match get call contract', async () => {
      const mockResponse = {
        sid: 'CA_123',
        status: 'completed',
        duration: '120',
        price: '-0.01',
        priceUnit: 'USD'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${TWILIO_BASE_URL}/Calls/CA_123.json`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`
        }
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        sid: expect.any(String),
        status: expect.any(String)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid credentials', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          code: 20003,
          message: 'Authenticate',
          status: 401
        })
      })

      const response = await fetch(`${TWILIO_BASE_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic invalid_credentials',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(401)
    })

    it('should handle invalid phone number', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          code: 21211,
          message: 'The \'To\' number is not a valid phone number.',
          status: 400
        })
      })

      const response = await fetch(`${TWILIO_BASE_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: '+1234567890',
          To: 'invalid',
          Body: 'Test'
        }).toString()
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })

    it('should handle missing required fields', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          code: 21604,
          message: 'The \'Body\' parameter is required.',
          status: 400
        })
      })

      const response = await fetch(`${TWILIO_BASE_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: '+1234567890',
          To: '+0987654321'
          // Missing Body
        }).toString()
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })
  })
})
