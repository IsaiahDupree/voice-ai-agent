/**
 * Digest send orchestrator.
 *
 * Picks digest_subscriptions that are due, builds the payload, renders
 * HTML+text, sends via Resend, and logs to digest_sends.
 */

import { supabaseAdmin } from './supabase'
import { sendEmail } from './email'
import { buildDigestPayload, renderDigest } from './owner-digest'
import { issueOwnerToken } from './owner-portal'

async function ensurePortalUrl(input: {
  tenantId: string
  recipientEmail: string
  recipientName?: string | null
}): Promise<string | undefined> {
  // Reuse a still-valid token for this (tenant, email) when one exists;
  // otherwise mint a fresh 30-day one.
  const nowIso = new Date().toISOString()
  const { data: existing } = await supabaseAdmin
    .from('owner_portal_tokens')
    .select('token, expires_at, revoked_at')
    .eq('tenant_id', input.tenantId)
    .eq('recipient_email', input.recipientEmail)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
  let token = (existing as any[] | null)?.[0]?.token as string | undefined
  if (!token) {
    try {
      const row = await issueOwnerToken({
        tenantId: input.tenantId,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName ?? null,
        label: 'auto_digest',
      })
      token = row.token
    } catch {
      return undefined // never fail the digest because the portal mint failed
    }
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${origin}/owner/${encodeURIComponent(token)}`
}

interface SubRow {
  id: string
  tenant_id: string
  recipient_email: string
  recipient_name: string | null
  frequency: 'daily' | 'weekly' | 'off'
  send_hour_local: number
  send_day_of_week: number
  last_sent_at: string | null
}

const DAILY_INTERVAL_MS = 22 * 60 * 60 * 1000 // tolerate ±2h drift
const WEEKLY_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000

export async function listDueSubscriptions(now: Date = new Date()): Promise<SubRow[]> {
  const { data } = await supabaseAdmin
    .from('digest_subscriptions')
    .select('id, tenant_id, recipient_email, recipient_name, frequency, send_hour_local, send_day_of_week, last_sent_at')
    .neq('frequency', 'off')

  if (!data) return []

  return (data as SubRow[]).filter(s => isDue(s, now))
}

function isDue(s: SubRow, now: Date): boolean {
  if (s.frequency === 'off') return false
  if (!s.last_sent_at) return true
  const last = new Date(s.last_sent_at).getTime()
  const interval = s.frequency === 'daily' ? DAILY_INTERVAL_MS : WEEKLY_INTERVAL_MS
  return now.getTime() - last >= interval
}

export interface SendResult {
  subscriptionId: string
  tenantId: string
  status: 'sent' | 'failed' | 'skipped'
  error?: string
  messageId?: string
}

export async function sendDigestForSubscription(sub: SubRow): Promise<SendResult> {
  if (sub.frequency === 'off') {
    return { subscriptionId: sub.id, tenantId: sub.tenant_id, status: 'skipped' }
  }
  const payload = await buildDigestPayload({
    tenantId: sub.tenant_id,
    frequency: sub.frequency,
  })
  if (!payload) {
    return {
      subscriptionId: sub.id,
      tenantId: sub.tenant_id,
      status: 'skipped',
      error: 'tenant_not_found',
    }
  }

  const portalUrl = await ensurePortalUrl({
    tenantId: sub.tenant_id,
    recipientEmail: sub.recipient_email,
    recipientName: sub.recipient_name ?? null,
  })
  const rendered = renderDigest({ payload, frequency: sub.frequency, portalUrl })
  const fromAgency = payload.agency
    ? `${payload.agency.name} <${payload.agency.contact_email ?? process.env.EMAIL_FROM ?? 'noreply@voiceaiagent.com'}>`
    : undefined

  let sendResult: any
  let status: 'sent' | 'failed' = 'sent'
  let error: string | undefined
  try {
    sendResult = await sendEmail({
      to: sub.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
      from: fromAgency,
    })
    if (!sendResult?.success) {
      status = 'failed'
      error = sendResult?.error ?? 'unknown_send_error'
    }
  } catch (e: any) {
    status = 'failed'
    error = e?.message ?? 'send threw'
  }

  await supabaseAdmin.from('digest_sends').insert({
    subscription_id: sub.id,
    tenant_id: sub.tenant_id,
    recipient_email: sub.recipient_email,
    period_start: payload.periodStart,
    period_end: payload.periodEnd,
    payload: payload as any,
    subject: rendered.subject,
    provider_message_id: sendResult?.data?.id ?? sendResult?.messageId ?? null,
    status: status === 'sent' ? 'sent' : 'failed',
    error: error ?? null,
  })

  if (status === 'sent') {
    await supabaseAdmin
      .from('digest_subscriptions')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', sub.id)
  }

  return {
    subscriptionId: sub.id,
    tenantId: sub.tenant_id,
    status,
    error,
    messageId: sendResult?.data?.id ?? sendResult?.messageId,
  }
}

/**
 * Cron-friendly entrypoint. Picks all due subscriptions and sends them
 * in parallel (capped). Returns per-sub status for monitoring.
 */
export async function runDigestCron(opts?: { now?: Date; concurrency?: number }): Promise<SendResult[]> {
  const now = opts?.now ?? new Date()
  const concurrency = opts?.concurrency ?? 5
  const due = await listDueSubscriptions(now)
  if (due.length === 0) return []

  const results: SendResult[] = []
  let cursor = 0
  async function worker() {
    while (cursor < due.length) {
      const i = cursor++
      const sub = due[i]
      const r = await sendDigestForSubscription(sub).catch(
        (e: any): SendResult => ({
          subscriptionId: sub.id,
          tenantId: sub.tenant_id,
          status: 'failed',
          error: e?.message ?? 'worker threw',
        }),
      )
      results.push(r)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, () => worker()))
  return results
}

/**
 * Sample digest — manual send the agency triggers from the dashboard
 * to preview what an SMB owner will get. Tagged status='sample' so the
 * audit log differentiates from cron runs.
 */
export async function sendSampleDigest(input: {
  tenantId: string
  recipientEmail: string
  frequency: 'daily' | 'weekly'
}): Promise<SendResult> {
  const payload = await buildDigestPayload({
    tenantId: input.tenantId,
    frequency: input.frequency,
  })
  if (!payload) {
    return {
      subscriptionId: 'sample',
      tenantId: input.tenantId,
      status: 'skipped',
      error: 'tenant_not_found',
    }
  }
  const portalUrl = await ensurePortalUrl({
    tenantId: input.tenantId,
    recipientEmail: input.recipientEmail,
  })
  const rendered = renderDigest({ payload, frequency: input.frequency, portalUrl })
  const fromAgency = payload.agency
    ? `${payload.agency.name} <${payload.agency.contact_email ?? process.env.EMAIL_FROM ?? 'noreply@voiceaiagent.com'}>`
    : undefined

  let status: 'sent' | 'failed' = 'sent'
  let error: string | undefined
  let sendResult: any
  try {
    sendResult = await sendEmail({
      to: input.recipientEmail,
      subject: `[SAMPLE] ${rendered.subject}`,
      html: rendered.html,
      from: fromAgency,
    })
    if (!sendResult?.success) {
      status = 'failed'
      error = sendResult?.error ?? 'unknown_send_error'
    }
  } catch (e: any) {
    status = 'failed'
    error = e?.message ?? 'send threw'
  }

  await supabaseAdmin.from('digest_sends').insert({
    subscription_id: null,
    tenant_id: input.tenantId,
    recipient_email: input.recipientEmail,
    period_start: payload.periodStart,
    period_end: payload.periodEnd,
    payload: payload as any,
    subject: `[SAMPLE] ${rendered.subject}`,
    provider_message_id: sendResult?.data?.id ?? null,
    status: status === 'sent' ? 'sample' : 'failed',
    error: error ?? null,
  })

  return {
    subscriptionId: 'sample',
    tenantId: input.tenantId,
    status,
    error,
    messageId: sendResult?.data?.id,
  }
}
