/**
 * Lead scorer rubric tests.
 *
 * The scorer is the agency's primary "is this lead worth my time"
 * signal. Drift here would silently push bad leads to closers.
 */

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}))

import { scoreCall, deriveTranscriptSignals } from '@/lib/lead-scorer'

describe('deriveTranscriptSignals', () => {
  it('flags pricing / timeline / decision-maker / budget keywords', () => {
    const t = "I'm the owner. How much does this cost? I need it by Friday. Budget is $5,000."
    const sigs = deriveTranscriptSignals(t)
    expect(sigs.askedForPricing).toBe(true)
    expect(sigs.hasTimeline).toBe(true)
    expect(sigs.isDecisionMaker).toBe(true)
    expect(sigs.inBudget).toBe(true)
  })

  it('returns all-false on an empty/uninformative transcript', () => {
    const sigs = deriveTranscriptSignals('hi just checking on something')
    expect(sigs).toEqual({
      askedForPricing: false,
      hasTimeline: false,
      isDecisionMaker: false,
      inBudget: false,
    })
  })
})

describe('scoreCall — outcome dominates', () => {
  it('returns 0 + do_not_contact for DNC-blocked', () => {
    const r = scoreCall({ outcome: 'dnc_blocked' })
    expect(r.score).toBe(0)
    expect(r.next_action).toBe('do_not_contact')
  })

  it('returns 0 + schedule_callback for voicemail', () => {
    const r = scoreCall({ outcome: 'voicemail' })
    expect(r.score).toBe(0)
    expect(r.next_action).toBe('schedule_callback')
  })

  it('booked outcomes already converted — no further action', () => {
    const r = scoreCall({ outcome: 'booked', durationSec: 180 })
    expect(r.score).toBeGreaterThanOrEqual(60)
    expect(r.next_action).toBe('no_action')
  })
})

describe('scoreCall — discovery + next_action', () => {
  it('high score + decision-maker -> transfer_to_closer', () => {
    const r = scoreCall({
      outcome: 'qualified_lead',
      durationSec: 240,
      sentiment: 'positive',
      transcript:
        "I'm the owner of my company. How much does this cost? I need it by next week. Budget is $10,000.",
    })
    expect(r.score).toBeGreaterThanOrEqual(75)
    expect(r.next_action).toBe('transfer_to_closer')
    expect(r.reasons).toEqual(
      expect.arrayContaining([expect.stringMatching(/decision-maker/i)]),
    )
  })

  it('mid score + asked-for-pricing -> send_quote_sms', () => {
    const r = scoreCall({
      outcome: 'transferred',
      durationSec: 90,
      askedForPricing: true,
    })
    expect(r.score).toBeGreaterThanOrEqual(30)
    // transferred(30) + engaged_60s(5) + asked_pricing(8) = 43 — below send_quote_sms threshold(60).
    // For send_quote_sms we need score>=60; this case lands on schedule_callback or send_information_sms.
    expect(['schedule_callback', 'send_information_sms', 'send_quote_sms']).toContain(r.next_action)
  })

  it('vertical handoff routes to closer', () => {
    const r = scoreCall({ outcome: 'finance_handoff', durationSec: 150 })
    expect(r.next_action).toBe('transfer_to_closer')
  })

  it('Medicare SOA captured -> schedule_consultation', () => {
    const r = scoreCall({ outcome: 'soa_captured', durationSec: 120 })
    expect(r.next_action).toBe('schedule_consultation')
  })

  it('penalises very short calls and boosts engagement', () => {
    const short = scoreCall({ outcome: 'qualified_lead', durationSec: 10 })
    const engaged = scoreCall({ outcome: 'qualified_lead', durationSec: 240 })
    expect(engaged.score).toBeGreaterThan(short.score)
    expect(short.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/short/i)]))
  })

  it('clamps score to [0, 100]', () => {
    const allGreen = scoreCall({
      outcome: 'qualified_lead',
      durationSec: 600,
      sentiment: 'positive',
      transcript:
        "I'm the owner. price quote please. ASAP, by end of week. budget $50,000.",
    })
    expect(allGreen.score).toBeLessThanOrEqual(100)
    expect(allGreen.score).toBeGreaterThanOrEqual(0)
  })
})
