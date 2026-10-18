/**
 * Billing entitlement tests (Sprint 4.4 — PRD §6.4).
 *
 * Locks the contract that turns Stripe lifecycle events into agency
 * entitlement changes:
 *   - First-run after checkout creates a new agency with the right
 *     plan + max_clients.
 *   - subscription.updated re-syncs plan/status without losing carry-
 *     forward fields when no plan present in the payload.
 *   - subscription.deleted suspends without deleting the agency.
 *   - past_due / unpaid maps to suspended.
 *   - planFromPriceId reads STRIPE_PRICE_* env.
 */

let existingAgency: any = null
const inserted: any[] = []
const updated: any[] = []

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => fakeFrom(table)),
  },
}))

function fakeFrom(table: string) {
  const builder: any = {
    _table: table,
    _filters: {} as Record<string, unknown>,
    select: jest.fn().mockImplementation(() => builder),
    eq: jest.fn().mockImplementation((col: string, val: unknown) => {
      builder._filters[col] = val
      return builder
    }),
    insert: jest.fn().mockImplementation((row: any) => {
      inserted.push({ table, row })
      const withId = { ...row, id: `agency_${inserted.length}` }
      builder._payload = withId
      return builder
    }),
    update: jest.fn().mockImplementation((patch: any) => {
      updated.push({ table, patch, filters: { ...builder._filters } })
      if (existingAgency && builder._filters.id === existingAgency.id) {
        existingAgency = { ...existingAgency, ...patch }
      }
      return builder
    }),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (table === 'agencies') return { data: existingAgency, error: null }
      return { data: null, error: null }
    }),
    single: jest.fn().mockImplementation(async () => {
      return { data: builder._payload, error: null }
    }),
  }
  return builder
}

import { syncEntitlement, planFromPriceId, maxClientsFor, PLAN_CATALOG } from '@/lib/billing'

beforeEach(() => {
  existingAgency = null
  inserted.length = 0
  updated.length = 0
  process.env.STRIPE_PRICE_STARTER = 'price_starter_test'
  process.env.STRIPE_PRICE_GROWTH = 'price_growth_test'
  process.env.STRIPE_PRICE_SCALE = 'price_scale_test'
})

describe('plan catalog', () => {
  it('maxClients is monotonic with plan tier', () => {
    expect(maxClientsFor('starter')).toBeLessThan(maxClientsFor('growth'))
    expect(maxClientsFor('growth')).toBeLessThan(maxClientsFor('scale'))
    expect(maxClientsFor('scale')).toBeLessThan(maxClientsFor('enterprise'))
  })

  it('planFromPriceId resolves env-mapped price ids', () => {
    expect(planFromPriceId('price_growth_test')).toBe('growth')
    expect(planFromPriceId('price_starter_test')).toBe('starter')
    expect(planFromPriceId('price_unknown')).toBeNull()
    expect(planFromPriceId(null)).toBeNull()
  })
})

describe('syncEntitlement — first run (signup)', () => {
  it('creates a new agency with plan + max_clients + active status', async () => {
    const r = await syncEntitlement({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      plan: 'growth',
      agencyName: 'Rocket Marketing',
      agencySlug: 'rocket-marketing',
      contactEmail: 'hi@rocket.test',
      stripeSubStatus: 'active',
    })
    expect(r.created).toBe(true)
    expect(r.plan).toBe('growth')
    expect(r.maxClients).toBe(PLAN_CATALOG.growth.maxClients)
    expect(r.status).toBe('active')
    const insert = inserted.find(i => i.table === 'agencies')
    expect(insert.row.stripe_customer_id).toBe('cus_1')
    expect(insert.row.stripe_subscription_id).toBe('sub_1')
    expect(insert.row.contact_email).toBe('hi@rocket.test')
    expect(insert.row.slug).toBe('rocket-marketing')
  })

  it('derives a slug from name when none provided', async () => {
    const r = await syncEntitlement({
      customerId: 'cus_2',
      subscriptionId: 'sub_2',
      plan: 'starter',
      agencyName: "O'Brien & Sons!",
      stripeSubStatus: 'active',
    })
    expect(r.created).toBe(true)
    const insert = inserted.find(i => i.table === 'agencies')
    expect(insert.row.slug).toMatch(/^o-brien-sons-/)
    expect(insert.row.slug).not.toMatch(/['&!]/)
  })
})

describe('syncEntitlement — subscription updates', () => {
  beforeEach(() => {
    existingAgency = {
      id: 'a_1',
      stripe_customer_id: 'cus_1',
      plan: 'starter',
      slug: 'rocket',
      name: 'Rocket',
    }
  })

  it('upgrades plan + max_clients on plan change', async () => {
    const r = await syncEntitlement({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      plan: 'scale',
      stripeSubStatus: 'active',
    })
    expect(r.created).toBe(false)
    expect(r.plan).toBe('scale')
    expect(r.maxClients).toBe(PLAN_CATALOG.scale.maxClients)
    expect(r.status).toBe('active')
    const upd = updated.find(u => u.table === 'agencies')
    expect(upd.patch.plan).toBe('scale')
    expect(upd.patch.max_clients).toBe(PLAN_CATALOG.scale.maxClients)
  })

  it('carries forward existing plan when none supplied (renewal pings)', async () => {
    existingAgency.plan = 'growth'
    const r = await syncEntitlement({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      plan: null,
      stripeSubStatus: 'active',
    })
    expect(r.plan).toBe('growth')
    expect(r.maxClients).toBe(PLAN_CATALOG.growth.maxClients)
  })

  it('past_due → suspended', async () => {
    const r = await syncEntitlement({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      plan: 'starter',
      stripeSubStatus: 'past_due',
    })
    expect(r.status).toBe('suspended')
    const upd = updated.find(u => u.table === 'agencies')
    expect(upd.patch.status).toBe('suspended')
  })

  it('unpaid / canceled → suspended', async () => {
    for (const s of ['unpaid', 'canceled', 'incomplete', 'incomplete_expired'] as const) {
      updated.length = 0
      const r = await syncEntitlement({
        customerId: 'cus_1',
        subscriptionId: 'sub_1',
        plan: 'starter',
        stripeSubStatus: s,
      })
      expect(r.status).toBe('suspended')
    }
  })

  it('trialing → active', async () => {
    const r = await syncEntitlement({
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      plan: 'starter',
      stripeSubStatus: 'trialing',
    })
    expect(r.status).toBe('active')
  })
})

describe('syncEntitlement — cancellation', () => {
  it('subscription deleted → suspends but does not delete agency', async () => {
    existingAgency = {
      id: 'a_1',
      stripe_customer_id: 'cus_1',
      plan: 'growth',
      slug: 'rocket',
      name: 'Rocket',
    }
    const r = await syncEntitlement({
      customerId: 'cus_1',
      subscriptionId: null,
      plan: null,
      stripeSubStatus: 'canceled',
    })
    expect(r.status).toBe('suspended')
    expect(r.plan).toBe('growth') // preserved for re-activation
    const upd = updated.find(u => u.table === 'agencies')
    expect(upd.patch.status).toBe('suspended')
    expect(upd.patch.stripe_subscription_id).toBeNull()
    // No DELETE issued.
    expect(inserted).toHaveLength(0)
  })
})
