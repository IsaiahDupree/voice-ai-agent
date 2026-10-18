/**
 * Owner portal — Sprint 6 (PRD §6 / UX-SPEC §3.5, §4.9).
 *
 * Token-authenticated read-only data access for the SMB owner. The
 * token is the credential — no passwords. Agencies issue them per
 * client; SMB owners can forward to their team (spawns a child under
 * the same parent so revocation cascades).
 *
 * Three exported functions matter:
 *   issueOwnerToken        — agency creates a root token for a tenant.
 *   verifyOwnerToken       — resolve token → tenant + scope.
 *   forwardOwnerToken      — SMB spawns a child of an existing token.
 *
 * Plus buildOwnerData, the read shape the portal page renders.
 */

import crypto from 'crypto'
import { supabaseAdmin } from './supabase'
import { getAgencyForTenant, type Agency } from './agency'

const TOKEN_TTL_DAYS = 30
const TOKEN_TTL_MS = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000

export interface OwnerTokenRow {
  id: string
  token: string
  tenant_id: string
  agency_id: string | null
  recipient_email: string | null
  recipient_name: string | null
  label: string | null
  parent_id: string | null
  expires_at: string
  revoked_at: string | null
  allow_transcripts: boolean
  last_accessed_at: string | null
  access_count: number
  created_at: string
}

export interface IssueOwnerTokenInput {
  tenantId: string
  recipientEmail?: string | null
  recipientName?: string | null
  label?: string | null
  ttlDays?: number
  allowTranscripts?: boolean
}

export async function issueOwnerToken(
  input: IssueOwnerTokenInput,
): Promise<OwnerTokenRow> {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, agency_id')
    .eq('id', input.tenantId)
    .maybeSingle()
  if (!tenant) throw new Error('tenant_not_found')

  const ttlMs = (input.ttlDays ?? TOKEN_TTL_DAYS) * 24 * 60 * 60 * 1000
  const token = crypto.randomBytes(32).toString('base64url')

  const row = {
    token,
    tenant_id: input.tenantId,
    agency_id: (tenant as any).agency_id ?? null,
    recipient_email: input.recipientEmail ?? null,
    recipient_name: input.recipientName ?? null,
    label: input.label ?? null,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
    allow_transcripts: input.allowTranscripts === true,
  }
  const { data, error } = await supabaseAdmin
    .from('owner_portal_tokens')
    .insert(row)
    .select()
    .single()
  if (error) throw new Error(`owner_token insert failed: ${error.message}`)
  return data as OwnerTokenRow
}

export type VerifyResult =
  | { ok: true; row: OwnerTokenRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'revoked' }

export async function verifyOwnerToken(token: string): Promise<VerifyResult> {
  if (!token || token.length < 16) return { ok: false, reason: 'invalid' }
  const { data } = await supabaseAdmin
    .from('owner_portal_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (!data) return { ok: false, reason: 'invalid' }
  const row = data as OwnerTokenRow
  if (row.revoked_at) return { ok: false, reason: 'revoked' }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  // Walk the parent chain — if any ancestor is revoked, the descendant
  // is dead. Cap the walk depth as a defensive measure.
  let cursor: OwnerTokenRow | null = row
  for (let i = 0; i < 8 && cursor?.parent_id; i++) {
    const { data: parent } = await supabaseAdmin
      .from('owner_portal_tokens')
      .select('*')
      .eq('id', cursor.parent_id)
      .maybeSingle()
    if (!parent) break
    cursor = parent as OwnerTokenRow
    if (cursor.revoked_at) return { ok: false, reason: 'revoked' }
  }
  return { ok: true, row }
}

export async function forwardOwnerToken(
  parentToken: string,
  newRecipientEmail?: string | null,
  newLabel?: string | null,
): Promise<OwnerTokenRow> {
  const verify = await verifyOwnerToken(parentToken)
  if (!verify.ok) throw new Error(`forward_blocked:${verify.reason}`)
  const parent = verify.row

  const token = crypto.randomBytes(32).toString('base64url')
  // Child inherits the *shorter* of: parent's remaining TTL, or default.
  // We never extend the lifetime via forwarding.
  const remaining = new Date(parent.expires_at).getTime() - Date.now()
  const ttlMs = Math.min(TOKEN_TTL_MS, remaining)
  if (ttlMs <= 0) throw new Error('forward_blocked:expired')

  const { data, error } = await supabaseAdmin
    .from('owner_portal_tokens')
    .insert({
      token,
      tenant_id: parent.tenant_id,
      agency_id: parent.agency_id,
      recipient_email: newRecipientEmail ?? null,
      label: newLabel ?? 'forwarded',
      parent_id: parent.id,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
      // Transcripts permission cannot be elevated by forwarding.
      allow_transcripts: parent.allow_transcripts,
    })
    .select()
    .single()
  if (error) throw new Error(`forward_insert_failed: ${error.message}`)
  return data as OwnerTokenRow
}

export async function revokeOwnerToken(
  tokenId: string,
  reason?: string,
): Promise<void> {
  await supabaseAdmin
    .from('owner_portal_tokens')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: reason ?? null,
    })
    .eq('id', tokenId)
}

