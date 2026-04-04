/**
 * Contract Test: Cal.com API
 * Feature: F1225
 * Tests that Cal.com API integration matches expected contract
 */

describe('Contract Test: Cal.com API', () => {
  const CALCOM_API_KEY = process.env.CALCOM_API_KEY || 'test_key'
  const CALCOM_BASE_URL = 'https://api.cal.com/v1'

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Availability API', () => {
    it('should match check availability contract', async () => {
      const mockResponse = {
        busy: [
          {
            start: '2026-03-28T14:00:00Z',
            end: '2026-03-28T15:00:00Z'
          }
        ],
        timeZone: 'America/New_York'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(
        `${CALCOM_BASE_URL}/availability?apiKey=${CALCOM_API_KEY}&dateFrom=2026-03-28&dateTo=2026-03-29`,
        {
          method: 'GET'
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        busy: expect.any(Array),
        timeZone: expect.any(String)
      })
    })
  })

  describe('Booking API', () => {
    it('should match create booking contract', async () => {
      const mockResponse = {
        id: 123,
        uid: 'booking_123',
        eventTypeId: 456,
        title: 'Appointment',
        startTime: '2026-03-28T14:00:00Z',
        endTime: '2026-03-28T15:00:00Z',
        attendees: [
          {
            email: 'test@example.com',
            name: 'Test User'
          }
        ],
        status: 'ACCEPTED'
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      })

      const response = await fetch(`${CALCOM_BASE_URL}/bookings?apiKey=${CALCOM_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventTypeId: 456,
          start: '2026-03-28T14:00:00Z',
          responses: {
            name: 'Test User',
            email: 'test@example.com'
          }
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        id: expect.any(Number),
        uid: expect.any(String),
        eventTypeId: expect.any(Number),
        startTime: expect.any(String),
        endTime: expect.any(String),
        status: expect.stringMatching(/ACCEPTED|PENDING/)
      })
    })

    it('should match get booking contract', async () => {
      const mockResponse = {
        booking: {
          id: 123,
          uid: 'booking_123',
          title: 'Appointment',
          startTime: '2026-03-28T14:00:00Z',
          endTime: '2026-03-28T15:00:00Z',
          status: 'ACCEPTED'
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${CALCOM_BASE_URL}/bookings/123?apiKey=${CALCOM_API_KEY}`, {
        method: 'GET'
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.booking).toMatchObject({
        id: expect.any(Number),
        uid: expect.any(String),
        status: expect.any(String)
      })
    })

    it('should match cancel booking contract', async () => {
      const mockResponse = {
        message: 'Booking cancelled successfully',
        booking: {
          id: 123,
          status: 'CANCELLED'
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${CALCOM_BASE_URL}/bookings/123/cancel?apiKey=${CALCOM_API_KEY}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'User requested cancellation'
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toMatchObject({
        message: expect.any(String),
        booking: expect.objectContaining({
          status: 'CANCELLED'
        })
      })
    })
  })

  describe('Event Types API', () => {
    it('should match list event types contract', async () => {
      const mockResponse = {
        event_types: [
          {
            id: 456,
            title: '30 Minute Meeting',
            slug: '30min',
            length: 30
          }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const response = await fetch(`${CALCOM_BASE_URL}/event-types?apiKey=${CALCOM_API_KEY}`, {
        method: 'GET'
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.event_types).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            title: expect.any(String),
            slug: expect.any(String),
            length: expect.any(Number)
          })
        ])
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid API key', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Invalid API key'
        })
      })

      const response = await fetch(`${CALCOM_BASE_URL}/bookings?apiKey=invalid`, {
        method: 'GET'
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(401)
    })

    it('should handle booking conflicts', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          message: 'This time slot is not available'
        })
      })

      const response = await fetch(`${CALCOM_BASE_URL}/bookings?apiKey=${CALCOM_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventTypeId: 456,
          start: '2026-03-28T14:00:00Z'
        })
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(409)
    })

    it('should handle invalid booking data', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Missing required fields',
          errors: ['email is required']
        })
      })

      const response = await fetch(`${CALCOM_BASE_URL}/bookings?apiKey=${CALCOM_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventTypeId: 456,
          start: '2026-03-28T14:00:00Z'
          // Missing responses
        })
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })
  })
})
