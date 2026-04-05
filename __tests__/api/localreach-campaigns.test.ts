/**
 * LocalReach V3 — Campaign API Tests (Feature 4)
 * Tests for /api/campaigns/localreach CRUD, pause, resume, and dial quota enforcement.
 */

jest.mock('@/lib/supabase', () => {
  const mockFrom = jest.fn()
  return {
    supabaseAdmin: { from: mockFrom },
    supabase: { from: mockFrom },
  }
})

jest.mock('@/lib/localreach/calling-engine', () => ({
  dialNextBusiness: jest.fn(),
}))

import { supabaseAdmin } from '@/lib/supabase'
import { dialNextBusiness } from '@/lib/localreach/calling-engine'

const mockFrom = supabaseAdmin.from as jest.MockedFunction<typeof supabaseAdmin.from>
const mockDialNext = dialNextBusiness as jest.MockedFunction<typeof dialNextBusiness>

describe('LocalReach Campaign API Tests (Feature 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/campaigns/localreach — create campaign', () => {
    it('creates campaign with required fields', async () => {
      const createdCampaign = {
        id: 'camp_1',
        name: 'Dentist Outreach Q2',
        niche: 'dentist',
        status: 'draft',
        created_at: '2026-04-05T00:00:00Z',
      }

      // First call: insert campaign. Second call: insert stats.
      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        if (table === 'localreach_campaigns') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: createdCampaign, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'localreach_campaign_stats') {
          return {
            insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
          } as any
        }
        return { insert: jest.fn().mockResolvedValue({ data: {}, error: null }) } as any
      })

      const { POST } = require('@/app/api/campaigns/localreach/route')
      const request = new Request('http://localhost/api/campaigns/localreach', {
        method: 'POST',
        body: JSON.stringify({ name: 'Dentist Outreach Q2', niche: 'dentist' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.campaign.name).toBe('Dentist Outreach Q2')
      expect(data.campaign.status).toBe('draft')
    })

    it('returns 400 when name is missing', async () => {
      const { POST } = require('@/app/api/campaigns/localreach/route')
      const request = new Request('http://localhost/api/campaigns/localreach', {
        method: 'POST',
        body: JSON.stringify({ niche: 'dentist' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      expect(response.status).toBe(400)
    })

    it('returns 400 when niche is missing', async () => {
      const { POST } = require('@/app/api/campaigns/localreach/route')
      const request = new Request('http://localhost/api/campaigns/localreach', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Campaign' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any)
      expect(response.status).toBe(400)
    })

    it('uses default calling hours and quota when not specified', async () => {
      const chain: any = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
          }),
        }),
      }

      mockFrom.mockReturnValue(chain)

      const { POST } = require('@/app/api/campaigns/localreach/route')
      const request = new Request('http://localhost/api/campaigns/localreach', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', niche: 'plumber' }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      const insertData = chain.insert.mock.calls[0][0]
      expect(insertData.calling_hours.start).toBe('09:00')
      expect(insertData.calling_hours.end).toBe('17:00')
      expect(insertData.max_calls_per_day).toBe(50)
      expect(insertData.schedule_days).toEqual([1, 2, 3, 4, 5])
    })

    it('initializes campaign stats row after creation', async () => {
      const insertCalls: string[] = []

      mockFrom.mockImplementation((table: string) => {
        insertCalls.push(table)
        if (table === 'localreach_campaigns') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'camp_new' }, error: null }),
              }),
            }),
          } as any
        }
        return {
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        } as any
      })

      const { POST } = require('@/app/api/campaigns/localreach/route')
      const request = new Request('http://localhost/api/campaigns/localreach', {
        method: 'POST',
        body: JSON.stringify({ name: 'Stats Test', niche: 'hvac' }),
        headers: { 'Content-Type': 'application/json' },
      })

      await POST(request as any)

      expect(insertCalls).toContain('localreach_campaign_stats')
    })
  })

  describe('GET /api/campaigns/localreach — list campaigns', () => {
    it('lists campaigns with stats', async () => {
      const campaigns = [
        { id: 'camp_1', name: 'Dentist Q2', niche: 'dentist', status: 'active', created_at: '2026-04-01' },
      ]

      const stats = [
        { campaign_id: 'camp_1', total_dialed: 45, connected: 12, appointments: 3, voicemails: 20, no_answer: 10, refused: 0, last_dialed_at: '2026-04-05T14:00:00Z' },
      ]

      mockFrom.mockImplementation((table: string) => {
        if (table === 'localreach_campaigns') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ data: campaigns, error: null, count: 1 }),
                }),
              }),
            }),
          } as any
        }
        if (table === 'localreach_campaign_stats') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: stats, error: null }),
            }),
          } as any
        }
        return { select: jest.fn().mockReturnThis() } as any
      })

      const { GET } = require('@/app/api/campaigns/localreach/route')
      const request = new Request('http://localhost/api/campaigns/localreach')
      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.campaigns).toHaveLength(1)
      expect(data.campaigns[0].stats.totalDialed).toBe(45)
    })

    it('returns pagination metadata', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'localreach_campaigns') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
                }),
              }),
            }),
          } as any
        }
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      })

      const { GET } = require('@/app/api/campaigns/localreach/route')
      const request = new Request('http://localhost/api/campaigns/localreach?limit=10&offset=0')
      const response = await GET(request as any)
      const data = await response.json()

      expect(data.pagination).toBeDefined()
      expect(data.pagination.limit).toBe(10)
    })
  })

  describe('POST /api/campaigns/localreach/[id]/pause', () => {
    it('pauses an active campaign', async () => {
      mockFrom.mockImplementation(() => {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'camp_1', status: 'active', name: 'Test Campaign' },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'camp_1', status: 'paused', name: 'Test Campaign' },
                  error: null,
                }),
              }),
            }),
          }),
        } as any
      })

      const { POST } = require('@/app/api/campaigns/localreach/[id]/pause/route')
      const request = new Request('http://localhost/api/campaigns/localreach/camp_1/pause', { method: 'POST' })
      const response = await POST(request as any, { params: { id: 'camp_1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.campaign.status).toBe('paused')
    })

    it('returns 409 when campaign is already paused', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'camp_1', status: 'paused', name: 'Test' },
              error: null,
            }),
          }),
        }),
      } as any)

      const { POST } = require('@/app/api/campaigns/localreach/[id]/pause/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { id: 'camp_1' } })

      expect(response.status).toBe(409)
    })

    it('returns 404 when campaign does not exist', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'not found' },
            }),
          }),
        }),
      } as any)

      const { POST } = require('@/app/api/campaigns/localreach/[id]/pause/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { id: 'nonexistent' } })

      expect(response.status).toBe(404)
    })
  })

  describe('POST /api/campaigns/localreach/[id]/resume', () => {
    it('resumes a paused campaign', async () => {
      mockFrom.mockImplementation(() => {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'camp_1', status: 'paused', name: 'Test' },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'camp_1', status: 'active', name: 'Test' },
                  error: null,
                }),
              }),
            }),
          }),
        } as any
      })

      const { POST } = require('@/app/api/campaigns/localreach/[id]/resume/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { id: 'camp_1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.campaign.status).toBe('active')
    })

    it('returns 409 when campaign is already active', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'camp_1', status: 'active', name: 'Test' },
              error: null,
            }),
          }),
        }),
      } as any)

      const { POST } = require('@/app/api/campaigns/localreach/[id]/resume/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { id: 'camp_1' } })

      expect(response.status).toBe(409)
    })

    it('returns 409 when campaign is archived', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'camp_1', status: 'archived', name: 'Test' },
              error: null,
            }),
          }),
        }),
      } as any)

      const { POST } = require('@/app/api/campaigns/localreach/[id]/resume/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { id: 'camp_1' } })

      expect(response.status).toBe(409)
    })
  })

  describe('POST /api/campaigns/localreach/[id]/dial — daily quota', () => {
    it('enforces daily quota and returns 429', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'localreach_campaigns') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'camp_1',
                    status: 'active',
                    max_calls_per_day: 50,
                    calling_hours: { start: '00:00', end: '23:59', timezone: 'UTC' },
                  },
                  error: null,
                }),
              }),
            }),
          } as any
        }
        if (table === 'localreach_call_log') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({ count: 50, error: null }),
              }),
            }),
          } as any
        }
        return { select: jest.fn().mockReturnThis() } as any
      })

      const { POST } = require('@/app/api/campaigns/localreach/[id]/dial/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { id: 'camp_1' } })

      expect(response.status).toBe(429)
      const data = await response.json()
      expect(data.error).toContain('quota')
    })

    it('returns 409 when campaign is not active', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'camp_1', status: 'paused' },
              error: null,
            }),
          }),
        }),
      } as any)

      const { POST } = require('@/app/api/campaigns/localreach/[id]/dial/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { id: 'camp_1' } })

      expect(response.status).toBe(409)
    })
  })
})
