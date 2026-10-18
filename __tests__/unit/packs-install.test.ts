/**
 * Pack install lifecycle tests.
 *
 * These cover pure logic that does not need a Supabase round-trip:
 *   - validateKbValues against kb_schema (required, type, enum)
 *   - validateIntegrations against required_integrations
 *   - planUpgrade kb_schema diff (removed, typeChanged, newRequired/optional)
 *   - tool_subset enforcement via runPackTool / isToolAllowed
 *
 * The DB-touching paths (installPack, upgradeInstall, materializePersona)
 * are covered by integration tests; here we lock the contracts.
 */

import {
  validateKbValues,
  validateIntegrations,
  type KbSchema,
} from '@/lib/packs/installer'
import { planUpgrade } from '@/lib/packs/upgrade'
import { isToolAllowed } from '@/lib/packs/context'

describe('packs / installer / validateKbValues', () => {
  const schema: KbSchema = {
    business_name: { type: 'string', required: true },
    services_offered: { type: 'string[]', required: true },
    pims_provider: { type: 'string', enum: ['ezyvet', 'cornerstone'] },
    hours: { type: 'weekly_schedule', required: true },
  }

  it('flags every missing required field', () => {
    const errs = validateKbValues(schema, {})
    expect(errs).toContain('Missing required KB field: business_name')
    expect(errs).toContain('Missing required KB field: services_offered')
    expect(errs).toContain('Missing required KB field: hours')
  })

  it('flags wrong type', () => {
    const errs = validateKbValues(schema, {
      business_name: 'Acme',
      services_offered: 'wellness',
      hours: { mon: ['9-5'] },
    })
    expect(errs).toEqual(
      expect.arrayContaining([expect.stringMatching(/services_offered.*string\[]/)]),
    )
  })

  it('rejects values outside an enum', () => {
    const errs = validateKbValues(schema, {
      business_name: 'Acme',
      services_offered: ['wellness'],
      pims_provider: 'avimark',
      hours: { mon: ['9-5'] },
    })
    expect(errs).toEqual(
      expect.arrayContaining([expect.stringMatching(/pims_provider.*one of/i)]),
    )
  })

  it('passes for a fully valid payload', () => {
    const errs = validateKbValues(schema, {
      business_name: 'Acme',
      services_offered: ['wellness', 'surgery'],
      pims_provider: 'ezyvet',
      hours: { mon: ['9-5'] },
    })
    expect(errs).toEqual([])
  })
})

describe('packs / installer / validateIntegrations', () => {
  it('flags each missing required integration', () => {
    expect(validateIntegrations(['calendar', 'sms', 'crm'], { calendar: 'cal_com' })).toEqual([
      'Missing integration mapping: sms',
      'Missing integration mapping: crm',
    ])
  })
  it('passes when all required integrations are mapped', () => {
    expect(
      validateIntegrations(['calendar', 'sms'], { calendar: 'cal_com', sms: 'twilio' }),
    ).toEqual([])
  })
})

describe('packs / upgrade / planUpgrade', () => {
  const v1: KbSchema = {
    a: { type: 'string', required: true },
    b: { type: 'string[]' },
    c: { type: 'number' },
  }

  it('detects removed fields', async () => {
    const v2: KbSchema = { a: { type: 'string', required: true } }
    const plan = await planUpgrade(v1, v2, '1.0.0', '1.1.0', { a: 'x', b: ['y'], c: 1 })
    expect(plan.removed.sort()).toEqual(['b', 'c'])
    expect(plan.breaking).toBe(false)
  })

  it('flags type-changes as breaking', async () => {
    const v2: KbSchema = { a: { type: 'string', required: true }, c: { type: 'string' } }
    const plan = await planUpgrade(v1, v2, '1.0.0', '1.1.0', { a: 'x', c: 1 })
    expect(plan.typeChanged).toEqual([{ field: 'c', from: 'number', to: 'string' }])
    expect(plan.breaking).toBe(true)
  })

  it('flags new required fields without value as breaking', async () => {
    const v2: KbSchema = {
      a: { type: 'string', required: true },
      d: { type: 'string', required: true },
    }
    const plan = await planUpgrade(v1, v2, '1.0.0', '1.1.0', { a: 'x' })
    expect(plan.newRequired).toEqual(['d'])
    expect(plan.breaking).toBe(true)
  })

  it('treats new optional fields as non-breaking', async () => {
    const v2: KbSchema = { a: { type: 'string', required: true }, e: { type: 'string' } }
    const plan = await planUpgrade(v1, v2, '1.0.0', '1.1.0', { a: 'x' })
    expect(plan.newOptional).toEqual(['e'])
    expect(plan.newRequired).toEqual([])
    expect(plan.breaking).toBe(false)
  })
})

describe('packs / context / isToolAllowed', () => {
  it('allows everything when ctx is null', () => {
    expect(isToolAllowed(null, 'anyTool')).toBe(true)
  })

  it('allows everything when tool_subset is empty', () => {
    const ctx: any = { toolSubset: [], packSlug: 'x' }
    expect(isToolAllowed(ctx, 'sendSMS')).toBe(true)
  })

  it('restricts to declared tools when tool_subset is set', () => {
    const ctx: any = { toolSubset: ['checkCalendar', 'bookAppointment'], packSlug: 'x' }
    expect(isToolAllowed(ctx, 'checkCalendar')).toBe(true)
    expect(isToolAllowed(ctx, 'sendSMS')).toBe(false)
  })
})
