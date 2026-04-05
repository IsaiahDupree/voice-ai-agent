/**
 * LocalReach V3 — Offers API Tests (Feature 3)
 * Tests for GET/POST /api/offers and POST /api/offers/match
 */

jest.mock('@/lib/supabase', () => {
  const mockFrom = jest.fn()
  return {
    supabaseAdmin: { from: mockFrom },
    supabase: { from: mockFrom },
  }
})

import { supabaseAdmin } from '@/lib/supabase'

const mockFrom = supabaseAdmin.from as jest.MockedFunction<typeof supabaseAdmin.from>

describe('LocalReach Offers API Tests (Feature 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/offers', () => {
    it('returns array of offers', async () => {
      const mockOffers = [
        { id: '1', name: 'AI Phone Starter', offer_type: 'subscription', pricing: '$197/mo', active: true, created_at: '2026-04-01' },
        { id: '2', name: 'AI Audit', offer_type: 'audit', pricing: '$2,500', active: true, created_at: '2026-04-01' },
      ]

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockOffers, error: null }),
      }
      // When no filters, order is the terminal call
      chain.order = jest.fn().mockResolvedValue({ data: mockOffers, error: null })

      mockFrom.mockReturnValue(chain)

      const { GET } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers')
      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.count).toBe(2)
      expect(data.offers).toHaveLength(2)
      expect(data.offers[0].name).toBe('AI Phone Starter')
    })

    it('filters by offer_type when provided', async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ id: '1', offer_type: 'audit' }], error: null }),
      }

      mockFrom.mockReturnValue(chain)

      const { GET } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers?offer_type=audit')
      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(chain.eq).toHaveBeenCalled()
    })

    it('returns empty array when no offers exist', async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockFrom.mockReturnValue(chain)

      const { GET } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers')
      const response = await GET(request as any)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.count).toBe(0)
      expect(data.offers).toEqual([])
    })

    it('handles database errors gracefully', async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'connection failed' } }),
        eq: jest.fn().mockReturnThis(),
      }

      mockFrom.mockReturnValue(chain)

      const { GET } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers')
      const response = await GET(request as any)

      expect(response.status).toBe(500)
    })

    it('filters by active status when provided', async () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockFrom.mockReturnValue(chain)

      const { GET } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers?active=true')
      await GET(request as any)

      // eq should be called for active filter
      expect(chain.eq).toHaveBeenCalled()
    })
  })

  describe('POST /api/offers', () => {
    it('creates new offer with required fields', async () => {
      const newOffer = {
        id: '3',
        name: 'AI Chatbot',
        offer_type: 'subscription',
        headline: 'Never Miss a Lead',
        pitch: 'AI chatbot for your website',
        pricing: '$147/mo',
      }

      const chain: any = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: newOffer, error: null }),
          }),
        }),
      }

      mockFrom.mockReturnValue(chain)

      const { POST } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'AI Chatbot',
          offer_type: 'subscription',
          headline: 'Never Miss a Lead',
          pitch: 'AI chatbot for your website',
          pricing: '$147/mo',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.offer.name).toBe('AI Chatbot')
    })

    it('returns 400 when required fields are missing', async () => {
      const { POST } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Incomplete' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('returns 400 for invalid offer_type', async () => {
      const { POST } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test',
          offer_type: 'invalid_type',
          headline: 'Test',
          pitch: 'Test',
          pricing: '$10',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('offer_type')
    })

    it('accepts valid offer_type values', async () => {
      const validTypes = ['audit', 'subscription', 'one_time', 'retainer', 'package']

      for (const offerType of validTypes) {
        jest.clearAllMocks()

        const chain: any = {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: '1', name: 'Test', offer_type: offerType },
                error: null,
              }),
            }),
          }),
        }

        mockFrom.mockReturnValue(chain)

        const { POST } = require('@/app/api/offers/route')
        const request = new Request('http://localhost/api/offers', {
          method: 'POST',
          body: JSON.stringify({
            name: `Test ${offerType}`,
            offer_type: offerType,
            headline: 'Test',
            pitch: 'Test',
            pricing: '$10',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const response = await POST(request as any)
        expect(response.status).toBe(201)
      }
    })

    it('defaults optional fields when not provided', async () => {
      const chain: any = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: '1', name: 'Test', objection_handlers: [], qualifying_questions: [], ideal_niches: [] },
              error: null,
            }),
          }),
        }),
      }

      mockFrom.mockReturnValue(chain)

      const { POST } = require('@/app/api/offers/route')
      const request = new Request('http://localhost/api/offers', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Basic Offer',
          offer_type: 'audit',
          headline: 'Test',
          pitch: 'Test',
          pricing: '$100',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      expect(response.status).toBe(201)

      // Verify insert was called with default arrays
      const insertCall = chain.insert.mock.calls[0][0]
      expect(insertCall.objection_handlers).toEqual([])
      expect(insertCall.qualifying_questions).toEqual([])
      expect(insertCall.ideal_niches).toEqual([])
    })
  })

  describe('POST /api/offers/match', () => {
    it('returns ranked offers for a business', async () => {
      const mockBusiness = {
        id: 'biz_1',
        name: "Joe's Dental",
        niche: 'dentist',
        rating: 3.2,
        review_count: 5,
        website: null,
      }

      const mockOffers = [
        { id: 'off_1', name: 'AI Phone Pro', offer_type: 'subscription', active: true, ideal_niches: ['dentist'], headline: 'Test', pricing: '$497' },
        { id: 'off_2', name: 'Review Booster', offer_type: 'audit', active: true, ideal_niches: ['all'], headline: 'Test', pricing: '$297' },
      ]

      mockFrom.mockImplementation((table: string) => {
        if (table === 'localreach_businesses') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockBusiness, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'localreach_offers') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockOffers, error: null }),
            }),
          } as any
        }
        return { select: jest.fn().mockReturnThis() } as any
      })

      const { POST } = require('@/app/api/offers/match/route')
      const request = new Request('http://localhost/api/offers/match', {
        method: 'POST',
        body: JSON.stringify({ businessId: 'biz_1' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.businessId).toBe('biz_1')
      expect(data.matches).toBeDefined()
      expect(data.matches.length).toBeGreaterThan(0)

      // Dentist niche match should score higher
      const dentistMatch = data.matches.find((m: any) => m.offerName === 'AI Phone Pro')
      expect(dentistMatch).toBeDefined()
      expect(dentistMatch.score).toBeGreaterThan(0)
      expect(dentistMatch.reasons.length).toBeGreaterThan(0)
    })

    it('returns 400 when businessId is missing', async () => {
      const { POST } = require('@/app/api/offers/match/route')
      const request = new Request('http://localhost/api/offers/match', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      expect(response.status).toBe(400)
    })

    it('returns 404 when business not found', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
          }),
        }),
      } as any)

      const { POST } = require('@/app/api/offers/match/route')
      const request = new Request('http://localhost/api/offers/match', {
        method: 'POST',
        body: JSON.stringify({ businessId: 'nonexistent' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      expect(response.status).toBe(404)
    })

    it('returns empty matches when no active offers exist', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'localreach_businesses') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'biz_1', name: 'Test' }, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'localreach_offers') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any
        }
        return { select: jest.fn().mockReturnThis() } as any
      })

      const { POST } = require('@/app/api/offers/match/route')
      const request = new Request('http://localhost/api/offers/match', {
        method: 'POST',
        body: JSON.stringify({ businessId: 'biz_1' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.matches).toEqual([])
    })

    it('scores low-rated businesses higher for reputation offers', async () => {
      const lowRatedBiz = {
        id: 'biz_low',
        name: 'Bad Reviews Inc',
        niche: 'plumber',
        rating: 2.1,
        review_count: 3,
        website: null,
      }

      const offers = [
        { id: 'off_1', name: 'Review Booster', offer_type: 'audit', active: true, ideal_niches: ['plumber'], headline: 'Test', pricing: '$297' },
      ]

      mockFrom.mockImplementation((table: string) => {
        if (table === 'localreach_businesses') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: lowRatedBiz, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'localreach_offers') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: offers, error: null }),
            }),
          } as any
        }
        return { select: jest.fn().mockReturnThis() } as any
      })

      const { POST } = require('@/app/api/offers/match/route')
      const request = new Request('http://localhost/api/offers/match', {
        method: 'POST',
        body: JSON.stringify({ businessId: 'biz_low' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      const match = data.matches[0]
      // Low rating (2.1) + few reviews (3) + no website + niche match + audit bonus = high score
      expect(match.score).toBeGreaterThanOrEqual(40)
      expect(match.reasons.some((r: string) => r.includes('Low rating'))).toBe(true)
    })
  })
})
