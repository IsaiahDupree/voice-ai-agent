/**
 * Owner digest tests.
 *
 * Locks the SMB-facing artifact:
 *   - buildDigestPayload sums outcomes correctly, dedupes by call_id,
 *     attaches agency branding when the tenant has one.
 *   - renderDigest produces an HTML body with the right numbers + a
 *     plain-text fallback that's safe for spam filters.
 *   - sendDigestForSubscription idempotency: success → last_sent_at
 *     advances; failure → digest_sends has status=failed.
 *   - listDueSubscriptions respects daily/weekly intervals.
 */

let tenantRow: any = null
let agencyRow: any = null
let outcomesRows: any[] = []
let followupRows: any[] = []
let subscriptions: any[] = []
const inserted: any[] = []
const updated: any[] = []
let emailSent: any = null
let emailShouldFail = false

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn((table: string) => fakeFrom(table)) },
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(async (params: any) => {
    if (emailShouldFail) return { success: false, error: 'resend_down' }
    emailSent = params
    return { success: true, data: { id: 'msg_1' } }
  }),
}))

function fakeFrom(table: string) {
  const builder: any = {
    _table: table,
    _filters: {} as Record<string, unknown>,
    select: jest.fn().mockImplementation(() => builder),
    eq: jest.fn().mockImplementation((c: string, v: unknown) => {
      builder._filters[c] = v
      return builder
    }),
    neq: jest.fn().mockImplementation((c: string, v: unknown) => {
      builder._filters[c + '_neq'] = v
      return builder
    }),
    gte: jest.fn().mockImplementation(() => builder),
    lte: jest.fn().mockImplementation(() => builder),
    gt: jest.fn().mockImplementation(() => builder),
    is: jest.fn().mockImplementation(() => builder),
    order: jest.fn().mockImplementation(() => builder),
    limit: jest.fn().mockImplementation(() => builder),
    insert: jest.fn().mockImplementation((row: any) => {
      inserted.push({ table, row })
      return Promise.resolve({ data: row, error: null })
    }),
    update: jest.fn().mockImplementation((patch: any) => {
      updated.push({ table, patch, filters: { ...builder._filters } })
      return builder
    }),
    upsert: jest.fn().mockImplementation((row: any) => {
      inserted.push({ table, row, op: 'upsert' })
      return Promise.resolve({ data: row, error: null })
    }),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (table === 'tenants') return { data: tenantRow, error: null }
      if (table === 'agencies') return { data: agencyRow, error: null }
      return { data: null, error: null }
    }),
    then: undefined as any,
  }
  builder.then = (resolve: any) => {
    if (table === 'call_outcomes') resolve({ data: outcomesRows, error: null })
    else if (table === 'post_call_followups') resolve({ data: followupRows, error: null })
    else if (table === 'digest_subscriptions') resolve({ data: subscriptions, error: null })
    else if (table === 'owner_portal_tokens') resolve({ data: [], error: null })
    else resolve({ data: [], error: null })
    return Promise.resolve()
  }
  return builder
}

import {
  buildDigestPayload,
  renderDigest,
} from '@/lib/owner-digest'
import {
  listDueSubscriptions,
  sendDigestForSubscription,
} from '@/lib/digest-sender'

beforeEach(() => {
  tenantRow = { id: 't_1', name: 'Acme', display_name: 'Acme Roofing', agency_id: 'a_1' }
  agencyRow = {
    id: 'a_1',
    slug: 'rocket-agency',
    name: 'Rocket Agency',
    primary_color: '#ff6600',
    contact_email: 'hi@rocket.test',
    logo_url: null,
    plan: 'starter',
    max_clients: 5,
    status: 'active',
    settings: {},
  }
  outcomesRows = []
  followupRows = []
  subscriptions = []
  inserted.length = 0
  updated.length = 0
  emailSent = null
  emailShouldFail = false
  jest.useRealTimers()
})

