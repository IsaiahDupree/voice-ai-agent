/**
 * LocalReach V3 — Compliance API Tests (Feature 8)
 * Tests for /api/compliance/check/[phone] and /api/compliance/suppress/[phone]
 */

jest.mock('@/lib/supabase', () => {
  const mockFrom = jest.fn()
  return {
    supabaseAdmin: { from: mockFrom },
    supabase: { from: mockFrom },
  }
})

jest.mock('@/lib/sms', () => ({
  formatE164: (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
    return `+${digits}`
  },
  validatePhoneNumber: (phone: string) => {
    return /^\+1\d{10}$/.test(phone)
  },
  sendSMS: jest.fn(),
}))

import { supabaseAdmin } from '@/lib/supabase'

const mockFrom = supabaseAdmin.from as jest.MockedFunction<typeof supabaseAdmin.from>

describe('LocalReach Compliance API Tests (Feature 8)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Helper to mock multiple Supabase table calls
  function setupMockTables(config: Record<string, any>) {
    mockFrom.mockImplementation((table: string) => {
      if (config[table]) return config[table]

      // Default: return empty result for unknown tables
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            gte: jest.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      } as any
    })
  }

  describe('POST /api/compliance/check/[phone]', () => {
    it('returns compliance result for a clean phone number', async () => {
      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_dnc: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_sms_opt_outs: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_blocklist: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        localreach_call_log: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        },
        localreach_compliance_log: {
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
      })

      const { POST } = require('@/app/api/compliance/check/[phone]/route')
      const request = new Request('http://localhost/api/compliance/check/+15551234567', { method: 'POST' })
      const response = await POST(request as any, { params: { phone: '+15551234567' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.phone).toBe('+15551234567')
      expect(data.compliance).toBeDefined()
      expect(data.compliance.checks).toBeDefined()
      expect(data.compliance.checks.suppression).toBeDefined()
      expect(data.compliance.checks.dnc).toBeDefined()
    })

    it('returns allowed: true when all checks pass during business hours', async () => {
      // Mock Date to be within calling hours (10 AM)
      const realDate = Date
      const mockDate = new Date('2026-04-05T10:00:00')
      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) return mockDate
        // @ts-ignore
        return new realDate(...args)
      })

      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_dnc: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_sms_opt_outs: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_blocklist: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        localreach_call_log: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }),
        },
        localreach_compliance_log: {
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
      })

      const { POST } = require('@/app/api/compliance/check/[phone]/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { phone: '+15559876543' } })
      const data = await response.json()

      expect(data.compliance.allowed).toBe(true)
      expect(data.compliance.reason).toContain('All compliance checks passed')

      jest.restoreAllMocks()
    })

    it('returns allowed: false when phone is on suppression list', async () => {
      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: '1', reason: 'DNC requested', added_at: '2026-03-01T00:00:00Z' },
                error: null,
              }),
            }),
          }),
        },
        voice_agent_dnc: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_sms_opt_outs: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_blocklist: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        localreach_call_log: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        },
        localreach_compliance_log: {
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
      })

      const { POST } = require('@/app/api/compliance/check/[phone]/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { phone: '+15551234567' } })
      const data = await response.json()

      expect(data.compliance.allowed).toBe(false)
      expect(data.compliance.checks.suppression.passed).toBe(false)
    })

    it('returns allowed: false when TCPA call frequency exceeded', async () => {
      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_dnc: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_sms_opt_outs: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_blocklist: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        localreach_call_log: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ count: 4, error: null }),
            }),
          }),
        },
        localreach_compliance_log: {
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
      })

      const { POST } = require('@/app/api/compliance/check/[phone]/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { phone: '+15551234567' } })
      const data = await response.json()

      expect(data.compliance.allowed).toBe(false)
      expect(data.compliance.checks.callFrequency.passed).toBe(false)
      expect(data.compliance.checks.callFrequency.detail).toContain('TCPA limit')
    })

    it('logs every compliance check to localreach_compliance_log', async () => {
      const insertMock = jest.fn().mockResolvedValue({ data: {}, error: null })

      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_dnc: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_sms_opt_outs: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_blocklist: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        localreach_call_log: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        },
        localreach_compliance_log: {
          insert: insertMock,
        },
      })

      const { POST } = require('@/app/api/compliance/check/[phone]/route')
      const request = new Request('http://localhost', { method: 'POST' })
      await POST(request as any, { params: { phone: '+15551234567' } })

      expect(insertMock).toHaveBeenCalledTimes(1)
      const logEntry = insertMock.mock.calls[0][0]
      expect(logEntry.phone).toBe('+15551234567')
      expect(logEntry.checked_at).toBeDefined()
    })
  })

  describe('POST /api/compliance/suppress/[phone]', () => {
    it('adds phone to suppression list', async () => {
      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'sup_1', phone: '+15551234567', reason: 'manual_suppression' },
            error: null,
          }),
        }),
      })

      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: insertMock,
        },
        voice_agent_dnc: {
          upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
      })

      const { POST } = require('@/app/api/compliance/suppress/[phone]/route')
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ reason: 'customer_request' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any, { params: { phone: '+15551234567' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.alreadySuppressed).toBe(false)
    })

    it('returns success with alreadySuppressed: true for duplicate', async () => {
      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
            }),
          }),
        },
      })

      const { POST } = require('@/app/api/compliance/suppress/[phone]/route')
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request as any, { params: { phone: '+15551234567' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.alreadySuppressed).toBe(true)
    })

    it('suppressed phone returns allowed: false on subsequent compliance check', async () => {
      // First: suppress the number
      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: '1', phone: '+15551234567' },
                error: null,
              }),
            }),
          }),
        },
        voice_agent_dnc: {
          upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
      })

      const { POST: suppressPOST } = require('@/app/api/compliance/suppress/[phone]/route')
      const suppressReq = new Request('http://localhost', { method: 'POST' })
      await suppressPOST(suppressReq as any, { params: { phone: '+15551234567' } })

      // Now check compliance: suppressed phone should fail
      jest.clearAllMocks()
      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: '1', reason: 'manual_suppression', added_at: '2026-04-05T00:00:00Z' },
                error: null,
              }),
            }),
          }),
        },
        voice_agent_dnc: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_sms_opt_outs: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        voice_agent_blocklist: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        localreach_call_log: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        },
        localreach_compliance_log: {
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
      })

      const { POST: checkPOST } = require('@/app/api/compliance/check/[phone]/route')
      const checkReq = new Request('http://localhost', { method: 'POST' })
      const checkResponse = await checkPOST(checkReq as any, { params: { phone: '+15551234567' } })
      const checkData = await checkResponse.json()

      expect(checkData.compliance.allowed).toBe(false)
      expect(checkData.compliance.checks.suppression.passed).toBe(false)
    })

    it('also adds to global DNC list on suppression', async () => {
      const upsertMock = jest.fn().mockResolvedValue({ data: {}, error: null })

      setupMockTables({
        localreach_suppression_list: {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: '1', phone: '+15551234567' },
                error: null,
              }),
            }),
          }),
        },
        voice_agent_dnc: {
          upsert: upsertMock,
        },
      })

      const { POST } = require('@/app/api/compliance/suppress/[phone]/route')
      const request = new Request('http://localhost', { method: 'POST' })
      await POST(request as any, { params: { phone: '+15551234567' } })

      expect(upsertMock).toHaveBeenCalledTimes(1)
      const upsertData = upsertMock.mock.calls[0][0]
      expect(upsertData.phone_number).toBe('+15551234567')
    })

    it('returns 400 for invalid phone number', async () => {
      const { POST } = require('@/app/api/compliance/suppress/[phone]/route')
      const request = new Request('http://localhost', { method: 'POST' })
      const response = await POST(request as any, { params: { phone: '123' } })

      expect(response.status).toBe(400)
    })
  })
})
