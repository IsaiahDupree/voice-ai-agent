/**
 * Agency layer unit tests (Sprint 1 smoke).
 *
 * Locks the contracts the agency dashboard depends on:
 *   provisionClient        — enforces max_clients, returns tenant + slug
 *   listClientsWithKpis    — rolls up call_outcomes by tenant
 */

let agencyRow: any = null
let tenantsByAgency: any[] = []
let outcomesRows: any[] = []
let inserted: any[] = []

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
    _isHead: false,
    select: jest.fn().mockImplementation((_cols?: any, opts?: any) => {
      if (opts?.head) builder._isHead = true
      return builder
    }),
    eq: jest.fn().mockImplementation((col: string, val: unknown) => {
      builder._filters[col] = val
      return builder
    }),
    in: jest.fn().mockImplementation((col: string, vals: unknown[]) => {
      builder._filters[col + '_in'] = vals
      return builder
    }),
    gte: jest.fn().mockImplementation(() => builder),
    order: jest.fn().mockImplementation(() => builder),
    limit: jest.fn().mockImplementation(() => builder),
    insert: jest.fn().mockImplementation((row: any) => {
      inserted.push({ table, row })
      builder._payload = Array.isArray(row) ? row[0] : row
      return Promise.resolve({ data: builder._payload, error: null }) as any
    }),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (table === 'agencies' && agencyRow && builder._filters.id === agencyRow.id) {
        return { data: agencyRow, error: null }
      }
      if (table === 'agencies' && agencyRow && builder._filters.id) {
        return { data: null, error: null }
      }
      return { data: null, error: null }
    }),
    then: undefined as any,
  }
  // Make it thenable so `await select(...)` resolves with a list
  builder.then = (resolve: any) => {
    if (table === 'tenants' && builder._filters.agency_id !== undefined) {
      if (builder._isHead) {
        resolve({ count: tenantsByAgency.length, data: null, error: null })
      } else {
        resolve({ data: tenantsByAgency, error: null })
      }
    } else if (table === 'call_outcomes') {
      resolve({ data: outcomesRows, error: null })
    } else {
      resolve({ data: [], error: null })
    }
    return Promise.resolve()
  }
  return builder
}

import { provisionClient, listClientsWithKpis } from '@/lib/agency'

beforeEach(() => {
  inserted = []
  agencyRow = {
    id: 'a1',
    slug: 'test-agency',
    name: 'Test Agency',
    plan: 'starter',
    max_clients: 5,
    status: 'active',
    settings: {},
  }
  tenantsByAgency = []
  outcomesRows = []
})

describe('provisionClient', () => {
  it('creates a tenant under an active agency below max_clients', async () => {
    tenantsByAgency = [{ id: 't_1' }, { id: 't_2' }]

    const res: any = await provisionClient({
      agencyId: 'a1',
      displayName: 'Smith Roofing',
      legalName: 'Smith Roofing & Construction LLC',
    })

    expect(res.error).toBeUndefined()
    expect(res.tenantId).toMatch(/^t_/)
    expect(res.slug).toMatch(/smith-roofing/)

    const tenantInsert = inserted.find(i => i.table === 'tenants')
    expect(tenantInsert).toBeDefined()
    expect(tenantInsert.row.agency_id).toBe('a1')
    expect(tenantInsert.row.display_name).toBe('Smith Roofing')
    expect(tenantInsert.row.name).toBe('Smith Roofing & Construction LLC')
  })

  it('refuses provisioning when max_clients reached', async () => {
    agencyRow.max_clients = 2
    tenantsByAgency = [{ id: 't_1' }, { id: 't_2' }]

    const res: any = await provisionClient({
      agencyId: 'a1',
      displayName: 'Smith Roofing',
    })

    expect(res.error).toBe('max_clients_reached')
    expect(inserted.find(i => i.table === 'tenants')).toBeUndefined()
  })

  it('refuses provisioning when agency suspended', async () => {
    agencyRow.status = 'suspended'

    const res: any = await provisionClient({
      agencyId: 'a1',
      displayName: 'Smith Roofing',
    })

    expect(res.error).toBe('agency_suspended')
  })

  it('returns agency_not_found for an unknown id', async () => {
    agencyRow = null
    const res: any = await provisionClient({
      agencyId: 'does-not-exist',
      displayName: 'Smith Roofing',
    })
    expect(res.error).toBe('agency_not_found')
  })

  it('uses display_name to derive a URL-safe slug', async () => {
    const res: any = await provisionClient({
      agencyId: 'a1',
      displayName: "O'Brien & Sons Plumbing!",
    })
    expect(res.error).toBeUndefined()
    expect(res.slug).toMatch(/^o-brien-sons-plumbing-/)
    expect(res.slug).not.toMatch(/['&!]/)
  })
})

describe('listClientsWithKpis', () => {
  it('rolls up outcomes by tenant', async () => {
    tenantsByAgency = [
      { id: 't_1', name: 'Acme', display_name: 'Acme Roofing' },
      { id: 't_2', name: 'Bcme', display_name: null },
    ]
    outcomesRows = [
      {
        tenant_id: 't_1',
        pack_slug: 'home_services',
        outcome: 'booked',
        revenue_estimate_cents: 8500,
        call_id: 'c1',
        created_at: '2026-05-08T10:00:00Z',
      },
      {
        tenant_id: 't_1',
        pack_slug: 'home_services',
        outcome: 'qualified_lead',
        revenue_estimate_cents: 5000,
        call_id: 'c2',
        created_at: '2026-05-08T11:00:00Z',
      },
      {
        tenant_id: 't_2',
        pack_slug: 'salon_barbershop',
        outcome: 'missed_call_recovered',
        revenue_estimate_cents: 8500,
        call_id: 'c3',
        created_at: '2026-05-08T09:00:00Z',
      },
    ]

    const kpis = await listClientsWithKpis('a1')
    expect(kpis).toHaveLength(2)

    const acme = kpis.find(k => k.tenantId === 't_1')!
    expect(acme.displayName).toBe('Acme Roofing')
    expect(acme.totalCalls).toBe(2)
    expect(acme.bookedAppointments).toBe(1)
    expect(acme.qualifiedLeads).toBe(1)
    expect(acme.highValueLeads).toBe(1) // qualified_lead is high-value
    expect(acme.estRevenueCents).toBe(13500)
    expect(acme.packSlug).toBe('home_services')

    const bcme = kpis.find(k => k.tenantId === 't_2')!
    expect(bcme.displayName).toBe('Bcme') // falls back to name when display_name null
    expect(bcme.missedCallRecoveries).toBe(1)
  })

  it('returns empty when agency has no clients', async () => {
    tenantsByAgency = []
    const kpis = await listClientsWithKpis('a1')
    expect(kpis).toEqual([])
  })

  it('counts the same call once even with multiple outcomes', async () => {
    tenantsByAgency = [{ id: 't_1', name: 'Acme', display_name: 'Acme Roofing' }]
    outcomesRows = [
      {
        tenant_id: 't_1',
        outcome: 'booked',
        revenue_estimate_cents: 8500,
        call_id: 'c1',
        created_at: '2026-05-08T10:00:00Z',
      },
      {
        tenant_id: 't_1',
        outcome: 'qualified_lead',
        revenue_estimate_cents: 5000,
        call_id: 'c1', // SAME call
        created_at: '2026-05-08T10:01:00Z',
      },
    ]
    const [k] = await listClientsWithKpis('a1')
    expect(k.totalCalls).toBe(1)
    expect(k.bookedAppointments).toBe(1)
    expect(k.qualifiedLeads).toBe(1)
  })
})
