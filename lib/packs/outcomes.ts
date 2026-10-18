/**
 * Pack telemetry — recordOutcome + per-pack rollup.
 *
 * Pack tools call recordOutcome() to write a canonical row keyed
 * uniquely by (call_id, outcome). The dashboard rolls up across all
 * outcomes per pack_install for the ROI tile.
 *
 * Revenue estimates use a simple per-outcome floor; tenants can refine
 * via metadata.revenue_estimate_cents on the call.
 */

import { supabaseAdmin } from '../supabase'
import type { PackContext } from './context'

export type Outcome =
  | 'booked'
  | 'rescheduled'
  | 'cancelled'
  | 'transferred'
  | 'voicemail'
  | 'emergency_escalated'
  | 'allergen_flagged'
  | 'life_safety_interrupted'
  | 'refill_requested'
  | 'insurance_verified'
  | 'missed_call_recovered'
  | 'review_requested'
  | 'qualified_lead'
  | 'test_drive_booked'
  | 'service_booked'
  | 'finance_handoff'
  | 'appraisal_handoff'
  | 'recall_logged'
  | 'rnd_blocked'
  | 'dnc_blocked'
  | 'carrier_not_appointed'
  | 'producer_not_licensed'
  | 'soa_captured'
  | 'tpmo_disclosed'
  | 'coi_issued'
  | 'fnol_triaged'
  | 'no_action'

interface RecordOutcomeInput {
  ctx: PackContext
  callId: string
  outcome: Outcome
  revenueEstimateCents?: number
  /** 0–100 lead score; null/undefined when not yet scored. */
  leadScore?: number
  /** Short strings the scorer credited (e.g. "asked for pricing", "in-budget"). */
  leadScoreReasons?: string[]
  /** Recommended next action (e.g. schedule_estimate, send_quote_sms). */
  nextAction?: string
  metadata?: Record<string, unknown>
}

const FLOOR_REVENUE_CENTS: Partial<Record<Outcome, number>> = {
  booked: 8500_00 / 100, // $85 placeholder; tenant overrides in kb_values.avg_appointment_value_cents
  emergency_escalated: 0,
  refill_requested: 0,
  insurance_verified: 0,
  missed_call_recovered: 8500_00 / 100,
  qualified_lead: 5000,
  test_drive_booked: 25000,
  service_booked: 15000,
  finance_handoff: 0,
  appraisal_handoff: 0,
  recall_logged: 0,
  rnd_blocked: 0,
  dnc_blocked: 0,
  carrier_not_appointed: 0,
  producer_not_licensed: 0,
  soa_captured: 30000,
  tpmo_disclosed: 0,
  coi_issued: 0,
  fnol_triaged: 0,
}

export async function recordOutcome(input: RecordOutcomeInput): Promise<void> {
  const tenantOverride =
    typeof input.ctx.kbValues.avg_appointment_value_cents === 'number'
      ? (input.ctx.kbValues.avg_appointment_value_cents as number)
      : null

  const revenue =
    input.revenueEstimateCents ??
    (input.outcome === 'booked' || input.outcome === 'missed_call_recovered'
      ? tenantOverride ?? FLOOR_REVENUE_CENTS[input.outcome] ?? 0
      : FLOOR_REVENUE_CENTS[input.outcome] ?? 0)

  await supabaseAdmin.from('call_outcomes').upsert(
    {
      call_id: input.callId,
      tenant_id: input.ctx.tenantId,
      pack_install_id: input.ctx.installId,
      pack_slug: input.ctx.packSlug,
      outcome: input.outcome,
      revenue_estimate_cents: Math.round(revenue),
      lead_score: input.leadScore ?? null,
      lead_score_reasons: input.leadScoreReasons ?? null,
      next_action: input.nextAction ?? null,
      metadata: input.metadata ?? {},
    },
    { onConflict: 'call_id,outcome' },
  )
}

export interface PackRollup {
  packSlug: string
  installId: string
  totals: Partial<Record<Outcome, number>>
  totalCalls: number
  revenueCents: number
}

export async function rollupForTenant(
  tenantId: string,
  sinceIsoDate?: string,
): Promise<PackRollup[]> {
  let query = supabaseAdmin
    .from('call_outcomes')
    .select('pack_install_id, pack_slug, outcome, revenue_estimate_cents, call_id')
    .eq('tenant_id', tenantId)
  if (sinceIsoDate) query = query.gte('created_at', sinceIsoDate)

  const { data, error } = await query
  if (error || !data) return []

  const map = new Map<string, PackRollup>()
  const callsSeen = new Map<string, Set<string>>()

  for (const row of data as any[]) {
    const key = String(row.pack_install_id ?? row.pack_slug ?? 'unknown')
    if (!map.has(key)) {
      map.set(key, {
        packSlug: row.pack_slug ?? 'unknown',
        installId: row.pack_install_id ?? '',
        totals: {},
        totalCalls: 0,
        revenueCents: 0,
      })
      callsSeen.set(key, new Set())
    }
    const r = map.get(key)!
    r.totals[row.outcome as Outcome] = (r.totals[row.outcome as Outcome] ?? 0) + 1
    r.revenueCents += row.revenue_estimate_cents ?? 0
    callsSeen.get(key)!.add(row.call_id)
  }
  for (const [key, r] of map) r.totalCalls = callsSeen.get(key)?.size ?? 0
  return [...map.values()]
}
