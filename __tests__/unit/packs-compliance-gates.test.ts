/**
 * Compliance gate runtime tests.
 *
 * Locks the contracts that the dealership_bdc + insurance_agency
 * personas rely on:
 *   queryRND               — cache-hit on a prior reassigned=true log
 *                            short-circuits without re-inserting.
 *   checkCarrierAppointment — declines verbatim with the agency-state-LOB
 *                             phrase when no active appointment exists.
 *   captureSOA              — 48-hour wait kicks in pre-sunset and AEP
 *                             carve-out clears it; post-sunset never waits.
 *
 * Mocks at the supabase boundary so tests don't need a live DB.
 */

const inserted: any[] = []
let priorRNDLog: any = null

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => fakeFrom(table)),
  },
}))

function fakeFrom(table: string) {
  const builder: any = {
    _table: table,
    _filters: {} as Record<string, unknown>,
    _payload: null as any,
    select: jest.fn().mockImplementation(() => builder),
    eq: jest.fn().mockImplementation((col: string, val: unknown) => {
      builder._filters[col] = val
      return builder
    }),
    filter: jest.fn().mockImplementation(() => builder),
    gte: jest.fn().mockImplementation(() => builder),
    order: jest.fn().mockImplementation(() => builder),
    insert: jest.fn().mockImplementation((row: any) => {
      inserted.push({ table, row })
      builder._payload = Array.isArray(row) ? row[0] : row
      builder._payload.id = builder._payload.id ?? `id_${inserted.length}`
      return builder
    }),
    upsert: jest.fn().mockImplementation((row: any) => {
      inserted.push({ table, row, op: 'upsert' })
      return Promise.resolve({ data: null, error: null })
    }),
    single: jest.fn().mockImplementation(async () => {
      return { data: builder._payload, error: null }
    }),
    limit: jest.fn().mockImplementation(async () => {
      // queryRND select chain ends with .limit(1) — return the prior log
      // when configured, otherwise empty.
      if (
        table === 'voice_agent_function_calls' &&
        builder._filters.function_name === 'queryRND' &&
        priorRNDLog
      ) {
        return { data: [priorRNDLog], error: null }
      }
      return { data: [], error: null }
    }),
  }
  return builder
}

import { runPackTool } from '@/lib/packs/tool-runtime'

function baseCtx(overrides: Partial<any> = {}): any {
  return {
    tenantId: 'tenant_1',
    packId: 'pack_1',
    packSlug: 'insurance_agency',
    packVersion: '1.0.0',
    installId: 'install_1',
    kbValues: {},
    integrationMap: {},
    toolSubset: [
      'queryRND',
      'scrubDNC',
      'checkCarrierAppointment',
      'checkProducerLicense',
      'captureSOA',
      'logTPMODisclaimer',
    ],
    complianceProfileSlug: 'insurance',
    ...overrides,
  }
}

beforeEach(() => {
  inserted.length = 0
  priorRNDLog = null
  jest.useRealTimers()
})

describe('compliance gates / queryRND', () => {
  it('returns cached reassigned=true and does NOT insert a new log on cache hit', async () => {
    priorRNDLog = {
      id: 'rnd_prior_1',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      result: { reassigned: true, provider: 'reassigned_us' },
    }

    const ctx = baseCtx()
    const res: any = await runPackTool(ctx, 'queryRND', { phone: '+15551234567' })

    expect(res).toMatchObject({
      reassigned: true,
      provider: 'reassigned_us',
      cached: true,
      queried_at: priorRNDLog.timestamp,
    })

    // Cache-hit path must NOT write a fresh queryRND row — the whole
    // point of the cache is to avoid re-querying / re-logging within
    // the rnd_cache_seconds window.
    const newLogs = inserted.filter(
      r => r.table === 'voice_agent_function_calls' && r.row?.function_name === 'queryRND',
    )
    expect(newLogs).toHaveLength(0)
  })

  it('on cache miss, queries and returns reassigned=false with do_not_proceed flag', async () => {
    priorRNDLog = null

    const ctx = baseCtx()
    const res: any = await runPackTool(ctx, 'queryRND', { phone: '+15550009999' })

    expect(res).toMatchObject({
      reassigned: false,
      cached: false,
      do_not_proceed_if_reassigned: true,
    })

    const newLogs = inserted.filter(
      r => r.table === 'voice_agent_function_calls' && r.row?.function_name === 'queryRND',
    )
    expect(newLogs).toHaveLength(1)
    // Phone is hashed in the log — never stored verbatim.
    expect(newLogs[0].row.parameters).toHaveProperty('phoneHash')
    expect(newLogs[0].row.parameters.phoneHash).toMatch(/^name_/)
  })
})

