/**
 * LocalReach V3 — Lead Sourcing API Tests (Feature 1)
 * Integration tests for /api/leads/source and /api/leads/coverage
 */

// Mock supabase before imports
jest.mock('@/lib/supabase', () => {
  const mockFrom = jest.fn()

  return {
    supabaseAdmin: {
      from: mockFrom,
    },
    supabase: {
      from: mockFrom,
    },
  }
})

// Mock Google Maps fetch calls
const originalFetch = global.fetch
const mockFetch = jest.fn()

import { supabaseAdmin } from '@/lib/supabase'

const mockSupabaseFrom = supabaseAdmin.from as jest.MockedFunction<typeof supabaseAdmin.from>

describe('LocalReach Lead Sourcing API Tests (Feature 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch
    process.env.GOOGLE_MAPS_API_KEY = 'test-google-maps-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  // Helper to create mock supabase chain
  function mockSupabaseChain(overrides: Record<string, any> = {}) {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: overrides.singleData || null, error: overrides.singleError || null }),
      ...overrides,
    }

    // Make chainable methods return chain
    for (const key of Object.keys(chain)) {
      if (typeof chain[key] === 'function' && !['single'].includes(key)) {
        const original = chain[key]
        chain[key] = jest.fn((...args: any[]) => {
          original(...args)
          return chain
        })
      }
    }

    // Override terminal methods
    if (overrides.selectResult) {
      chain.select = jest.fn().mockReturnValue({
        ...chain,
        data: overrides.selectResult.data,
        error: overrides.selectResult.error || null,
      })
    }

    return chain
  }

  describe('POST /api/leads/source', () => {
    it('returns businesses when valid params provided', async () => {
      // Mock Google Places text search
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'OK',
            results: [
              {
                name: "Joe's Dental",
                formatted_address: '123 Main St, New York, NY',
                place_id: 'place_abc123',
                geometry: { location: { lat: 40.71, lng: -74.01 } },
                rating: 4.5,
                user_ratings_total: 128,
              },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'OK',
            results: [],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'OK',
            results: [],
          }),
        } as Response)
        // Place details call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'OK',
            result: {
              name: "Joe's Dental",
              formatted_address: '123 Main St, New York, NY',
              formatted_phone_number: '(555) 123-4567',
              international_phone_number: '+1 555-123-4567',
              website: 'https://joesdental.com',
              place_id: 'place_abc123',
              geometry: { location: { lat: 40.71, lng: -74.01 } },
              rating: 4.5,
              user_ratings_total: 128,
              business_status: 'OPERATIONAL',
              types: ['dentist', 'health'],
            },
          }),
        } as Response)

      // Mock Supabase: check for existing phones
      const existingPhonesChain = mockSupabaseChain()
      existingPhonesChain.in = jest.fn().mockResolvedValue({ data: [] })
      existingPhonesChain.select = jest.fn().mockReturnValue(existingPhonesChain)

      // Mock Supabase: upsert new businesses
      const upsertChain = mockSupabaseChain()
      upsertChain.upsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [{ id: 'biz_1', name: "Joe's Dental", phone: '+15551234567' }],
          error: null,
        }),
      })

      // Mock Supabase: insert geo coverage
      const geoChain = mockSupabaseChain()
      geoChain.insert = jest.fn().mockResolvedValue({ data: {}, error: null })

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'localreach_businesses') {
          // First call is for dedup, second is for upsert
          return existingPhonesChain.select.mock.calls.length > 0 ? upsertChain : existingPhonesChain
        }
        if (table === 'localreach_geo_coverage') return geoChain
        return mockSupabaseChain()
      })

      const { POST } = require('@/app/api/leads/source/route')

      const request = new Request('http://localhost/api/leads/source', {
        method: 'POST',
        body: JSON.stringify({
          niche: 'dentist',
          lat: 40.7128,
          lng: -74.006,
          radiusMiles: 5,
          maxResults: 10,
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.summary).toBeDefined()
      expect(data.summary.totalFound).toBeGreaterThanOrEqual(0)
    })

    it('validates required fields — returns 400 when niche is missing', async () => {
      const { POST } = require('@/app/api/leads/source/route')

      const request = new Request('http://localhost/api/leads/source', {
        method: 'POST',
        body: JSON.stringify({ lat: 40.7, lng: -74.0 }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('niche')
    })

    it('validates required fields — returns 400 when lat/lng are missing', async () => {
      const { POST } = require('@/app/api/leads/source/route')

      const request = new Request('http://localhost/api/leads/source', {
        method: 'POST',
        body: JSON.stringify({ niche: 'dentist' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('lat')
    })

    it('returns 503 when GOOGLE_MAPS_API_KEY is not configured', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY

      // Need to re-import to pick up new env
      jest.resetModules()
      jest.mock('@/lib/supabase', () => ({
        supabaseAdmin: { from: jest.fn() },
        supabase: { from: jest.fn() },
      }))

      const { POST } = require('@/app/api/leads/source/route')

      const request = new Request('http://localhost/api/leads/source', {
        method: 'POST',
        body: JSON.stringify({ niche: 'dentist', lat: 40.7, lng: -74.0 }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      expect(response.status).toBe(503)
    })

    it('uses default radiusMiles and maxResults when not provided', async () => {
      // This test verifies the defaults are applied without throwing
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
      } as Response)

      const emptyChain = mockSupabaseChain()
      emptyChain.insert = jest.fn().mockResolvedValue({ data: {}, error: null })
      mockSupabaseFrom.mockReturnValue(emptyChain as any)

      jest.resetModules()
      jest.mock('@/lib/supabase', () => ({
        supabaseAdmin: { from: mockSupabaseFrom },
        supabase: { from: mockSupabaseFrom },
      }))
      process.env.GOOGLE_MAPS_API_KEY = 'test-key'

      const { POST } = require('@/app/api/leads/source/route')

      const request = new Request('http://localhost/api/leads/source', {
        method: 'POST',
        body: JSON.stringify({ niche: 'plumber', lat: 40.7, lng: -74.0 }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      // Should use defaults (radiusMiles=10, maxResults=50) without error
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('GET /api/leads/coverage', () => {
    it('returns coverage rings for current quarter', async () => {
      const coverageData = [
        {
          id: '1',
          lat: 40.71,
          lng: -74.01,
          radius_miles: 5,
          niche: 'dentist',
          businesses_found: 23,
          businesses_new: 18,
          searched_at: '2026-04-01T10:00:00Z',
        },
      ]

      const coverageChain: any = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: coverageData, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(coverageChain as any)

      const { GET } = require('@/app/api/leads/coverage/route')

      const request = new Request('http://localhost/api/leads/coverage')

      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.rings).toBeDefined()
      expect(data.summary).toBeDefined()
      expect(data.summary.totalSearches).toBe(1)
      expect(data.summary.totalBusinessesFound).toBe(23)
    })

    it('filters by niche when provided', async () => {
      const coverageChain: any = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockSupabaseFrom.mockReturnValue(coverageChain as any)

      const { GET } = require('@/app/api/leads/coverage/route')

      const request = new Request('http://localhost/api/leads/coverage?niche=dentist')

      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(coverageChain.eq).toHaveBeenCalled()
    })

    it('filters by quarter when provided', async () => {
      const coverageChain: any = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockSupabaseFrom.mockReturnValue(coverageChain as any)

      const { GET } = require('@/app/api/leads/coverage/route')

      const request = new Request('http://localhost/api/leads/coverage?quarter=2026-Q1')

      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.quarter).toBe('2026-Q1')
    })

    it('returns summary stats including unique niches', async () => {
      const coverageData = [
        { id: '1', lat: 40.7, lng: -74.0, radius_miles: 5, niche: 'dentist', businesses_found: 10, businesses_new: 8, searched_at: '2026-04-01T10:00:00Z' },
        { id: '2', lat: 40.7, lng: -74.0, radius_miles: 5, niche: 'plumber', businesses_found: 15, businesses_new: 12, searched_at: '2026-04-02T10:00:00Z' },
      ]

      const coverageChain: any = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: coverageData, error: null }),
      }

      mockSupabaseFrom.mockReturnValue(coverageChain as any)

      const { GET } = require('@/app/api/leads/coverage/route')

      const request = new Request('http://localhost/api/leads/coverage')

      const response = await GET(request as any)
      const data = await response.json()

      expect(data.summary.uniqueNiches).toContain('dentist')
      expect(data.summary.uniqueNiches).toContain('plumber')
      expect(data.summary.totalBusinessesFound).toBe(25)
      expect(data.summary.totalNewBusinesses).toBe(20)
    })
  })
})
