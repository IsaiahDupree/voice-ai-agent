/**
 * Post-call follow-up — Sprint 2.4 (PRD §6.2).
 *
 * Closes the loop the agency sells:
 *   call comes in → AI talks → scoreCallById picks a next_action →
 *   this module maps next_action × pack → SMS template → schedules
 *   the send via the existing sms-helpers queue.
 *
 * Guardrails (skip_reason on the audit row tells the agency why):
 *   - no_phone           — call had no caller phone number captured.
 *   - no_consent         — TCPA consent missing for outbound.
 *   - on_dnc             — caller phone is on internal DNC.
 *   - no_template        — no template configured for this next_action.
 *   - tenant_disabled    — the tenant has post-call follow-up turned off.
 *   - already_sent       — we already wrote a follow-up for this call_id.
 *
 * Everything is logged to post_call_followups so the agency can show
 * the SMB exactly what the AI did on their behalf.
 */

import { supabaseAdmin } from './supabase'
import { sendSingleSMS } from './sms-helpers'
import type { NextAction } from './lead-scorer'

export interface FollowupSendDecision {
  status: 'queued' | 'sent' | 'skipped'
  skip_reason?: SkipReason
  delivery_id?: string
  rendered_body?: string
  template_name?: string
  next_action: NextAction
  scheduled_for: string
}

export type SkipReason =
  | 'no_phone'
  | 'no_consent'
  | 'on_dnc'
  | 'no_template'
  | 'tenant_disabled'
  | 'already_sent'
  | 'unsupported_action'

interface CallContext {
  callId: string
  tenantId: string
  packInstallId?: string | null
  packSlug?: string | null
  callerPhone?: string | null
  callerName?: string | null
  businessName?: string | null
  consentVerified?: boolean
  /** Lead score & action carried forward from the scorer. */
  leadScore?: number | null
  nextAction: NextAction
}

interface TemplateSpec {
  /** Stable template name written to the audit log. */
  name: string
  /** Body — supports {{name}}, {{business_name}}, {{action_link}} placeholders. */
  body: string
  /** Delay before the SMS is sent (seconds). 0 = immediate. */
  delaySeconds: number
}

const DEFAULT_TEMPLATES: Record<string, TemplateSpec> = {
  schedule_callback: {
    name: 'post_call_callback',
    body:
      "Hi {{name}}, thanks for calling {{business_name}}! We missed each other — reply with a good time and we'll call you back. Reply STOP to opt out.",
    delaySeconds: 120,
  },
  schedule_estimate: {
    name: 'post_call_estimate',
    body:
      "Hi {{name}}, thanks for calling {{business_name}}. We can get someone out for an estimate this week — reply with a day that works and we'll lock it in. Reply STOP to opt out.",
    delaySeconds: 120,
  },
  schedule_consultation: {
    name: 'post_call_consultation',
    body:
      "Hi {{name}}, thanks for calling {{business_name}}! Ready to set up a quick consult — reply with a time that works for you. Reply STOP to opt out.",
    delaySeconds: 120,
  },
  send_quote_sms: {
    name: 'post_call_quote',
    body:
      "Hi {{name}}, thanks for asking about pricing at {{business_name}}. A team member will follow up with a written quote shortly. Reply STOP to opt out.",
    delaySeconds: 60,
  },
  send_information_sms: {
    name: 'post_call_information',
    body:
      "Hi {{name}}, thanks for calling {{business_name}}! Here's a quick recap and our website if you want more info: {{action_link}}. Reply STOP to opt out.",
    delaySeconds: 300,
  },
  transfer_to_closer: {
    // High-intent leads get a hand-off SMS so the closer arrives prepared.
    name: 'post_call_closer_alert',
    body:
      "Hi {{name}}, thanks for calling {{business_name}}. A specialist will call you within the hour to walk through next steps. Reply STOP to opt out.",
    delaySeconds: 30,
  },
}

const SUPPORTED_ACTIONS = new Set<NextAction>([
  'schedule_callback',
  'schedule_estimate',
  'schedule_consultation',
  'send_quote_sms',
  'send_information_sms',
  'transfer_to_closer',
])

const SKIP_ACTIONS = new Set<NextAction>(['no_action', 'do_not_contact'])

function renderTemplate(
  body: string,
  vars: Record<string, string | undefined>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

/**
 * Already-followed-up check — prevents duplicate sends if the webhook
 * fires twice for the same call (Vapi retries are common).
 */
async function alreadySentFor(callId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('post_call_followups')
    .select('id')
    .eq('call_id', callId)
    .neq('status', 'failed')
    .limit(1)
  return !!(data && data.length > 0)
}

async function isOnInternalDNC(phone: string): Promise<boolean> {
  // Reuse the same internal-DNC convention scrubDNC writes to.
  const { data } = await supabaseAdmin
    .from('voice_agent_function_calls')
    .select('id')
    .eq('function_name', 'internalDNCAdded')
    .filter('parameters->>phone', 'eq', phone)
    .limit(1)
  return !!(data && data.length > 0)
}

async function tenantHasFollowupsEnabled(tenantId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('tenant_configs')
    .select('persona_name')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!data) return true // default ON when unconfigured
  // Settings live on tenants.settings.post_call_followups_disabled — a
  // per-tenant kill switch. Falls back to enabled.
  const { data: tenantRow } = await supabaseAdmin
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle()
  const disabled = (tenantRow?.settings as any)?.post_call_followups_disabled === true
  return !disabled
}

