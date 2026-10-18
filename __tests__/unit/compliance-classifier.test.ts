/**
 * Unit tests for the compliance classifier.
 *
 * Mocks the Supabase admin client so we can isolate the rule engine.
 */

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      insert: jest.fn(async () => ({ error: null })),
    })),
  },
}))

import {
  classifyAgentUtterance,
  safeFallback,
  _clearComplianceCache,
} from '@/lib/packs/compliance-classifier'
import { supabaseAdmin } from '@/lib/supabase'

const ctx: any = {
  tenantId: 't1',
  packId: 'p1',
  packSlug: 'dental_clinic',
  packVersion: '1.0.0',
  installId: 'i1',
  kbValues: {},
  integrationMap: {},
  toolSubset: [],
  complianceProfileSlug: 'hipaa_dental',
}

function mockProfile(profile: any) {
  ;(supabaseAdmin.from as jest.Mock).mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({ data: profile, error: null })),
    insert: jest.fn(async () => ({ error: null })),
  }))
}

describe('compliance classifier', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    _clearComplianceCache()
  })

  it('returns ok when no profile is found', async () => {
    mockProfile(null)
    const v = await classifyAgentUtterance({ ctx, utterance: 'You have a cavity.' })
    expect(v.severity).toBe('ok')
  })

  it('blocks pack-supplied blocked phrases', async () => {
    mockProfile({ slug: 'hipaa_dental', blocked_phrases: ['you have a cavity'], flags: {} })
    const v = await classifyAgentUtterance({ ctx, utterance: "Looks like you have a cavity!" })
    expect(v.severity).toBe('blocked')
    expect(v.redactedUtterance).toContain('[REDACTED]')
  })

  it('fires no_diagnosis hard rule when hipaa flag set', async () => {
    mockProfile({ slug: 'hipaa_dental', blocked_phrases: [], flags: { hipaa: true } })
    const v = await classifyAgentUtterance({
      ctx,
      utterance: 'You definitely have an infection — your diagnosis is severe.',
    })
    expect(v.severity).toBe('blocked')
    expect(v.violations.some(x => x.rule === 'no_diagnosis')).toBe(true)
  })

  it('does NOT fire no_diagnosis when flag absent', async () => {
    mockProfile({ slug: 'restaurant', blocked_phrases: [], flags: {} })
    const v = await classifyAgentUtterance({ ctx, utterance: 'Your diagnosis is unclear.' })
    expect(v.severity).toBe('ok')
  })

  it('blocks UPL-pattern utterances when upl_classifier flag set', async () => {
    mockProfile({
      slug: 'legal_intake',
      blocked_phrases: [],
      flags: { upl_classifier: true },
    })
    const v = await classifyAgentUtterance({
      ctx,
      utterance: 'You have a strong case here.',
    })
    expect(v.severity).toBe('blocked')
    expect(v.violations.some(x => x.rule === 'no_case_evaluation')).toBe(true)
  })

  it('blocks rate quotes when nmls_per_utterance_gate set', async () => {
    mockProfile({ slug: 'mortgage', blocked_phrases: [], flags: { nmls_per_utterance_gate: true } })
    const v = await classifyAgentUtterance({
      ctx,
      utterance: 'Your rate will be 6.875 percent.',
    })
    expect(v.severity).toBe('blocked')
  })

  it('blocks allergen confirmation when never_confirm_allergen_safety set', async () => {
    mockProfile({
      slug: 'restaurant',
      blocked_phrases: [],
      flags: { never_confirm_allergen_safety: true },
    })
    const v = await classifyAgentUtterance({ ctx, utterance: "Yes, that's safe for celiac." })
    expect(v.severity).toBe('blocked')
  })
})

describe('safeFallback', () => {
  it('routes by violation rule', () => {
    expect(
      safeFallback({
        severity: 'blocked',
        redactedUtterance: '',
        violations: [{ rule: 'no_diagnosis', matchedPhrase: 'x', severity: 'blocked' }],
      }),
    ).toMatch(/diagnose/i)
    expect(
      safeFallback({
        severity: 'blocked',
        redactedUtterance: '',
        violations: [{ rule: 'no_case_evaluation', matchedPhrase: 'x', severity: 'blocked' }],
      }),
    ).toMatch(/attorney/i)
  })
})
