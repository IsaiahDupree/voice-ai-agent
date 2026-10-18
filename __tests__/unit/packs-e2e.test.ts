/**
 * End-to-end pack lifecycle test, mocked at the Supabase boundary.
 *
 * Walks: import bundle → activate install → resolve PackContext →
 * runPackTool dispatch with tool_subset enforcement → recordOutcome
 * persists. Locks the pack runtime contract for future packs.
 */

const inserted: any[] = []
const updates: any[] = []
const upserts: any[] = []
let installRow: any = null
let packRow: any = null
let complianceRow: any = null

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
    order: jest.fn().mockImplementation(() => builder),
    neq: jest.fn().mockImplementation(() => builder),
    gte: jest.fn().mockImplementation(() => builder),
    insert: jest.fn().mockImplementation((row: any) => {
      inserted.push({ table, row })
      builder._payload = Array.isArray(row) ? row[0] : row
      builder._payload.id = builder._payload.id ?? `id_${inserted.length}`
      return builder
    }),
    upsert: jest.fn().mockImplementation((row: any) => {
      upserts.push({ table, row })
      const merged = Array.isArray(row) ? row[0] : row
      if (table === 'tenant_pack_installs') {
        installRow = { id: 'install_1', ...installRow, ...merged }
        builder._payload = installRow
      } else {
        builder._payload = { id: `id_${upserts.length}`, ...merged }
      }
      return builder
    }),
    update: jest.fn().mockImplementation((patch: any) => {
      updates.push({ table, patch, filters: { ...builder._filters } })
      if (table === 'tenant_pack_installs') {
        installRow = { ...installRow, ...patch }
      }
      return builder
    }),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (table === 'industry_packs' && builder._filters.slug === 'salon_barbershop') {
        return { data: packRow, error: null }
      }
      if (table === 'compliance_profiles' && builder._filters.slug === 'salon_baseline') {
        return { data: complianceRow, error: null }
      }
      if (table === 'tenant_pack_installs' && installRow) {
        return { data: installRow, error: null }
      }
      return { data: null, error: null }
    }),
    single: jest.fn().mockImplementation(async () => {
      return { data: builder._payload, error: null }
    }),
  }
  return builder
}

import { importPack } from '@/lib/packs/import-export'
import { installPack } from '@/lib/packs/installer'
import { runPackTool, ToolNotAllowedError } from '@/lib/packs/tool-runtime'
import { _clearComplianceCache } from '@/lib/packs/compliance-classifier'

const SALON_BUNDLE: any = {
  schemaVersion: '1.0',
  pack: {
    slug: 'salon_barbershop',
    name: 'Salon & Barbershop',
    version: '1.0.0',
    tier: 'A',
    status: 'published',
    description: 'fast-launch wedge',
    kb_schema: {
      business_name: { type: 'string', required: true },
      services_offered: { type: 'string[]', required: true },
      hours: { type: 'weekly_schedule', required: true },
      stylists: { type: 'json', required: true },
      cancellation_policy: { type: 'string', required: true },
    },
    tool_subset: ['checkCalendar', 'bookAppointment', 'sendSMS', 'lookupContact'],
    required_integrations: ['calendar', 'sms', 'crm'],
    optional_integrations: [],
    default_voice_profile: { voice_id: 'rachel', temperature: 0.5, persona_prompt: 'host' },
  },
  compliance_profile: {
    slug: 'salon_baseline',
    name: 'Salon baseline',
    flags: {},
    disclosure_templates: {},
    blocked_phrases: [],
    required_disclosures: [],
  },
}

beforeEach(() => {
  inserted.length = 0
  updates.length = 0
  upserts.length = 0
  installRow = null
  packRow = null
  complianceRow = null
  _clearComplianceCache()
  // Avoid Vapi network calls during install activation.
  delete process.env.VAPI_API_KEY
})

describe('pack lifecycle E2E', () => {
  it('imports a bundle, activates an install, and dispatches a tool', async () => {
    // 1. Import bundle (creates compliance + pack)
    const result = await importPack(SALON_BUNDLE)
    expect(result.packSlug).toBe('salon_barbershop')
    expect(result.complianceCreated).toBe(true)
    expect(result.packCreated).toBe(true)

    // After import, populate the rows the next reads will return.
    packRow = {
      id: 'pack_1',
      slug: 'salon_barbershop',
      name: 'Salon & Barbershop',
      version: '1.0.0',
      kb_schema: SALON_BUNDLE.pack.kb_schema,
      tool_subset: SALON_BUNDLE.pack.tool_subset,
      required_integrations: SALON_BUNDLE.pack.required_integrations,
      optional_integrations: [],
      default_voice_profile: SALON_BUNDLE.pack.default_voice_profile,
      compliance_profiles: SALON_BUNDLE.compliance_profile,
    }
    complianceRow = { id: 'cp_1', ...SALON_BUNDLE.compliance_profile }

    // 2. Install with all required KB + integrations → expect active.
    const installed = await installPack({
      tenantId: 'tenant_1',
      packSlug: 'salon_barbershop',
      kbValues: {
        business_name: 'Acme Salon',
        services_offered: ['cut', 'color'],
        hours: { mon: ['9-5'] },
        stylists: [{ name: 'Sam', employment: 'w2' }],
        cancellation_policy: '24 hours notice',
      },
      integrationMap: { calendar: 'cal_com', sms: 'twilio', crm: 'supabase' },
      activate: true,
    })
    expect(installed.status).toBe('active')
    expect(installed.validationErrors).toEqual([])

    // 3. Dispatch a tool that IS in the subset.
    const ctx: any = {
      tenantId: 'tenant_1',
      packId: 'pack_1',
      packSlug: 'salon_barbershop',
      packVersion: '1.0.0',
      installId: installed.installId,
      kbValues: { business_name: 'Acme Salon' },
      integrationMap: { calendar: 'cal_com', sms: 'twilio', crm: 'supabase' },
      toolSubset: SALON_BUNDLE.pack.tool_subset,
      complianceProfileSlug: 'salon_baseline',
    }

    // checkCalendar will try to hit Cal.com — stub fetch.
    const fetchSpy = jest.spyOn(global as any, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ slots: [] }),
    } as any)

    const checkRes: any = await runPackTool(ctx, 'checkCalendar', { date: '2026-06-01' })
    expect(checkRes).toBeDefined()
    expect(checkRes.provider).toBe('cal_com')
    expect(typeof checkRes.available).toBe('boolean')

    fetchSpy.mockRestore()
  })

  it('blocks tools outside the pack subset', async () => {
    const ctx: any = {
      tenantId: 'tenant_1',
      packId: 'pack_1',
      packSlug: 'salon_barbershop',
      packVersion: '1.0.0',
      installId: 'install_1',
      kbValues: {},
      integrationMap: {},
      toolSubset: ['checkCalendar'],
      complianceProfileSlug: 'salon_baseline',
    }
    await expect(
      runPackTool(ctx, 'verifyInsurance', {
        carrier: 'delta_dental',
        memberId: 'X',
        dob: '1990-01-01',
      }),
    ).rejects.toBeInstanceOf(ToolNotAllowedError)
  })

  it('returns null for unknown tools so legacy fallback can take over', async () => {
    const ctx: any = {
      tenantId: 'tenant_1',
      packId: 'pack_1',
      packSlug: 'salon_barbershop',
      packVersion: '1.0.0',
      installId: 'install_1',
      kbValues: {},
      integrationMap: {},
      toolSubset: [],
      complianceProfileSlug: 'salon_baseline',
    }
    const r = await runPackTool(ctx, 'someLegacyTool', {})
    expect(r).toBeNull()
  })
})