export async function recordAccess(tokenId: string): Promise<void> {
  // Best-effort — we don't want a logging failure to break the portal.
  await supabaseAdmin
    .rpc('increment_owner_token_access', { p_token_id: tokenId })
    .then(
      () => undefined,
      // RPC may not exist in dev; fall back to a manual update.
      async () => {
        const { data } = await supabaseAdmin
          .from('owner_portal_tokens')
          .select('access_count')
          .eq('id', tokenId)
          .maybeSingle()
        const next = ((data as any)?.access_count ?? 0) + 1
        await supabaseAdmin
          .from('owner_portal_tokens')
          .update({ access_count: next, last_accessed_at: new Date().toISOString() })
          .eq('id', tokenId)
      },
    )
}

// ─── Read-data shape rendered by /owner/[token] ──────────────────────

export interface OwnerCallSummary {
  callId: string
  startedAt: string
  durationSec: number | null
  outcome: string | null
  leadScore: number | null
  nextAction: string | null
  /** Only present when allow_transcripts=true on the token. */
  redactedSummary: string | null
}

export interface OwnerData {
  tenantName: string
  packSlug: string | null
  agency: Agency | null
  periodStart: string
  periodEnd: string
  totalCalls: number
  bookedAppointments: number
  qualifiedLeads: number
  hotLeads: number
  missedCallRecoveries: number
  estRevenueCents: number
  highlights: OwnerCallSummary[]
  recentCalls: OwnerCallSummary[]
  allowTranscripts: boolean
}

const HIGH_VALUE_OUTCOMES = new Set([
  'qualified_lead',
  'soa_captured',
  'test_drive_booked',
])

export async function buildOwnerData(input: {
  tenantId: string
  allowTranscripts: boolean
  windowDays?: number
}): Promise<OwnerData | null> {
  const windowDays = input.windowDays ?? 7
  const end = new Date()
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000)

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, display_name')
    .eq('id', input.tenantId)
    .maybeSingle()
  if (!tenant) return null
  const agency = await getAgencyForTenant(input.tenantId)

  const { data: outcomes } = await supabaseAdmin
    .from('call_outcomes')
    .select(
      'call_id, outcome, revenue_estimate_cents, lead_score, next_action, pack_slug, metadata, created_at',
    )
    .eq('tenant_id', input.tenantId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })

  const callsSeen = new Set<string>()
  let bookedAppointments = 0
  let qualifiedLeads = 0
  let missedCallRecoveries = 0
  let hotLeads = 0
  let estRevenueCents = 0
  let packSlug: string | null = null
  const callIndex = new Map<string, OwnerCallSummary>()

  for (const row of (outcomes ?? []) as any[]) {
    callsSeen.add(row.call_id)
    estRevenueCents += row.revenue_estimate_cents ?? 0
    if (row.pack_slug) packSlug = row.pack_slug

    if (row.outcome === 'booked' || row.outcome === 'test_drive_booked' || row.outcome === 'service_booked') {
      bookedAppointments += 1
    }
    if (row.outcome === 'qualified_lead') qualifiedLeads += 1
    if (row.outcome === 'missed_call_recovered') missedCallRecoveries += 1
    if (typeof row.lead_score === 'number' && row.lead_score >= 75) {
      // Hot lead = max score on the call ≥ 75.
      const prev = callIndex.get(row.call_id)
      if (!prev || (prev.leadScore ?? 0) < row.lead_score) {
        if (!prev || (prev.leadScore ?? 0) < 75) hotLeads += 1
      }
    }

    const prev = callIndex.get(row.call_id)
    if (!prev || (prev.leadScore ?? 0) < (row.lead_score ?? 0)) {
      callIndex.set(row.call_id, {
        callId: row.call_id,
        startedAt: row.created_at,
        durationSec: null,
        outcome: row.outcome,
        leadScore: row.lead_score ?? null,
        nextAction: row.next_action ?? null,
        redactedSummary: input.allowTranscripts
          ? ((row.metadata as any)?.summary ?? null)
          : null,
      })
    }
  }

  const allCalls = [...callIndex.values()]
  const highlights = allCalls
    .filter(c => HIGH_VALUE_OUTCOMES.has(c.outcome ?? '') || (c.leadScore ?? 0) >= 75)
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))
    .slice(0, 3)
  const recentCalls = allCalls.slice(0, 20)

  return {
    tenantName: (tenant as any).display_name ?? (tenant as any).name ?? input.tenantId,
    packSlug,
    agency,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    totalCalls: callsSeen.size,
    bookedAppointments,
    qualifiedLeads,
    hotLeads,
    missedCallRecoveries,
    estRevenueCents,
    highlights,
    recentCalls,
    allowTranscripts: input.allowTranscripts,
  }
}
