/**
 * @jest-environment node
 *
 * Owner-portal token tests (Sprint 6.5).
 *
 * Locks the contracts the SMB-facing portal depends on:
 *   issueOwnerToken     — creates a row scoped to a tenant under an agency.
 *   verifyOwnerToken    — invalid / revoked / expired rejection; parent-
 *                         chain revocation cascades to children.
 *   forwardOwnerToken   — child inherits tenant + agency + transcript
 *                         permission; cannot extend lifetime past parent;
 *                         blocked when parent is revoked / expired.
 *   buildOwnerData      — transcripts gated on allow_transcripts.
 */

let tenantRow: any = null
let agencyRow: any = null
let tokensById = new Map<string, any>()
let tokensByToken = new Map<string, any>()
const insertedTokens: any[] = []
let outcomeRows: any[] = []

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn((table: string) => fakeFrom(table)) },
}))

function newId() {
  return `tok_${tokensById.size + 1}`
}

function fakeFrom(table: string) {
  const builder: any = {
    _table: table,
    _filters: {} as Record<string, unknown>,
    select: jest.fn().mockImplementation(() => builder),
    eq: jest.fn().mockImplementation((c: string, v: unknown) => {
      builder._filters[c] = v
      return builder
    }),
    is: jest.fn().mockImplementation(() => builder),
    gt: jest.fn().mockImplementation(() => builder),
    gte: jest.fn().mockImplementation(() => builder),
    lte: jest.fn().mockImplementation(() => builder),
    order: jest.fn().mockImplementation(() => builder),
    limit: jest.fn().mockImplementation(() => builder),
    insert: jest.fn().mockImplementation((row: any) => {
      const id = newId()
      const stored = { ...row, id, access_count: 0, created_at: new Date().toISOString() }
      tokensById.set(id, stored)
      tokensByToken.set(stored.token, stored)
      insertedTokens.push(stored)
      builder._payload = stored
      return builder
    }),
    update: jest.fn().mockImplementation((patch: any) => {
      // Defer apply until the chain resolves — .eq() may run after .update().
      builder._updatePatch = patch
      return builder
    }),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (table === 'tenants' && builder._filters.id) {
        return tenantRow ? { data: tenantRow, error: null } : { data: null, error: null }
      }
      if (table === 'agencies' && builder._filters.id) {
        return agencyRow ? { data: agencyRow, error: null } : { data: null, error: null }
      }
      if (table === 'owner_portal_tokens' && builder._filters.token) {
        return { data: tokensByToken.get(builder._filters.token as string) ?? null, error: null }
      }
      if (table === 'owner_portal_tokens' && builder._filters.id) {
        return { data: tokensById.get(builder._filters.id as string) ?? null, error: null }
      }
      return { data: null, error: null }
    }),
    single: jest.fn().mockImplementation(async () => {
      return { data: builder._payload, error: null }
    }),
    rpc: jest.fn(),
    then: undefined as any,
  }
  builder.then = (resolve: any) => {
    // Apply any pending update before resolving.
    if (
      table === 'owner_portal_tokens' &&
      builder._updatePatch &&
      builder._filters.id
    ) {
      const r = tokensById.get(builder._filters.id as string)
      if (r) Object.assign(r, builder._updatePatch)
      builder._updatePatch = undefined
    }
    if (table === 'call_outcomes') resolve({ data: outcomeRows, error: null })
    else resolve({ data: [], error: null })
    return Promise.resolve()
  }
  return builder
}

import {
  issueOwnerToken,
  verifyOwnerToken,
  forwardOwnerToken,
  revokeOwnerToken,
  buildOwnerData,
} from '@/lib/owner-portal'

beforeEach(() => {
  tokensById = new Map()
  tokensByToken = new Map()
  insertedTokens.length = 0
  outcomeRows = []
  tenantRow = {
    id: 't_1',
    name: 'Acme',
    display_name: 'Acme Roofing',
    agency_id: 'a_1',
  }
  agencyRow = {
    id: 'a_1',
    slug: 'rocket',
    name: 'Rocket Agency',
    primary_color: '#ff6600',
    contact_email: 'hi@rocket.test',
    logo_url: null,
    plan: 'starter',
    max_clients: 5,
    status: 'active',
    settings: {},
    stripe_customer_id: null,
    stripe_subscription_id: null,
  }
})

