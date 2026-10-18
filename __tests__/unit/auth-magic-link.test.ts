/**
 * @jest-environment node
 *
 * Magic-link auth tests (Sprint 5.5).
 *
 * Locks the contracts the /login flow depends on:
 *   issueMagicLink — rate limit (silent at 6th in window), inserts a
 *                    row, sends an email, lower-cases the email.
 *   verifyMagicLink — single-use (concurrent verifies race-safe via
 *                     the conditional update), expiry rejected, missing
 *                     token rejected.
 *   readSession    — round-trips an issued JWT; rejects tampering.
 */

let recentTokensCount = 0
let insertedRows: any[] = []
let updatedRows: any[] = []
let storedRow: any = null
let emailsSent: any[] = []
let updateRetainsRow = true

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn((table: string) => fakeFrom(table)) },
}))

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(async (params: any) => {
    emailsSent.push(params)
    return { success: true, data: { id: 'msg_1' } }
  }),
}))

function fakeFrom(table: string) {
  const builder: any = {
    _table: table,
    _filters: {} as Record<string, unknown>,
    _isHead: false,
    _isCount: false,
    select: jest.fn().mockImplementation((_cols?: any, opts?: any) => {
      if (opts?.head) builder._isHead = true
      if (opts?.count === 'exact') builder._isCount = true
      return builder
    }),
    eq: jest.fn().mockImplementation((c: string, v: unknown) => {
      builder._filters[c] = v
      return builder
    }),
    is: jest.fn().mockImplementation((c: string, v: unknown) => {
      builder._filters[c + '_is'] = v
      return builder
    }),
    gte: jest.fn().mockImplementation(() => builder),
    insert: jest.fn().mockImplementation((row: any) => {
      insertedRows.push(row)
      builder._payload = row
      return Promise.resolve({ data: row, error: null })
    }),
    update: jest.fn().mockImplementation((patch: any) => {
      updatedRows.push({ patch, filters: { ...builder._filters } })
      if (storedRow && updateRetainsRow) {
        storedRow = { ...storedRow, ...patch }
      }
      return builder
    }),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (table === 'login_tokens' && builder._filters.token) {
        if (storedRow && storedRow.token === builder._filters.token) {
          if (builder._filters.id_is === null && storedRow.used_at) {
            return { data: null, error: null }
          }
          return { data: storedRow, error: null }
        }
        return { data: null, error: null }
      }
      // The mark-used update has .is('used_at', null) → succeeds only if not yet used.
      if (table === 'login_tokens' && builder._filters.id) {
        if (!updateRetainsRow) return { data: null, error: null }
        return { data: { id: storedRow?.id }, error: null }
      }
      return { data: null, error: null }
    }),
    then: undefined as any,
  }
  builder.then = (resolve: any) => {
    if (table === 'login_tokens' && builder._isHead && builder._isCount) {
      resolve({ count: recentTokensCount, data: null, error: null })
    } else {
      resolve({ data: [], error: null })
    }
    return Promise.resolve()
  }
  return builder
}

import {
  issueMagicLink,
  verifyMagicLink,
  readSession,
} from '@/lib/auth-magic-link'

beforeEach(() => {
  process.env.JWT_SECRET = 'a'.repeat(32)
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.test'
  recentTokensCount = 0
  insertedRows = []
  updatedRows = []
  emailsSent = []
  storedRow = null
  updateRetainsRow = true
})

describe('issueMagicLink', () => {
  it('lower-cases the email and persists a token + sends an email', async () => {
    const r = await issueMagicLink({ email: 'Owner@AGENCY.com' })
    expect(r.sent).toBe(true)
    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0].email).toBe('owner@agency.com')
    expect(insertedRows[0].user_id).toBe('owner@agency.com')
    expect(insertedRows[0].token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(insertedRows[0].expires_at).toBeDefined()
    expect(emailsSent).toHaveLength(1)
    expect(emailsSent[0].to).toBe('owner@agency.com')
    expect(emailsSent[0].html).toMatch(/login\/verify\?token=/)
  })

  it('refuses obviously bad emails', async () => {
    await expect(issueMagicLink({ email: 'not-an-email' })).rejects.toThrow(/invalid_email/)
    expect(insertedRows).toHaveLength(0)
    expect(emailsSent).toHaveLength(0)
  })

  it('silent-accepts past the rate limit (no email sent, no row inserted)', async () => {
    recentTokensCount = 5 // already at the cap
    const r = await issueMagicLink({ email: 'spam@me.test' })
    expect(r.sent).toBe(false)
    expect(insertedRows).toHaveLength(0)
    expect(emailsSent).toHaveLength(0)
  })

  it('passes ip + ua through for abuse tracing', async () => {
    await issueMagicLink({
      email: 'a@b.test',
      ip: '198.51.100.7',
      userAgent: 'Mozilla/5.0',
    })
    expect(insertedRows[0].ip).toBe('198.51.100.7')
    expect(insertedRows[0].user_agent).toBe('Mozilla/5.0')
  })

  it('persists nextUrl when supplied', async () => {
    await issueMagicLink({ email: 'a@b.test', nextUrl: '/dashboard/agency/settings' })
    expect(insertedRows[0].next_url).toBe('/dashboard/agency/settings')
  })
})

