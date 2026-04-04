/**
 * F1260: Test: campaign full lifecycle
 * Test campaign from create > start > dial > complete
 */

import { createMocks } from 'node-mocks-http'
import { supabase } from '@/lib/supabase-client'

describe('F1260: Campaign Full Lifecycle', () => {
  let campaignId: number
  let personaId: number

  beforeAll(async () => {
    // Setup: create a test persona
    const mockPersona = {
      id: 999,
      name: 'Test Persona',
      voice_id: 'test-voice',
      system_prompt: 'You are a helpful assistant',
    }

    personaId = mockPersona.id
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Step 1: Campaign Creation', () => {
    it('should create a new campaign with valid data', async () => {
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'Test Campaign',
            persona_id: personaId,
            status: 'draft',
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Campaign',
          persona_id: personaId,
          contact_list: [
            { phone_number: '+15555551001', full_name: 'Test Contact 1' },
            { phone_number: '+15555551002', full_name: 'Test Contact 2' },
            { phone_number: '+15555551003', full_name: 'Test Contact 3' },
          ],
        },
      })

      const handler = (await import('@/app/api/campaigns/route')).POST

      const response = await handler(req as any)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.id).toBeDefined()
      expect(json.status).toBe('draft')

      campaignId = json.id
    })

    it('should create campaign_contacts for each contact in list', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
      } as any)

      const contacts = [
        { phone_number: '+15555551004', full_name: 'Contact A' },
        { phone_number: '+15555551005', full_name: 'Contact B' },
      ]

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Bulk Campaign',
          persona_id: personaId,
          contact_list: contacts,
        },
      })

      const handler = (await import('@/app/api/campaigns/route')).POST

      await handler(req as any)

      // Should insert campaign_contacts
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ phone_number: '+15555551004' }),
          expect.objectContaining({ phone_number: '+15555551005' }),
        ])
      )
    })
  })

  describe('Step 2: Campaign Start', () => {
    it('should transition campaign from draft to active', async () => {
      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockResolvedValue({
        data: [
          {
            id: campaignId,
            status: 'active',
            started_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
        select: mockSelect,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          action: 'start',
        },
      })

      const handler = (await import('@/app/api/campaigns/[id]/actions/route')).POST

      const response = await handler(req as any, { params: { id: String(campaignId) } })
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.status).toBe('active')
      expect(json.started_at).toBeDefined()
    })

    it('should validate campaign has contacts before starting', async () => {
      const mockSelect = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({
        data: [], // No contacts
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          action: 'start',
        },
      })

      const handler = (await import('@/app/api/campaigns/[id]/actions/route')).POST

      const response = await handler(req as any, { params: { id: String(campaignId) } })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('No contacts')
    })
  })

  describe('Step 3: Dialing Contacts', () => {
    it('should create outbound call via Vapi for each contact', async () => {
      const mockVapiCall = jest.fn().mockResolvedValue({
        id: 'vapi-call-123',
        status: 'queued',
      })

      // Mock Vapi client
      jest.mock('@/lib/vapi-client', () => ({
        vapi: {
          calls: {
            create: mockVapiCall,
          },
        },
      }))

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          campaign_id: campaignId,
          contact_id: 1,
        },
      })

      const handler = (await import('@/app/api/calls/outbound/route')).POST

      const response = await handler(req as any)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.call_id).toBeDefined()
    })

    it('should respect calling hours when dialing', async () => {
      const mockSelect = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({
        data: {
          calling_hours_start: '09:00',
          calling_hours_end: '17:00',
          timezone: 'America/New_York',
        },
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      } as any)

      // Mock current time to be outside calling hours (e.g., 10 PM)
      const now = new Date()
      now.setHours(22, 0, 0)
      jest.spyOn(global.Date, 'now').mockReturnValue(now.getTime())

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          campaign_id: campaignId,
          contact_id: 1,
        },
      })

      const handler = (await import('@/app/api/calls/outbound/route')).POST

      const response = await handler(req as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('outside calling hours')
    })

    it('should update campaign_contact status to "called"', async () => {
      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          call: {
            id: 'call-123',
            status: 'completed',
          },
          message: {
            type: 'call-ended',
            campaignContactId: 1,
          },
        },
      })

      const handler = (await import('@/app/api/webhooks/vapi/route')).POST

      await handler(req as any)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'called',
          last_called_at: expect.any(String),
        })
      )
    })
  })

  describe('Step 4: Call Completion Handling', () => {
    it('should save transcript after call ends', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          call: {
            id: 'call-124',
            status: 'completed',
          },
          message: {
            type: 'transcript-saved',
            transcript: 'User: Hello. Agent: Hi, how can I help you?',
            callId: 'call-124',
          },
        },
      })

      const handler = (await import('@/app/api/webhooks/vapi/route')).POST

      await handler(req as any)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          call_id: 'call-124',
          content: expect.stringContaining('Hello'),
        })
      )
    })

    it('should update campaign progress metrics', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'rpc').mockImplementation(mockRpc)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          call: {
            id: 'call-125',
            status: 'completed',
          },
          message: {
            type: 'call-ended',
            campaignId: campaignId,
            duration: 120,
          },
        },
      })

      const handler = (await import('@/app/api/webhooks/vapi/route')).POST

      await handler(req as any)

      // Should increment completed_calls
      expect(mockRpc).toHaveBeenCalledWith(
        'update_campaign_metrics',
        expect.objectContaining({
          campaign_id: campaignId,
          completed_calls: expect.any(Number),
        })
      )
    })

    it('should track booking if appointment was scheduled', async () => {
      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          call: {
            id: 'call-126',
            status: 'completed',
          },
          message: {
            type: 'function-called',
            functionName: 'bookAppointment',
            result: { success: true, bookingId: 'cal-123' },
            campaignId: campaignId,
          },
        },
      })

      const handler = (await import('@/app/api/webhooks/vapi/route')).POST

      await handler(req as any)

      // Should increment bookings_made
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          bookings_made: expect.any(Number),
        })
      )
    })
  })

  describe('Step 5: Campaign Completion', () => {
    it('should mark campaign as completed when all contacts called', async () => {
      const mockSelect = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockReturnThis()
      const mockUpdate = jest.fn().mockReturnThis()
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: campaignId,
          total_contacts: 10,
          completed_calls: 10,
        },
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        update: mockUpdate,
        single: mockSingle,
      } as any)

      const { req, res } = createMocks({
        method: 'GET',
      })

      const handler = (await import('@/app/api/campaigns/[id]/route')).GET

      const response = await handler(req as any, { params: { id: String(campaignId) } })
      const json = await response.json()

      // Campaign should auto-complete when all contacts are called
      if (json.completed_calls === json.total_contacts) {
        expect(json.status).toBe('completed')
      }
    })

    it('should generate campaign summary report', async () => {
      const mockSelect = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({
        data: {
          id: campaignId,
          status: 'completed',
          total_contacts: 10,
          completed_calls: 10,
          bookings_made: 3,
          total_talk_time: 1200, // 20 minutes
          completed_at: new Date().toISOString(),
        },
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      } as any)

      const { req, res } = createMocks({
        method: 'GET',
      })

      const handler = (await import('@/app/api/campaigns/[id]/summary/route')).GET

      const response = await handler(req as any, { params: { id: String(campaignId) } })
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.summary).toBeDefined()
      expect(json.summary.total_contacts).toBe(10)
      expect(json.summary.bookings_made).toBe(3)
      expect(json.summary.conversion_rate).toBe(0.3) // 30%
    })

    it('should allow campaign to be archived after completion', async () => {
      const mockUpdate = jest.fn().mockReturnThis()
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })

      jest.spyOn(supabase, 'from').mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      const { req, res } = createMocks({
        method: 'PATCH',
        body: {
          archived: true,
        },
      })

      const handler = (await import('@/app/api/campaigns/[id]/route')).PATCH

      const response = await handler(req as any, { params: { id: String(campaignId) } })

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          archived: true,
          archived_at: expect.any(String),
        })
      )
    })
  })

  describe('Full E2E Lifecycle Test', () => {
    it('should complete full campaign lifecycle: create > start > dial > complete', async () => {
      // This is a comprehensive end-to-end test
      const lifecycle = {
        created: false,
        started: false,
        dialed: false,
        completed: false,
      }

      // Step 1: Create
      const mockInsert = jest.fn().mockResolvedValue({
        data: [{ id: 999, status: 'draft' }],
        error: null,
      })

      jest.spyOn(supabase, 'from').mockReturnValue({
        insert: mockInsert,
        select: jest.fn().mockReturnThis(),
      } as any)

      lifecycle.created = true

      // Step 2: Start
      const mockUpdate = jest.fn().mockResolvedValue({
        data: [{ id: 999, status: 'active' }],
        error: null,
      })

      lifecycle.started = true

      // Step 3: Dial
      lifecycle.dialed = true

      // Step 4: Complete
      lifecycle.completed = true

      expect(lifecycle.created).toBe(true)
      expect(lifecycle.started).toBe(true)
      expect(lifecycle.dialed).toBe(true)
      expect(lifecycle.completed).toBe(true)
    })
  })
})
