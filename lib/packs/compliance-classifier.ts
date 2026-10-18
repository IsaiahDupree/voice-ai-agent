/**
 * Server-side compliance classifier.
 *
 * Second gate beyond the system prompt: scans agent utterances against
 * the active pack's compliance profile and either logs the violation
 * (severity 'warning') or blocks delivery (severity 'blocked').
 *
 * Why server-side: prompts can be jailbroken; the legal-intake UPL gate
 * and the no-diagnosis gate cannot rely on prompt discipline alone.
 *
 * Usage from the webhook transcript handler:
 *   const verdict = await classifyAgentUtterance({ ctx, callId, utterance })
 *   if (verdict.severity === 'blocked') replaceWithSafeFallback()
 */

import { supabaseAdmin } from '../supabase'
import type { PackContext } from './context'

export interface ComplianceViolation {
  rule: string
  matchedPhrase: string
  severity: 'warning' | 'blocked'
}

export interface ClassifyInput {
  ctx: PackContext
  callId?: string
  utterance: string
  source?: 'agent' | 'tool_response'
}

export interface ClassifyVerdict {
  violations: ComplianceViolation[]
  severity: 'ok' | 'warning' | 'blocked'
  redactedUtterance: string
}

interface ComplianceProfileShape {
  slug?: string
  blocked_phrases?: string[]
  flags?: Record<string, unknown>
}

const profileCache = new Map<string, { profile: ComplianceProfileShape; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60_000

export function _clearComplianceCache(): void {
  profileCache.clear()
}

async function loadProfile(slug: string | undefined): Promise<ComplianceProfileShape | null> {
  if (!slug) return null
  const cached = profileCache.get(slug)
  if (cached && cached.expiresAt > Date.now()) return cached.profile

  const { data } = await supabaseAdmin
    .from('compliance_profiles')
    .select('slug, blocked_phrases, flags')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return null
  const profile = data as ComplianceProfileShape
  profileCache.set(slug, { profile, expiresAt: Date.now() + CACHE_TTL_MS })
  return profile
}

// Hard rules layered on top of pack-supplied blocked_phrases. These are
// regulatory requirements the platform owns regardless of pack config.
const HARD_RULES: { rule: string; pattern: RegExp; appliesIf: (p: ComplianceProfileShape) => boolean; severity: 'warning' | 'blocked' }[] = [
  {
    rule: 'no_diagnosis',
    pattern: /\b(you (definitely )?(have|need)|your diagnosis is|i diagnose|i'?m diagnosing)\b/i,
    appliesIf: p => !!p.flags?.no_diagnosis || !!p.flags?.hipaa,
    severity: 'blocked',
  },
  {
    rule: 'no_dosage_change',
    pattern: /\b(increase the dose|decrease the dose|double the dose|stop taking)\b/i,
    appliesIf: p => !!p.flags?.no_dosage_change,
    severity: 'blocked',
  },
  {
    rule: 'no_case_evaluation',
    pattern: /\b(you have a (strong|good) case|your case is worth|the statute of limitations is)\b/i,
    appliesIf: p => !!p.flags?.upl_classifier,
    severity: 'blocked',
  },
  {
    rule: 'no_finance_quote_without_nmls',
    pattern: /\b(your (rate|apr|payment) (is|will be)|i can lock in)\b/i,
    appliesIf: p => !!p.flags?.nmls_per_utterance_gate,
    severity: 'blocked',
  },
  {
    rule: 'no_allergen_safety_confirmation',
    pattern: /\b(that('s| is) safe for|no (allergens|gluten)|gluten[- ]?free guaranteed)\b/i,
    appliesIf: p => !!p.flags?.never_confirm_allergen_safety,
    severity: 'blocked',
  },
]

export async function classifyAgentUtterance(input: ClassifyInput): Promise<ClassifyVerdict> {
  const profile = await loadProfile(input.ctx.complianceProfileSlug)
  if (!profile) {
    return { violations: [], severity: 'ok', redactedUtterance: input.utterance }
  }

  const violations: ComplianceViolation[] = []
  let redacted = input.utterance

  // Pack-supplied blocked_phrases (literal, case-insensitive).
  for (const phrase of profile.blocked_phrases ?? []) {
    if (!phrase) continue
    const re = new RegExp(escapeRegex(phrase), 'i')
    if (re.test(input.utterance)) {
      violations.push({ rule: 'blocked_phrase', matchedPhrase: phrase, severity: 'blocked' })
      redacted = redacted.replace(re, '[REDACTED]')
    }
  }

  // Platform-owned hard rules conditioned on flags.
  for (const r of HARD_RULES) {
    if (!r.appliesIf(profile)) continue
    const m = input.utterance.match(r.pattern)
    if (m) {
      violations.push({ rule: r.rule, matchedPhrase: m[0], severity: r.severity })
      redacted = redacted.replace(r.pattern, '[REDACTED]')
    }
  }

  const severity: ClassifyVerdict['severity'] = violations.length === 0
    ? 'ok'
    : violations.some(v => v.severity === 'blocked')
      ? 'blocked'
      : 'warning'

  if (severity !== 'ok') {
    await logViolations(input, profile.slug, violations, redacted)
  }

  return { violations, severity, redactedUtterance: redacted }
}

async function logViolations(
  input: ClassifyInput,
  profileSlug: string | undefined,
  violations: ComplianceViolation[],
  redacted: string,
): Promise<void> {
  const rows = violations.map(v => ({
    call_id: input.callId ?? null,
    tenant_id: input.ctx.tenantId,
    pack_install_id: input.ctx.installId,
    compliance_profile_slug: profileSlug ?? null,
    rule: v.rule,
    matched_phrase: v.matchedPhrase,
    utterance: input.utterance,
    redacted_utterance: redacted,
    severity: v.severity,
    source: input.source ?? 'agent',
  }))
  await supabaseAdmin.from('compliance_violations').insert(rows)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Safe fallback substitution when severity === 'blocked'. Pack-aware:
 * tunes the deflection language to the kind of rule that was hit.
 */
export function safeFallback(verdict: ClassifyVerdict): string {
  const top = verdict.violations[0]?.rule
  switch (top) {
    case 'no_diagnosis':
      return "I'm not able to diagnose over the phone. Let me have a clinical team member follow up with you."
    case 'no_dosage_change':
      return 'I can\'t adjust medication doses. I\'ll route you to a clinician.'
    case 'no_case_evaluation':
      return 'I\'m not the right person to evaluate your case. Let me get an attorney to follow up.'
    case 'no_finance_quote_without_nmls':
      return 'Rate and payment details have to come from a licensed loan officer. Let me get one to call you back.'
    case 'no_allergen_safety_confirmation':
      return 'Allergen-safety questions go to our staff directly — let me transfer you to the kitchen.'
    default:
      return 'Let me get a team member to follow up on that for you.'
  }
}
