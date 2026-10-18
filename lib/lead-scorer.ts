/**
 * Lead scorer — Sprint 2.2 (PRD §6.2).
 *
 * Produces a 0–100 lead score + short reason strings + a recommended
 * next_action for every completed call. The score answers the SMB
 * owner's question: "is this lead worth my time, and what should
 * happen next?"
 *
 * Two layers:
 *   1. Deterministic rubric over structured signals (outcome class,
 *      booking, duration, sentiment, intent keywords). Always runs.
 *   2. (Future v1.x) LLM enhancement on the transcript for nuanced
 *      reads — "compared to competitor", "asked about timeline",
 *      "decision maker present". Not enabled in v1.0 to keep cost flat
 *      and the score reproducible.
 *
 * Lead score ≠ call-quality score. The existing lib/call-evaluator.ts
 * answers "did the agent perform well?" Lead score answers "is the
 * caller a real opportunity?" Two different jobs.
 */

import { supabaseAdmin } from './supabase'
import type { Outcome } from './packs/outcomes'

export type NextAction =
  | 'transfer_to_closer'
  | 'schedule_callback'
  | 'schedule_estimate'
  | 'schedule_consultation'
  | 'send_quote_sms'
  | 'send_information_sms'
  | 'no_action'
  | 'do_not_contact'

export interface LeadScoreSignals {
  outcome: Outcome
  /** Total call duration in seconds. */
  durationSec?: number
  /** Sentiment label produced by sentiment-detection. */
  sentiment?: 'positive' | 'neutral' | 'negative'
  /** Lower-cased transcript content (caller side preferred). */
  transcript?: string
  /** Pack slug for vertical-specific overrides. */
  packSlug?: string
  /** True when the caller asked for the price / quote — pulled from auto-tags. */
  askedForPricing?: boolean
  /** True when caller mentioned a timeline window (this week / month). */
  hasTimeline?: boolean
  /** True when caller is the decision-maker (or said so). */
  isDecisionMaker?: boolean
  /** True when caller said an in-budget signal. */
  inBudget?: boolean
}

export interface LeadScore {
  score: number // 0–100
  reasons: string[]
  next_action: NextAction
}

const HIGH_INTENT_OUTCOMES = new Set<Outcome>([
  'booked',
  'test_drive_booked',
  'service_booked',
  'soa_captured',
  'qualified_lead',
])

const ZERO_OUTCOMES = new Set<Outcome>([
  'rnd_blocked',
  'dnc_blocked',
  'voicemail',
  'cancelled',
])

const PRICING_PATTERNS = [
  /how much/i,
  /what.*cost/i,
  /\bprice/i,
  /\bquote/i,
  /\bestimate/i,
  /\bbudget/i,
]

const TIMELINE_PATTERNS = [
  /this week/i,
  /next week/i,
  /this month/i,
  /right away/i,
  /asap/i,
  /\btoday\b/i,
  /\btomorrow\b/i,
  /by (the )?(end of|monday|friday)/i,
]