describe('buildDigestPayload', () => {
  it('rolls up outcomes, dedupes by call_id, attaches agency', async () => {
    outcomesRows = [
      { outcome: 'booked', revenue_estimate_cents: 8500, call_id: 'c1', lead_score: 72, next_action: 'no_action', pack_slug: 'home_services', metadata: {}, created_at: '2026-05-08T10:00:00Z' },
      { outcome: 'qualified_lead', revenue_estimate_cents: 5000, call_id: 'c1', lead_score: 80, next_action: 'transfer_to_closer', pack_slug: 'home_services', metadata: {}, created_at: '2026-05-08T10:01:00Z' },
      { outcome: 'missed_call_recovered', revenue_estimate_cents: 8500, call_id: 'c2', lead_score: null, next_action: null, pack_slug: 'home_services', metadata: {}, created_at: '2026-05-08T11:00:00Z' },
      { outcome: 'soa_captured', revenue_estimate_cents: 30000, call_id: 'c3', lead_score: 90, next_action: 'schedule_consultation', pack_slug: 'home_services', metadata: {}, created_at: '2026-05-08T12:00:00Z' },
    ]
    followupRows = [
      { status: 'sent' },
      { status: 'queued' },
      { status: 'skipped' },
      { status: 'skipped' },
    ]

    const p = await buildDigestPayload({ tenantId: 't_1', frequency: 'weekly' })
    expect(p).not.toBeNull()
    expect(p!.totalCalls).toBe(3) // c1 deduped
    expect(p!.bookedAppointments).toBe(1)
    expect(p!.qualifiedLeads).toBe(1)
    expect(p!.missedCallRecoveries).toBe(1)
    expect(p!.highValueLeads).toBe(2) // qualified_lead + soa_captured
    expect(p!.complianceGateHits).toBe(1) // soa_captured
    expect(p!.estRevenueCents).toBe(8500 + 5000 + 8500 + 30000)
    expect(p!.hotLeads).toBe(2) // c1 max=80, c3=90
    expect(p!.followups.sent).toBe(1)
    expect(p!.followups.queued).toBe(1)
    expect(p!.followups.skipped).toBe(2)
    expect(p!.agency?.name).toBe('Rocket Agency')
    expect(p!.tenantName).toBe('Acme Roofing')
    expect(p!.topNextActions[0].action).toBeDefined()
  })

  it('returns null when tenant not found', async () => {
    tenantRow = null
    const p = await buildDigestPayload({ tenantId: 'nope', frequency: 'weekly' })
    expect(p).toBeNull()
  })
})

describe('renderDigest', () => {
  it('renders subject with key numbers and embeds agency branding in HTML', async () => {
    outcomesRows = [
      { outcome: 'booked', revenue_estimate_cents: 8500, call_id: 'c1', lead_score: 80, next_action: 'no_action', pack_slug: 'home_services', metadata: {}, created_at: '2026-05-08T10:00:00Z' },
    ]
    const p = await buildDigestPayload({ tenantId: 't_1', frequency: 'weekly' })
    const r = renderDigest({ payload: p!, frequency: 'weekly' })
    expect(r.subject).toMatch(/Weekly update for Acme Roofing/)
    expect(r.subject).toMatch(/1 booked/)
    expect(r.html).toContain('Acme Roofing')
    expect(r.html).toContain('Rocket Agency')
    expect(r.html).toContain('#ff6600') // primary color
    expect(r.text).toContain('Acme Roofing')
    expect(r.text).toContain('Rocket Agency')
  })

  it('falls back gracefully when no agency is attached', async () => {
    tenantRow = { id: 't_2', name: 'Standalone', display_name: null, agency_id: null }
    agencyRow = null
    outcomesRows = []
    const p = await buildDigestPayload({ tenantId: 't_2', frequency: 'daily' })
    const r = renderDigest({ payload: p!, frequency: 'daily' })
    // brandName should fall back to the tenant name when agency is null.
    expect(r.html).toContain('Standalone')
    expect(r.subject).toMatch(/Daily update for Standalone/)
  })
})

