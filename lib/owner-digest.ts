/**
 * Owner digest — Sprint 3 (PRD §6.3).
 *
 * Renders the SMB owner's "here's what we did for you" artifact —
 * delivered as HTML email + plain-text fallback. White-labeled with the
 * agency's brand (logo, primary color, contact) when the tenant is
 * under an agency.
 *
 * The pitch the agency uses: "every Monday morning your AI receptionist
 * sends a one-pager — calls, bookings, leads, missed-call recoveries,
 * money on the table. Zero work for you."
 */

import { supabaseAdmin } from './supabase'
import { getAgencyForTenant, type Agency } from './agency'

export interface DigestPayload {
  tenantId: string
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
  highValueLeads: number
  complianceGateHits: number
  estRevenueCents: number
  followups: {
    sent: number
    queued: number
    skipped: number
  }
  topNextActions: Array<{ action: string; count: number }>
  recentHighlights: Array<{
    callId: string
    leadScore: number | null
    nextAction: string | null
    summary: string
  }>
}

export interface RenderedDigest {
  subject: string
  html: string
  text: string
  payload: DigestPayload
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

function periodFor(frequency: 'daily' | 'weekly'): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date(end)
  if (frequency === 'daily') start.setDate(start.getDate() - 1)
  else start.setDate(start.getDate() - 7)
  return { start, end }
}

