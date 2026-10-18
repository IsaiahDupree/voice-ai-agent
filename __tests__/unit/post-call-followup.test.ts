/**
 * Post-call follow-up workflow tests.
 *
 * Locks the agency-facing audit story:
 *   high-score lead → SMS queued, log row 'queued'
 *   no_action / do_not_contact → skipped 'unsupported_action'
 *   no caller phone → skipped 'no_phone'
 *   internal DNC hit → skipped 'on_dnc'
 *   tenant disabled → skipped 'tenant_disabled'
 *   already-sent → skipped 'already_sent', no duplicate log
 */

let dncRows: any[] = []
let priorFollowups: any[] = []
let tenantSettings: any = {}
const inserted: any[] = []
const smsCalls: any[] = []

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => fakeFrom(table)),
  },
}))

jest.mock('@/lib/sms-helpers', () => ({
  sendSingleSMS: jest.fn(async (params: any) => {
    smsCalls.push(params)
    return { success: true, scheduled: true, message_sid: `sms_${smsCalls.length}` }
  }),
}))

function fakeFrom(table: string) {
  const builder: any = {
    _table: table,
    _filters: {} as Record<string, unknown>,
    _filterRefinements: [] as Array<{ k: string; v: unknown }>,
    select: jest.fn().mockImplementation(() => builder),
    eq: jest.fn().mockImplementation((col: string, val: unknown) => {
      builder._filters[col] = val
      return builder
    }),
    neq: jest.fn().mockImplementation(() => builder),
    filter: jest.fn().mockImplementation((col: string, _op: string, val: unknown) => {
      builder._filterRefinements.push({ k: col, v: val })
      return builder
    }),
    insert: jest.fn().mockImplementation((row: any) => {
      inserted.push({ table, row })
      return Promise.resolve({ data: row, error: null })
    }),
    limit: jest.fn().mockImplementation(async () => {
      if (table === 'voice_agent_function_calls') {
        const phoneFilter = builder._filterRefinements.find((r: any) => r.k === 'parameters->>phone')
        const onDnc = phoneFilter && dncRows.some((r: any) => r.phone === phoneFilter.v)
        return { data: onDnc ? [{ id: 'dnc_1' }] : [], error: null }
      }
      if (table === 'post_call_followups') {
        const callId = builder._filters.call_id
        const dup = priorFollowups.filter((f: any) => f.call_id === callId)
        return { data: dup, error: null }
      }
      return { data: [], error: null }
    }),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (table === 'tenant_configs') return { data: { persona_name: 'x' }, error: null }
      if (table === 'tenants') return { data: { settings: tenantSettings }, error: null }
      return { data: null, error: null }
    }),
  }
  return builder
}

import { runPostCallFollowup } from '@/lib/post-call-followup'

beforeEach(() => {
  dncRows = []
  priorFollowups = []
  tenantSettings = {}
  inserted.length = 0
  smsCalls.length = 0
})

function ctx(overrides: any = {}) {
  return {
    callId: 'c_1',
    tenantId: 't_1',
    packSlug: 'home_services',
    callerPhone: '+15551234567',
    callerName: 'Jane Doe',
    businessName: 'Smith Roofing',
    leadScore: 78,
    nextAction: 'transfer_to_closer' as const,
    ...overrides,
  }
}

describe('runPostCallFollowup', () => {
  it('queues an SMS and logs a queued row for transfer_to_closer', async () => {
    const r = await runPostCallFollowup(ctx())
    expect(r.status).toBe('queued')
    expect(r.template_name).toBe('post_call_closer_alert')
    expect(r.rendered_body).toContain('Jane') // first name only
    expect(r.rendered_body).toContain('Smith Roofing')
    expect(smsCalls).toHaveLength(1)
    expect(smsCalls[0].to).toBe('+15551234567')
    expect(smsCalls[0].scheduled_for).toBeDefined()

    const log = inserted.find(i => i.table === 'post_call_followups')
    expect(log).toBeDefined()
    expect(log.row.status).toBe('queued')
    expect(log.row.next_action).toBe('transfer_to_closer')
    expect(log.row.lead_score).toBe(78)
  })

  it('skips no_action without sending', async () => {
    const r = await runPostCallFollowup(ctx({ nextAction: 'no_action' }))
    expect(r.status).toBe('skipped')
    expect(r.skip_reason).toBe('unsupported_action')
    expect(smsCalls).toHaveLength(0)
  })

  it('skips do_not_contact', async () => {
    const r = await runPostCallFollowup(ctx({ nextAction: 'do_not_contact' }))
    expect(r.status).toBe('skipped')
    expect(r.skip_reason).toBe('unsupported_action')
    expect(smsCalls).toHaveLength(0)
  })

  it('skips when no callerPhone', async () => {
    const r = await runPostCallFollowup(ctx({ callerPhone: null }))
    expect(r.status).toBe('skipped')
    expect(r.skip_reason).toBe('no_phone')
    const log = inserted.find(i => i.table === 'post_call_followups')
    expect(log.row.skip_reason).toBe('no_phone')
  })

  it('skips when caller is on internal DNC', async () => {
    dncRows = [{ phone: '+15551234567' }]
    const r = await runPostCallFollowup(ctx())
    expect(r.status).toBe('skipped')
    expect(r.skip_reason).toBe('on_dnc')
    expect(smsCalls).toHaveLength(0)
  })

  it('skips when tenant has post_call_followups_disabled=true', async () => {
    tenantSettings = { post_call_followups_disabled: true }
    const r = await runPostCallFollowup(ctx())
    expect(r.status).toBe('skipped')
    expect(r.skip_reason).toBe('tenant_disabled')
    expect(smsCalls).toHaveLength(0)
  })

  it('skips already_sent and does NOT write a duplicate log', async () => {
    priorFollowups = [{ id: 'f_1', call_id: 'c_1' }]
    const r = await runPostCallFollowup(ctx())
    expect(r.status).toBe('skipped')
    expect(r.skip_reason).toBe('already_sent')
    expect(smsCalls).toHaveLength(0)
    // No new log written for the dup — only the original counts.
    const dupLogs = inserted.filter(i => i.table === 'post_call_followups')
    expect(dupLogs).toHaveLength(0)
  })

  it('renders schedule_estimate template with first name and business', async () => {
    const r = await runPostCallFollowup(ctx({ nextAction: 'schedule_estimate' }))
    expect(r.status).toBe('queued')
    expect(r.template_name).toBe('post_call_estimate')
    expect(r.rendered_body).toContain('Jane')
    expect(r.rendered_body).toContain('Smith Roofing')
    expect(r.rendered_body).toContain('estimate')
  })

  it('falls back to "there" when callerName is missing', async () => {
    const r = await runPostCallFollowup(ctx({ callerName: null, nextAction: 'send_quote_sms' }))
    expect(r.rendered_body).toMatch(/Hi there/)
  })

  it('schedules the send with a non-zero delay', async () => {
    const before = Date.now()
    const r = await runPostCallFollowup(ctx({ nextAction: 'send_quote_sms' }))
    const at = new Date(r.scheduled_for).getTime()
    expect(at).toBeGreaterThan(before)
  })
})