async function logFollowup(input: {
  ctx: CallContext
  decision: FollowupSendDecision
}): Promise<void> {
  await supabaseAdmin.from('post_call_followups').insert({
    call_id: input.ctx.callId,
    tenant_id: input.ctx.tenantId,
    pack_install_id: input.ctx.packInstallId ?? null,
    pack_slug: input.ctx.packSlug ?? null,
    next_action: input.decision.next_action,
    channel: 'sms',
    template_name: input.decision.template_name ?? null,
    rendered_body: input.decision.rendered_body ?? null,
    to_phone: input.ctx.callerPhone ?? null,
    scheduled_for: input.decision.scheduled_for,
    delivery_id: input.decision.delivery_id ?? null,
    lead_score: input.ctx.leadScore ?? null,
    status: input.decision.status,
    skip_reason: input.decision.skip_reason ?? null,
  })
}

/**
 * Public entrypoint. Returns the decision so callers (webhook + tests)
 * know what happened without re-querying.
 */
export async function runPostCallFollowup(
  ctx: CallContext,
): Promise<FollowupSendDecision> {
  const now = new Date()

  // Hard skips first — preserve the agency's audit story.
  if (SKIP_ACTIONS.has(ctx.nextAction)) {
    const decision: FollowupSendDecision = {
      status: 'skipped',
      skip_reason: 'unsupported_action',
      next_action: ctx.nextAction,
      scheduled_for: now.toISOString(),
    }
    await logFollowup({ ctx, decision })
    return decision
  }

  if (!SUPPORTED_ACTIONS.has(ctx.nextAction)) {
    const decision: FollowupSendDecision = {
      status: 'skipped',
      skip_reason: 'unsupported_action',
      next_action: ctx.nextAction,
      scheduled_for: now.toISOString(),
    }
    await logFollowup({ ctx, decision })
    return decision
  }

  if (!ctx.callerPhone) {
    const decision: FollowupSendDecision = {
      status: 'skipped',
      skip_reason: 'no_phone',
      next_action: ctx.nextAction,
      scheduled_for: now.toISOString(),
    }
    await logFollowup({ ctx, decision })
    return decision
  }

  if (await alreadySentFor(ctx.callId)) {
    const decision: FollowupSendDecision = {
      status: 'skipped',
      skip_reason: 'already_sent',
      next_action: ctx.nextAction,
      scheduled_for: now.toISOString(),
    }
    // Don't log a dup — the original is already there.
    return decision
  }

  if (!(await tenantHasFollowupsEnabled(ctx.tenantId))) {
    const decision: FollowupSendDecision = {
      status: 'skipped',
      skip_reason: 'tenant_disabled',
      next_action: ctx.nextAction,
      scheduled_for: now.toISOString(),
    }
    await logFollowup({ ctx, decision })
    return decision
  }

  if (await isOnInternalDNC(ctx.callerPhone)) {
    const decision: FollowupSendDecision = {
      status: 'skipped',
      skip_reason: 'on_dnc',
      next_action: ctx.nextAction,
      scheduled_for: now.toISOString(),
    }
    await logFollowup({ ctx, decision })
    return decision
  }

  const tpl = DEFAULT_TEMPLATES[ctx.nextAction as string]
  if (!tpl) {
    const decision: FollowupSendDecision = {
      status: 'skipped',
      skip_reason: 'no_template',
      next_action: ctx.nextAction,
      scheduled_for: now.toISOString(),
    }
    await logFollowup({ ctx, decision })
    return decision
  }

  const body = renderTemplate(tpl.body, {
    name: ctx.callerName?.split(' ')[0] ?? 'there',
    business_name: ctx.businessName ?? 'us',
    action_link: '',
  })

  const scheduledFor = new Date(now.getTime() + tpl.delaySeconds * 1000).toISOString()

  const send = await sendSingleSMS({
    to: ctx.callerPhone,
    message: body,
    scheduled_for: scheduledFor,
  }).catch((e: any) => ({ success: false, error: e?.message ?? 'send failed' }))

  const decision: FollowupSendDecision = {
    status: send.success ? 'queued' : 'skipped',
    skip_reason: send.success ? undefined : 'no_template',
    delivery_id: (send as any).message_sid,
    rendered_body: body,
    template_name: tpl.name,
    next_action: ctx.nextAction,
    scheduled_for: scheduledFor,
  }

  await logFollowup({ ctx, decision })
  return decision
}