describe('listDueSubscriptions', () => {
  it('marks daily as due once 22h have passed', async () => {
    subscriptions = [
      {
        id: 's1',
        tenant_id: 't_1',
        recipient_email: 'a@b.test',
        recipient_name: null,
        frequency: 'daily',
        send_hour_local: 8,
        send_day_of_week: 1,
        last_sent_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 's2',
        tenant_id: 't_1',
        recipient_email: 'b@b.test',
        recipient_name: null,
        frequency: 'daily',
        send_hour_local: 8,
        send_day_of_week: 1,
        last_sent_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
    ]
    const due = await listDueSubscriptions()
    expect(due.map(s => s.id)).toEqual(['s1'])
  })

  it('always returns subs with no last_sent_at (first run)', async () => {
    subscriptions = [
      {
        id: 's3',
        tenant_id: 't_1',
        recipient_email: 'c@b.test',
        recipient_name: null,
        frequency: 'weekly',
        send_hour_local: 8,
        send_day_of_week: 1,
        last_sent_at: null,
      },
    ]
    const due = await listDueSubscriptions()
    expect(due.map(s => s.id)).toEqual(['s3'])
  })
})

describe('sendDigestForSubscription', () => {
  it('on success, writes a sent digest_sends row and advances last_sent_at', async () => {
    outcomesRows = [
      { outcome: 'booked', revenue_estimate_cents: 8500, call_id: 'c1', lead_score: 72, next_action: 'no_action', pack_slug: 'home_services', metadata: {}, created_at: '2026-05-08T10:00:00Z' },
    ]
    const sub = {
      id: 's1',
      tenant_id: 't_1',
      recipient_email: 'owner@acme.test',
      recipient_name: 'Owner',
      frequency: 'weekly' as const,
      send_hour_local: 8,
      send_day_of_week: 1,
      last_sent_at: null,
    }
    const r = await sendDigestForSubscription(sub)
    expect(r.status).toBe('sent')
    expect(emailSent.to).toBe('owner@acme.test')
    expect(emailSent.from).toMatch(/Rocket Agency/)
    const log = inserted.find(i => i.table === 'digest_sends')
    expect(log).toBeDefined()
    expect(log.row.status).toBe('sent')
    const advance = updated.find(u => u.table === 'digest_subscriptions')
    expect(advance).toBeDefined()
    expect(advance.patch.last_sent_at).toBeDefined()
  })

  it('on Resend failure, writes a failed digest_sends row and does NOT advance last_sent_at', async () => {
    emailShouldFail = true
    outcomesRows = []
    const sub = {
      id: 's1',
      tenant_id: 't_1',
      recipient_email: 'owner@acme.test',
      recipient_name: null,
      frequency: 'weekly' as const,
      send_hour_local: 8,
      send_day_of_week: 1,
      last_sent_at: null,
    }
    const r = await sendDigestForSubscription(sub)
    expect(r.status).toBe('failed')
    expect(r.error).toBe('resend_down')
    const log = inserted.find(i => i.table === 'digest_sends')
    expect(log.row.status).toBe('failed')
    const advance = updated.find(u => u.table === 'digest_subscriptions')
    expect(advance).toBeUndefined()
  })

  it('skips off subscriptions without sending', async () => {
    const sub = {
      id: 's1',
      tenant_id: 't_1',
      recipient_email: 'owner@acme.test',
      recipient_name: null,
      frequency: 'off' as const,
      send_hour_local: 8,
      send_day_of_week: 1,
      last_sent_at: null,
    }
    const r = await sendDigestForSubscription(sub)
    expect(r.status).toBe('skipped')
    expect(emailSent).toBeNull()
  })
})