describe('compliance gates / checkCarrierAppointment', () => {
  it('declines verbatim when the agency is not appointed', async () => {
    const ctx = baseCtx({
      kbValues: {
        carrier_appointments: [
          { carrier: 'Progressive', states: ['CA'], lobs: ['personal_auto'], status: 'active' },
        ],
      },
    })

    const res: any = await runPackTool(ctx, 'checkCarrierAppointment', {
      carrier: 'GEICO',
      state: 'NY',
      lob: 'personal_auto',
    })

    expect(res.appointed).toBe(false)
    expect(res.do_not_quote_if_not_appointed).toBe(true)
    expect(res.decline_message).toMatch(/not appointed with GEICO in NY for personal_auto/i)
    expect(res.decline_message).toMatch(/would you like a quote from a carrier we do represent/i)
  })

  it("matches case-insensitively on carrier and uppercases state", async () => {
    const ctx = baseCtx({
      kbValues: {
        carrier_appointments: [
          { carrier: 'Progressive', states: ['CA'], lobs: ['personal_auto'], status: 'active' },
        ],
      },
    })

    const res: any = await runPackTool(ctx, 'checkCarrierAppointment', {
      carrier: 'progressive',
      state: 'ca',
      lob: 'personal_auto',
    })

    expect(res.appointed).toBe(true)
    expect(res.decline_message).toBeNull()
    expect(res.status).toBe('active')
  })

  it('treats limited appointments as not-appointed for autonomous quoting', async () => {
    const ctx = baseCtx({
      kbValues: {
        carrier_appointments: [
          { carrier: 'Travelers', states: ['TX'], lobs: ['home'], status: 'limited' },
        ],
      },
    })

    const res: any = await runPackTool(ctx, 'checkCarrierAppointment', {
      carrier: 'Travelers',
      state: 'TX',
      lob: 'home',
    })

    expect(res.appointed).toBe(false)
    expect(res.limited).toBe(true)
  })
})

describe('compliance gates / captureSOA', () => {
  // The 48-hour wait sunsets on Oct 1, 2026 (CY2027 final rule).
  // Pre-sunset: wait_required unless caller-initiated or AEP/OEP/ICEP/SEP.
  // Post-sunset: wait_required is always false.

  it('requires the 48-hour wait pre-sunset for a non-carve-out caller', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T10:00:00Z'))

    const ctx = baseCtx()
    const res: any = await runPackTool(ctx, 'captureSOA', {
      fullName: 'Jane Q Public',
      address: '123 Main St',
      phone: '+15555550000',
      productsToDiscuss: ['MA', 'MAPD'],
      agentName: 'Alex Rivers',
      agentNpn: '1234567',
      attestationVerbal: true,
      callerInitiated: false,
      enrollmentPeriod: 'none',
    })

    expect(res.captured).toBe(true)
    expect(res.wait_required).toBe(true)
    // earliest_appointment_iso should be ~48h from now.
    const earliest = new Date(res.earliest_appointment_iso).getTime()
    const now = Date.now()
    expect(earliest - now).toBeGreaterThan(47.5 * 60 * 60 * 1000)
    expect(earliest - now).toBeLessThan(48.5 * 60 * 60 * 1000)
    expect(res.retention_years).toBe(10)
    expect(res.do_not_discuss_benefits_until_captured).toBe(true)
  })

  it('clears the wait when caller is in AEP (carve-out)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T10:00:00Z'))

    const ctx = baseCtx()
    const res: any = await runPackTool(ctx, 'captureSOA', {
      fullName: 'Jane Q Public',
      address: '123 Main St',
      phone: '+15555550000',
      productsToDiscuss: ['MA'],
      agentName: 'Alex Rivers',
      agentNpn: '1234567',
      attestationVerbal: true,
      enrollmentPeriod: 'AEP',
    })

    expect(res.wait_required).toBe(false)
    // earliest_appointment_iso should be roughly "now" (no wait).
    const earliest = new Date(res.earliest_appointment_iso).getTime()
    expect(Math.abs(earliest - Date.now())).toBeLessThan(2000)
  })

  it('clears the wait for caller-initiated walk-ins (carve-out)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T10:00:00Z'))

    const ctx = baseCtx()
    const res: any = await runPackTool(ctx, 'captureSOA', {
      fullName: 'Jane Q Public',
      address: '123 Main St',
      phone: '+15555550000',
      productsToDiscuss: ['Medigap'],
      agentName: 'Alex Rivers',
      agentNpn: '1234567',
      attestationVerbal: true,
      callerInitiated: true,
    })

    expect(res.wait_required).toBe(false)
  })

  it('drops the wait entirely post-sunset (Oct 1, 2026)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T10:00:00Z'))

    const ctx = baseCtx()
    const res: any = await runPackTool(ctx, 'captureSOA', {
      fullName: 'Jane Q Public',
      address: '123 Main St',
      phone: '+15555550000',
      productsToDiscuss: ['MAPD'],
      agentName: 'Alex Rivers',
      agentNpn: '1234567',
      attestationVerbal: true,
      enrollmentPeriod: 'none',
    })

    expect(res.wait_required).toBe(false)
    expect(res.retention_years).toBe(10)
  })

  it('refuses to capture when verbal attestation is missing', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T10:00:00Z'))

    const ctx = baseCtx()
    const res: any = await runPackTool(ctx, 'captureSOA', {
      fullName: 'Jane Q Public',
      address: '123 Main St',
      phone: '+15555550000',
      productsToDiscuss: ['MA'],
      agentName: 'Alex Rivers',
      agentNpn: '1234567',
      attestationVerbal: false,
    })

    expect(res.captured).toBe(false)
    expect(res.do_not_discuss_benefits_until_captured).toBe(true)
  })
})