describe('issueOwnerToken', () => {
  it('creates a 30-day root token scoped to the tenant + agency', async () => {
    const row = await issueOwnerToken({
      tenantId: 't_1',
      recipientEmail: 'owner@acme.test',
      label: 'owner',
    })
    expect(row.token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(row.tenant_id).toBe('t_1')
    expect(row.agency_id).toBe('a_1')
    expect(row.allow_transcripts).toBe(false)
    expect(row.parent_id ?? null).toBeNull()
    const expiresIn = new Date(row.expires_at).getTime() - Date.now()
    expect(expiresIn).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
    expect(expiresIn).toBeLessThan(31 * 24 * 60 * 60 * 1000)
  })

  it('refuses unknown tenants', async () => {
    tenantRow = null
    await expect(issueOwnerToken({ tenantId: 'nope' })).rejects.toThrow(/tenant_not_found/)
  })

  it('honors allowTranscripts opt-in (default off)', async () => {
    const off = await issueOwnerToken({ tenantId: 't_1' })
    const on = await issueOwnerToken({ tenantId: 't_1', allowTranscripts: true })
    expect(off.allow_transcripts).toBe(false)
    expect(on.allow_transcripts).toBe(true)
  })
})

describe('verifyOwnerToken', () => {
  it('returns ok for a fresh root token', async () => {
    const row = await issueOwnerToken({ tenantId: 't_1' })
    const v = await verifyOwnerToken(row.token)
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.row.tenant_id).toBe('t_1')
  })

  it('rejects unknown / short tokens', async () => {
    expect((await verifyOwnerToken('short')).ok).toBe(false)
    expect((await verifyOwnerToken('does-not-exist-but-long-enough-12345')).ok).toBe(false)
  })

  it('rejects revoked tokens', async () => {
    const row = await issueOwnerToken({ tenantId: 't_1' })
    await revokeOwnerToken(row.id, 'agency_revoked')
    const v = await verifyOwnerToken(row.token)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('revoked')
  })

  it('rejects expired tokens', async () => {
    const row = await issueOwnerToken({ tenantId: 't_1' })
    // Move expires_at into the past directly on the stored row.
    tokensById.get(row.id).expires_at = new Date(Date.now() - 1000).toISOString()
    const v = await verifyOwnerToken(row.token)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('expired')
  })

  it('cascades revocation through the parent chain', async () => {
    const parent = await issueOwnerToken({ tenantId: 't_1' })
    const child = await forwardOwnerToken(parent.token)
    expect(child.parent_id).toBe(parent.id)
    // Child works while parent is alive.
    const fresh = await verifyOwnerToken(child.token)
    expect(fresh.ok).toBe(true)
    // Revoke the parent — child should now fail.
    await revokeOwnerToken(parent.id, 'agency_revoked')
    const after = await verifyOwnerToken(child.token)
    expect(after.ok).toBe(false)
    if (!after.ok) expect(after.reason).toBe('revoked')
  })
})

describe('forwardOwnerToken', () => {
  it('child inherits tenant + agency + transcripts permission', async () => {
    const parent = await issueOwnerToken({ tenantId: 't_1', allowTranscripts: true })
    const child = await forwardOwnerToken(parent.token, 'team@acme.test', 'office manager')
    expect(child.tenant_id).toBe('t_1')
    expect(child.agency_id).toBe('a_1')
    expect(child.allow_transcripts).toBe(true)
    expect(child.label).toBe('office manager')
    expect(child.recipient_email).toBe('team@acme.test')
  })

  it('child cannot extend lifetime past the parent', async () => {
    const parent = await issueOwnerToken({ tenantId: 't_1' })
    // Parent has, say, 5 minutes left.
    tokensById.get(parent.id).expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const child = await forwardOwnerToken(parent.token)
    const childTtl = new Date(child.expires_at).getTime() - Date.now()
    expect(childTtl).toBeLessThanOrEqual(5 * 60 * 1000 + 100) // <= parent + slack
  })

  it('forwarding a revoked token fails', async () => {
    const parent = await issueOwnerToken({ tenantId: 't_1' })
    await revokeOwnerToken(parent.id, 'agency_revoked')
    await expect(forwardOwnerToken(parent.token)).rejects.toThrow(/forward_blocked:revoked/)
  })

  it('forwarding an expired token fails', async () => {
    const parent = await issueOwnerToken({ tenantId: 't_1' })
    tokensById.get(parent.id).expires_at = new Date(Date.now() - 1000).toISOString()
    await expect(forwardOwnerToken(parent.token)).rejects.toThrow(/forward_blocked:expired/)
  })
})

describe('buildOwnerData', () => {
  it('rolls up outcomes and gates transcripts based on token permission', async () => {
    outcomeRows = [
      {
        call_id: 'c1',
        outcome: 'booked',
        revenue_estimate_cents: 8500,
        lead_score: 80,
        next_action: 'no_action',
        pack_slug: 'home_services',
        metadata: { summary: 'Caller booked for Tuesday' },
        created_at: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        call_id: 'c2',
        outcome: 'qualified_lead',
        revenue_estimate_cents: 5000,
        lead_score: 60,
        next_action: 'transfer_to_closer',
        pack_slug: 'home_services',
        metadata: { summary: 'Hot lead' },
        created_at: new Date(Date.now() - 120_000).toISOString(),
      },
    ]
    const noTranscripts = await buildOwnerData({
      tenantId: 't_1',
      allowTranscripts: false,
    })
    expect(noTranscripts).not.toBeNull()
    expect(noTranscripts!.totalCalls).toBe(2)
    expect(noTranscripts!.bookedAppointments).toBe(1)
    expect(noTranscripts!.qualifiedLeads).toBe(1)
    expect(noTranscripts!.hotLeads).toBe(1) // c1 = 80 >= 75
    expect(noTranscripts!.allowTranscripts).toBe(false)
    expect(noTranscripts!.recentCalls.every(c => c.redactedSummary === null)).toBe(true)

    const withTranscripts = await buildOwnerData({
      tenantId: 't_1',
      allowTranscripts: true,
    })
    expect(withTranscripts!.allowTranscripts).toBe(true)
    expect(withTranscripts!.recentCalls.some(c => c.redactedSummary !== null)).toBe(true)
  })

  it('returns null when tenant is unknown', async () => {
    tenantRow = null
    const data = await buildOwnerData({ tenantId: 'nope', allowTranscripts: false })
    expect(data).toBeNull()
  })
})
