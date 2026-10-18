/**
 * Agency-tier helpers.
 *
 * An agency owns many tenants (SMB clients). This file resolves the
 * agency context for a request and rolls up per-client KPIs.
 *
 * Lookup precedence:
 *   1. explicit agencyId arg
 *   2. user_id → agency_users → agency
 *   3. tenant_id → tenants.agency_id → agency
 */

import { supabaseAdmin } from './supabase'

export interface Agency {
  id: string
  slug: string
  name: string
  logo_url: string | null
  primary_color: string | null
  contact_email: string | null
  contact_phone: string | null
  plan: 'starter' | 'growth' | 'scale' | 'enterprise'
  max_clients: number
  status: 'active' | 'suspended' | 'archived'
  settings: Record<string, unknown>
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

export interface AgencyClientKpi {
  tenantId: string
  displayName: string
  packSlug: string | null
  totalCalls: number
  bookedAppointments: number
  qualifiedLeads: number
  missedCallRecoveries: number
  highValueLeads: number
  complianceGateHits: number
  estRevenueCents: number
  lastCallAt: string | null
  /** Average lead_score across scored outcomes (0–100). Null if none scored. */
  avgLeadScore: number | null
  /** Calls with lead_score >= 75 — agency's "act on this now" bucket. */
  hotLeads: number
  /** Distribution of next_action across scored outcomes. */
  nextActions: Record<string, number>
}

export async function getAgencyById(id: string): Promise<Agency | null> {
  const { data, error } = await supabaseAdmin
    .from('agencies')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as Agency
}

export async function getAgencyForUser(userId: string): Promise<Agency | null> {
  const { data: membership } = await supabaseAdmin
    .from('agency_users')
    .select('agency_id, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership?.agency_id) return null
  return getAgencyById(membership.agency_id as string)
}

export async function getAgencyForTenant(tenantId: string): Promise<Agency | null> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('agency_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!data?.agency_id) return null
  return getAgencyById(data.agency_id as string)
}

const HIGH_VALUE_OUTCOMES = new Set(['qualified_lead', 'soa_captured', 'test_drive_booked'])
const COMPLIANCE_GATE_OUTCOMES = new Set([
  'rnd_blocked',
  'dnc_blocked',
  'carrier_not_appointed',
  'producer_not_licensed',
  'tpmo_disclosed',
  'soa_captured',
])

/**
 * Roll up per-client KPIs for the agency dashboard.
 *
 * `sinceIsoDate` defaults to last 30 days. Pulls from call_outcomes so
 * any pack-driven outcome is captured automatically — no per-vertical
 * branching needed here.
 */
export async function listClientsWithKpis(
  agencyId: string,
  sinceIsoDate?: string,
): Promise<AgencyClientKpi[]> {
  const since = sinceIsoDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: tenants, error: tErr } = await supabaseAdmin
    .from('tenants')
    .select('id, name, display_name')
    .eq('agency_id', agencyId)
  if (tErr || !tenants) return []

  if (tenants.length === 0) return []

  const tenantIds = tenants.map(t => t.id)

  const { data: outcomes } = await supabaseAdmin
    .from('call_outcomes')
    .select(
      'tenant_id, pack_slug, outcome, revenue_estimate_cents, call_id, created_at, lead_score, next_action',
    )
    .in('tenant_id', tenantIds)
    .gte('created_at', since)

  const byTenant = new Map<string, AgencyClientKpi>()
  for (const t of tenants) {
    byTenant.set(t.id, {
      tenantId: t.id,
      displayName: t.display_name ?? t.name ?? t.id,
      packSlug: null,
      totalCalls: 0,
      bookedAppointments: 0,
      qualifiedLeads: 0,
      missedCallRecoveries: 0,
      highValueLeads: 0,
      complianceGateHits: 0,
      estRevenueCents: 0,
      lastCallAt: null,
      avgLeadScore: null,
      hotLeads: 0,
      nextActions: {},
    })
  }

  // Score accumulator — we average per call (a call may have multiple
  // outcomes scored at the same number; dedupe by call_id).
  const scoreByCall = new Map<string, { tid: string; score: number }>()

  const callsSeen = new Map<string, Set<string>>()
  for (const t of tenants) callsSeen.set(t.id, new Set())

  for (const row of (outcomes ?? []) as any[]) {
    const k = byTenant.get(row.tenant_id)
    if (!k) continue
    if (row.pack_slug) k.packSlug = row.pack_slug
    callsSeen.get(row.tenant_id)?.add(row.call_id)
    k.estRevenueCents += row.revenue_estimate_cents ?? 0

    switch (row.outcome) {
      case 'booked':
      case 'test_drive_booked':
      case 'service_booked':
        k.bookedAppointments += 1
        break
      case 'qualified_lead':
        k.qualifiedLeads += 1
        break
      case 'missed_call_recovered':
        k.missedCallRecoveries += 1
        break
    }
    if (HIGH_VALUE_OUTCOMES.has(row.outcome)) k.highValueLeads += 1
    if (COMPLIANCE_GATE_OUTCOMES.has(row.outcome)) k.complianceGateHits += 1

    if (typeof row.lead_score === 'number') {
      // Keep the highest score recorded for a call (in case multiple
      // outcomes/scoring passes wrote different numbers).
      const prior = scoreByCall.get(row.call_id)
      if (!prior || row.lead_score > prior.score) {
        scoreByCall.set(row.call_id, { tid: row.tenant_id, score: row.lead_score })
      }
    }
    if (row.next_action) {
      k.nextActions[row.next_action] = (k.nextActions[row.next_action] ?? 0) + 1
    }

    if (!k.lastCallAt || row.created_at > k.lastCallAt) k.lastCallAt = row.created_at
  }

  for (const [tid, ks] of byTenant) ks.totalCalls = callsSeen.get(tid)?.size ?? 0

  // Average lead score + hot-lead count per tenant.
  const scoreTotals = new Map<string, { sum: number; n: number; hot: number }>()
  for (const [, info] of scoreByCall) {
    const t = scoreTotals.get(info.tid) ?? { sum: 0, n: 0, hot: 0 }
    t.sum += info.score
    t.n += 1
    if (info.score >= 75) t.hot += 1
    scoreTotals.set(info.tid, t)
  }
  for (const [tid, k] of byTenant) {
    const t = scoreTotals.get(tid)
    if (t && t.n > 0) {
      k.avgLeadScore = Math.round(t.sum / t.n)
      k.hotLeads = t.hot
    }
  }

  return [...byTenant.values()].sort((a, b) => b.totalCalls - a.totalCalls)
}

/**
 * Provision a new client tenant under an agency. Returns the new tenant
 * row. Caller is responsible for installing a pack onto the tenant.
 */
export async function provisionClient(input: {
  agencyId: string
  displayName: string
  legalName?: string
  slug?: string
  provisionedBy?: string
  phoneNumbers?: string[]
}): Promise<{ tenantId: string; slug: string } | { error: string }> {
  const agency = await getAgencyById(input.agencyId)
  if (!agency) return { error: 'agency_not_found' }
  if (agency.status !== 'active') return { error: `agency_${agency.status}` }

  // Enforce max_clients entitlement.
  const { count } = await supabaseAdmin
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agency.id)
  if (typeof count === 'number' && count >= agency.max_clients) {
    return { error: 'max_clients_reached' }
  }

  const slug =
    input.slug ??
    input.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) +
      '-' +
      Math.random().toString(36).slice(2, 6)

  const tenantId = `t_${Math.random().toString(36).slice(2, 12)}`

  const { error } = await supabaseAdmin.from('tenants').insert({
    id: tenantId,
    name: input.legalName ?? input.displayName,
    slug,
    display_name: input.displayName,
    agency_id: agency.id,
    plan: 'pro',
    phone_numbers: input.phoneNumbers ?? [],
    provisioned_by: input.provisionedBy ?? null,
  })
  if (error) return { error: error.message }

  await supabaseAdmin
    .from('tenant_configs')
    .insert({ tenant_id: tenantId, kb_namespace: tenantId })
    .then(() => undefined, () => undefined)

  return { tenantId, slug }
}