export async function buildDigestPayload(input: {
  tenantId: string
  frequency: 'daily' | 'weekly'
}): Promise<DigestPayload | null> {
  const { tenantId, frequency } = input
  const { start, end } = periodFor(frequency)

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, name, display_name, agency_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return null

  const agency = await getAgencyForTenant(tenantId)

  const { data: outcomes } = await supabaseAdmin
    .from('call_outcomes')
    .select('outcome, revenue_estimate_cents, call_id, lead_score, next_action, pack_slug, metadata, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  const { data: followups } = await supabaseAdmin
    .from('post_call_followups')
    .select('status')
    .eq('tenant_id', tenantId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  let totalCalls = 0
  const callsSeen = new Set<string>()
  let bookedAppointments = 0
  let qualifiedLeads = 0
  let missedCallRecoveries = 0
  let highValueLeads = 0
  let complianceGateHits = 0
  let estRevenueCents = 0
  const nextActionCounts: Record<string, number> = {}
  const scoreByCall = new Map<string, { score: number; action: string | null; outcome: string }>()
  let packSlug: string | null = null

  for (const row of (outcomes ?? []) as any[]) {
    callsSeen.add(row.call_id)
    estRevenueCents += row.revenue_estimate_cents ?? 0
    if (row.pack_slug) packSlug = row.pack_slug

    switch (row.outcome) {
      case 'booked':
      case 'test_drive_booked':
      case 'service_booked':
        bookedAppointments += 1
        break
      case 'qualified_lead':
        qualifiedLeads += 1
        break
      case 'missed_call_recovered':
        missedCallRecoveries += 1
        break
    }
    if (HIGH_VALUE_OUTCOMES.has(row.outcome)) highValueLeads += 1
    if (COMPLIANCE_GATE_OUTCOMES.has(row.outcome)) complianceGateHits += 1

    if (row.next_action) {
      nextActionCounts[row.next_action] = (nextActionCounts[row.next_action] ?? 0) + 1
    }

    if (typeof row.lead_score === 'number') {
      const prior = scoreByCall.get(row.call_id)
      if (!prior || row.lead_score > prior.score) {
        scoreByCall.set(row.call_id, {
          score: row.lead_score,
          action: row.next_action ?? null,
          outcome: row.outcome,
        })
      }
    }
  }
  totalCalls = callsSeen.size

  let hotLeads = 0
  for (const [, info] of scoreByCall) if (info.score >= 75) hotLeads += 1

  let sent = 0
  let queued = 0
  let skipped = 0
  for (const f of (followups ?? []) as any[]) {
    if (f.status === 'sent') sent += 1
    else if (f.status === 'queued') queued += 1
    else if (f.status === 'skipped') skipped += 1
  }

  const topNextActions = Object.entries(nextActionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([action, count]) => ({ action, count }))

  // Top 3 highlights = highest score calls in the window.
  const recentHighlights = [...scoreByCall.entries()]
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3)
    .map(([callId, info]) => ({
      callId,
      leadScore: info.score,
      nextAction: info.action,
      summary: humanReadableOutcome(info.outcome),
    }))

  return {
    tenantId,
    tenantName: (tenant as any).display_name ?? (tenant as any).name ?? tenantId,
    packSlug,
    agency,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    totalCalls,
    bookedAppointments,
    qualifiedLeads,
    hotLeads,
    missedCallRecoveries,
    highValueLeads,
    complianceGateHits,
    estRevenueCents,
    followups: { sent, queued, skipped },
    topNextActions,
    recentHighlights,
  }
}

function humanReadableOutcome(outcome: string): string {
  const map: Record<string, string> = {
    booked: 'Appointment booked',
    test_drive_booked: 'Test drive booked',
    service_booked: 'Service appointment booked',
    qualified_lead: 'Qualified lead captured',
    soa_captured: 'Medicare SOA captured',
    missed_call_recovered: 'Missed call recovered',
    finance_handoff: 'Finance handoff',
    appraisal_handoff: 'Trade-in appraisal handoff',
    transferred: 'Transferred to your team',
    insurance_verified: 'Insurance verified',
    refill_requested: 'Refill requested',
    coi_issued: 'COI issued',
    fnol_triaged: 'Claim triaged',
  }
  return map[outcome] ?? outcome
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtPeriod(p: DigestPayload, frequency: 'daily' | 'weekly'): string {
  const end = new Date(p.periodEnd)
  return frequency === 'daily'
    ? `Yesterday — ${end.toLocaleDateString()}`
    : `Last 7 days — ${new Date(p.periodStart).toLocaleDateString()} to ${end.toLocaleDateString()}`
}

export function renderDigest(input: {
  payload: DigestPayload
  frequency: 'daily' | 'weekly'
  /** Owner-portal deep link — added to footer when present. */
  portalUrl?: string
}): RenderedDigest {
  const { payload: p, frequency, portalUrl } = input
  const periodLabel = fmtPeriod(p, frequency)
  const accent = p.agency?.primary_color ?? '#2563eb'
  const brandName = p.agency?.name ?? p.tenantName
  const logoUrl = p.agency?.logo_url ?? null
  const contact = p.agency?.contact_email ?? null

  const subject = `${frequency === 'daily' ? 'Daily' : 'Weekly'} update for ${p.tenantName} — ${p.bookedAppointments} booked, ${p.hotLeads} hot leads`

  const text = [
    `Hi from ${brandName}!`,
    `${p.tenantName} — ${periodLabel}`,
    ``,
    `Your AI receptionist:`,
    ``,
    ` • Handled ${p.totalCalls} calls`,
    ` • Booked ${p.bookedAppointments} appointments`,
    ` • Captured ${p.qualifiedLeads} qualified leads (${p.hotLeads} hot — score 75+)`,
    ` • Recovered ${p.missedCallRecoveries} missed calls`,
    ` • Estimated revenue captured: $${(p.estRevenueCents / 100).toFixed(0)}`,
    ``,
    p.recentHighlights.length
      ? `Top moments:\n${p.recentHighlights
          .map((h, i) => ` ${i + 1}. ${h.summary}${h.leadScore != null ? ` (lead score ${h.leadScore})` : ''}`)
          .join('\n')}`
      : '',
    ``,
    p.followups.sent + p.followups.queued > 0
      ? `Follow-ups: ${p.followups.sent} sent, ${p.followups.queued} queued, ${p.followups.skipped} skipped (audit log).`
      : '',
    p.complianceGateHits > 0
      ? `Compliance gates fired ${p.complianceGateHits} time${p.complianceGateHits === 1 ? '' : 's'} — every regulated event logged.`
      : '',
    ``,
    portalUrl ? `See more details: ${portalUrl}` : '',
    contact ? `Questions? Reply to this email or contact ${contact}.` : 'Questions? Just reply.',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f7f9;color:#111;">
<div style="max-width:600px;margin:0 auto;padding:24px;background:#fff;">
  <div style="border-bottom:3px solid ${escapeHtml(accent)};padding-bottom:12px;margin-bottom:16px;">
    ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName)}" style="max-height:40px;display:block;margin-bottom:8px;"/>` : ''}
    <div style="font-size:20px;font-weight:600;">${escapeHtml(p.tenantName)}</div>
    <div style="color:#666;font-size:13px;">${escapeHtml(periodLabel)} · prepared by ${escapeHtml(brandName)}</div>
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
    <tr>
      <td style="padding:8px;background:#f1f5f9;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.04em;">Calls</div>
        <div style="font-size:24px;font-weight:600;">${p.totalCalls}</div>
      </td>
      <td style="width:8px;"></td>
      <td style="padding:8px;background:#dcfce7;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:0.04em;">Booked</div>
        <div style="font-size:24px;font-weight:600;color:#15803d;">${p.bookedAppointments}</div>
      </td>
      <td style="width:8px;"></td>
      <td style="padding:8px;background:#dbeafe;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.04em;">Qualified</div>
        <div style="font-size:24px;font-weight:600;color:#1d4ed8;">${p.qualifiedLeads}</div>
      </td>
    </tr>
    <tr><td colspan="5" style="height:8px;"></td></tr>
    <tr>
      <td style="padding:8px;background:#fee2e2;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.04em;">Hot leads</div>
        <div style="font-size:24px;font-weight:600;color:#b91c1c;">${p.hotLeads}</div>
      </td>
      <td style="width:8px;"></td>
      <td style="padding:8px;background:#fef3c7;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:#a16207;text-transform:uppercase;letter-spacing:0.04em;">Missed recovered</div>
        <div style="font-size:24px;font-weight:600;color:#a16207;">${p.missedCallRecoveries}</div>
      </td>
      <td style="width:8px;"></td>
      <td style="padding:8px;background:#dcfce7;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:0.04em;">Est. revenue</div>
        <div style="font-size:24px;font-weight:600;color:#15803d;">$${(p.estRevenueCents / 100).toFixed(0)}</div>
      </td>
    </tr>
  </table>

  ${
    p.recentHighlights.length
      ? `<div style="margin-bottom:16px;">
    <div style="font-weight:600;margin-bottom:6px;">Top moments</div>
    <ol style="margin:0;padding-left:20px;color:#333;font-size:14px;line-height:1.6;">
      ${p.recentHighlights
        .map(
          h =>
            `<li>${escapeHtml(h.summary)}${
              h.leadScore != null ? ` <span style="color:#666;">(score ${h.leadScore})</span>` : ''
            }</li>`,
        )
        .join('')}
    </ol>
  </div>`
      : ''
  }

  ${
    p.followups.sent + p.followups.queued > 0
      ? `<div style="font-size:13px;color:#444;margin-bottom:8px;">
    Follow-ups: <b>${p.followups.sent} sent</b>, ${p.followups.queued} queued, ${p.followups.skipped} skipped.
  </div>`
      : ''
  }

  ${
    p.complianceGateHits > 0
      ? `<div style="font-size:12px;color:#666;margin-bottom:8px;">
    Compliance gates fired ${p.complianceGateHits} time${p.complianceGateHits === 1 ? '' : 's'} — every regulated event logged for your audit file.
  </div>`
      : ''
  }

  ${
    portalUrl
      ? `<div style="margin:16px 0 0;padding:14px;background:#f9fafb;border-radius:8px;text-align:center;">
    <a href="${escapeHtml(portalUrl)}" style="display:inline-block;padding:10px 18px;background:${escapeHtml(accent)};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
      See more details →
    </a>
    <div style="font-size:11px;color:#888;margin-top:6px;">Live view of your AI receptionist's work — refresh any time.</div>
  </div>`
      : ''
  }

  <div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:12px;font-size:12px;color:#666;">
    Prepared by ${escapeHtml(brandName)}.${
      contact ? ` Questions? Reply to this email or contact <a href="mailto:${escapeHtml(contact)}" style="color:${escapeHtml(accent)};">${escapeHtml(contact)}</a>.` : ' Questions? Just reply.'
    }
  </div>
</div>
</body></html>`

  return { subject, html, text, payload: p }
}