const DECISION_MAKER_PATTERNS = [
  /\bI('m| am) the (owner|operator|principal|partner)\b/i,
  /\bmy (company|business|practice)\b/i,
  /I'?ll be (paying|deciding|signing)/i,
]

const BUDGET_PATTERNS = [
  /budget (is|of|set)/i,
  /can afford/i,
  /willing to spend/i,
  /\$[\d,]+/, // explicit dollar mention
]

export function deriveTranscriptSignals(transcript?: string): {
  askedForPricing: boolean
  hasTimeline: boolean
  isDecisionMaker: boolean
  inBudget: boolean
} {
  const t = transcript ?? ''
  return {
    askedForPricing: PRICING_PATTERNS.some(r => r.test(t)),
    hasTimeline: TIMELINE_PATTERNS.some(r => r.test(t)),
    isDecisionMaker: DECISION_MAKER_PATTERNS.some(r => r.test(t)),
    inBudget: BUDGET_PATTERNS.some(r => r.test(t)),
  }
}

export function scoreCall(signals: LeadScoreSignals): LeadScore {
  const reasons: string[] = []
  let score = 0

  // Hard zero — caller is not contactable or didn't really happen.
  if (ZERO_OUTCOMES.has(signals.outcome)) {
    return {
      score: 0,
      reasons: [`outcome=${signals.outcome}`],
      next_action: signals.outcome === 'voicemail' ? 'schedule_callback' : 'do_not_contact',
    }
  }

  // Outcome — dominant signal.
  if (HIGH_INTENT_OUTCOMES.has(signals.outcome)) {
    score += 50
    reasons.push(`high-intent outcome (${signals.outcome})`)
  } else if (signals.outcome === 'transferred') {
    score += 30
    reasons.push('transferred to human (mid-intent)')
  } else if (signals.outcome === 'missed_call_recovered') {
    score += 25
    reasons.push('missed-call recovery')
  } else if (signals.outcome === 'finance_handoff' || signals.outcome === 'appraisal_handoff') {
    score += 35
    reasons.push(`vertical handoff (${signals.outcome})`)
  }

  // Pull keyword signals from transcript when present.
  const fromTranscript =
    signals.transcript !== undefined ? deriveTranscriptSignals(signals.transcript) : null

  const askedForPricing = signals.askedForPricing ?? fromTranscript?.askedForPricing ?? false
  const hasTimeline = signals.hasTimeline ?? fromTranscript?.hasTimeline ?? false
  const isDecisionMaker = signals.isDecisionMaker ?? fromTranscript?.isDecisionMaker ?? false
  const inBudget = signals.inBudget ?? fromTranscript?.inBudget ?? false

  // BANT-style discovery signals — capped at +30 combined.
  let discovery = 0
  if (askedForPricing) {
    discovery += 8
    reasons.push('asked about pricing/quote')
  }
  if (hasTimeline) {
    discovery += 8
    reasons.push('mentioned a timeline')
  }
  if (isDecisionMaker) {
    discovery += 8
    reasons.push('is the decision-maker')
  }
  if (inBudget) {
    discovery += 6
    reasons.push('in-budget signal')
  }
  score += Math.min(30, discovery)

  // Engagement — duration over 60s suggests a real conversation.
  if (signals.durationSec !== undefined) {
    if (signals.durationSec >= 180) {
      score += 10
      reasons.push('engaged (3+ min)')
    } else if (signals.durationSec >= 60) {
      score += 5
      reasons.push('engaged (1+ min)')
    } else if (signals.durationSec < 20) {
      score -= 5
      reasons.push('very short call')
    }
  }

  // Sentiment — mild adjustment so noisy classifiers can't dominate.
  if (signals.sentiment === 'positive') {
    score += 5
    reasons.push('positive sentiment')
  } else if (signals.sentiment === 'negative') {
    score -= 8
    reasons.push('negative sentiment')
  }

  score = Math.max(0, Math.min(100, score))

  return {
    score,
    reasons,
    next_action: pickNextAction(score, signals, { askedForPricing, hasTimeline, isDecisionMaker }),
  }
}

function pickNextAction(
  score: number,
  signals: LeadScoreSignals,
  flags: { askedForPricing: boolean; hasTimeline: boolean; isDecisionMaker: boolean },
): NextAction {
  // Outcome-driven first — these win when set.
  if (signals.outcome === 'booked' || signals.outcome === 'test_drive_booked' || signals.outcome === 'service_booked') {
    return 'no_action'
  }
  if (signals.outcome === 'soa_captured') return 'schedule_consultation'
  if (signals.outcome === 'finance_handoff' || signals.outcome === 'appraisal_handoff') {
    return 'transfer_to_closer'
  }

  // Score-driven thresholds.
  if (score >= 75 && flags.isDecisionMaker) return 'transfer_to_closer'
  if (score >= 60 && flags.askedForPricing) return 'send_quote_sms'
  if (score >= 60 && flags.hasTimeline) return 'schedule_estimate'
  if (score >= 50) return 'schedule_callback'
  if (score >= 30) return 'send_information_sms'
  return 'no_action'
}

/**
 * Score a call by id — pulls outcome + duration + sentiment + transcript,
 * writes lead_score + lead_score_reasons + next_action back to the
 * call_outcomes row, and returns the score.
 */
export async function scoreCallById(callId: string): Promise<LeadScore | null> {
  const { data: outcomeRow } = await supabaseAdmin
    .from('call_outcomes')
    .select('outcome, pack_slug, metadata')
    .eq('call_id', callId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!outcomeRow) return null

  // Best-effort enrichment from the calls table — not all installs use it.
  let durationSec: number | undefined
  let sentiment: 'positive' | 'neutral' | 'negative' | undefined
  let transcript: string | undefined
  try {
    const { data: callRow } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('duration_seconds, customer_sentiment, transcript')
      .eq('id', callId)
      .maybeSingle()
    if (callRow) {
      durationSec = (callRow as any).duration_seconds ?? undefined
      sentiment = (callRow as any).customer_sentiment ?? undefined
      transcript = (callRow as any).transcript ?? undefined
    }
  } catch {
    /* call table optional */
  }

  const score = scoreCall({
    outcome: (outcomeRow as any).outcome,
    packSlug: (outcomeRow as any).pack_slug,
    durationSec,
    sentiment,
    transcript,
  })

  await supabaseAdmin
    .from('call_outcomes')
    .update({
      lead_score: score.score,
      lead_score_reasons: score.reasons,
      next_action: score.next_action,
    })
    .eq('call_id', callId)
    .eq('outcome', (outcomeRow as any).outcome)

  return score
}