describe('verifyMagicLink', () => {
  it('returns ok + sessionToken for a fresh token', async () => {
    storedRow = {
      id: 't_1',
      token: 'abc123',
      email: 'a@b.test',
      user_id: 'a@b.test',
      agency_id: 'agency_1',
      next_url: '/dashboard/agency',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: null,
    }
    const r = await verifyMagicLink('abc123')
    expect(r.ok).toBe(true)
    expect(r.email).toBe('a@b.test')
    expect(r.agencyId).toBe('agency_1')
    expect(r.nextUrl).toBe('/dashboard/agency')
    expect(r.sessionToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/) // JWT shape

    // Marked used.
    expect(updatedRows).toHaveLength(1)
    expect(updatedRows[0].patch.used_at).toBeDefined()
  })

  it('rejects an unknown token', async () => {
    storedRow = null
    const r = await verifyMagicLink('does-not-exist')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('invalid')
  })

  it('rejects an expired token', async () => {
    storedRow = {
      id: 't_1',
      token: 'expired',
      email: 'a@b.test',
      user_id: 'a@b.test',
      agency_id: null,
      next_url: '/dashboard/agency',
      expires_at: new Date(Date.now() - 1000).toISOString(),
      used_at: null,
    }
    const r = await verifyMagicLink('expired')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('expired')
    // Don't mark expired tokens as used — the row is still useful for audit.
    expect(updatedRows).toHaveLength(0)
  })

  it('rejects a token that was already used', async () => {
    storedRow = {
      id: 't_1',
      token: 'used',
      email: 'a@b.test',
      user_id: 'a@b.test',
      agency_id: null,
      next_url: '/dashboard/agency',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: new Date().toISOString(),
    }
    const r = await verifyMagicLink('used')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('already_used')
  })

  it('handles the conditional-update race: row was marked used between read and update', async () => {
    storedRow = {
      id: 't_1',
      token: 'race',
      email: 'a@b.test',
      user_id: 'a@b.test',
      agency_id: null,
      next_url: '/dashboard/agency',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: null,
    }
    updateRetainsRow = false // simulate the .is('used_at', null) filter rejecting
    const r = await verifyMagicLink('race')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('already_used')
  })

  it('rejects an empty token without hitting the DB', async () => {
    const r = await verifyMagicLink('')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('invalid')
  })
})

describe('readSession', () => {
  it('round-trips an issued session', async () => {
    storedRow = {
      id: 't_1',
      token: 'fresh',
      email: 'owner@agency.com',
      user_id: 'owner@agency.com',
      agency_id: 'agency_1',
      next_url: '/dashboard/agency',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: null,
    }
    const v = await verifyMagicLink('fresh')
    expect(v.ok).toBe(true)
    const claims = await readSession(v.sessionToken!)
    expect(claims).not.toBeNull()
    expect(claims!.email).toBe('owner@agency.com')
    expect(claims!.sub).toBe('owner@agency.com')
    expect(claims!.agency_id).toBe('agency_1')
  })

  it('returns null for missing token', async () => {
    expect(await readSession(undefined)).toBeNull()
    expect(await readSession('')).toBeNull()
  })

  it('rejects a tampered JWT', async () => {
    storedRow = {
      id: 't_1',
      token: 'fresh',
      email: 'a@b.test',
      user_id: 'a@b.test',
      agency_id: null,
      next_url: '/dashboard/agency',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      used_at: null,
    }
    const v = await verifyMagicLink('fresh')
    const tampered = v.sessionToken!.replace(/.$/, c => (c === 'A' ? 'B' : 'A'))
    expect(await readSession(tampered)).toBeNull()
  })
})
