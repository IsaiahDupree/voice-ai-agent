/**
 * F1351: Alerting integration — Slack + PagerDuty.
 *
 * Provides a single sendAlert() entrypoint that fans out to whichever
 * destinations are configured via env. Used for critical infra failures,
 * webhook signature failures, persistent provider outages, etc.
 *
 * Env:
 *   ALERT_SLACK_WEBHOOK_URL   — incoming-webhook URL (optional)
 *   ALERT_PAGERDUTY_ROUTING_KEY — Events API v2 routing key (optional)
 *   ALERT_DEFAULT_SOURCE      — service name shown on alerts (default: voice-ai-agent)
 */

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AlertPayload {
  title: string
  message: string
  severity: AlertSeverity
  source?: string
  context?: Record<string, unknown>
  dedupeKey?: string
}

export interface AlertResult {
  delivered: string[]
  failed: { channel: string; error: string }[]
}

const SEVERITY_TO_PD: Record<AlertSeverity, 'info' | 'warning' | 'error' | 'critical'> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  critical: 'critical',
}

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info: ':information_source:',
  warning: ':warning:',
  error: ':rotating_light:',
  critical: ':fire:',
}

export async function sendAlert(payload: AlertPayload): Promise<AlertResult> {
  const result: AlertResult = { delivered: [], failed: [] }
  const source = payload.source ?? process.env.ALERT_DEFAULT_SOURCE ?? 'voice-ai-agent'

  await Promise.all([
    sendSlack(payload, source).then(
      ok => ok && result.delivered.push('slack'),
      e => result.failed.push({ channel: 'slack', error: String(e?.message ?? e) }),
    ),
    sendPagerDuty(payload, source).then(
      ok => ok && result.delivered.push('pagerduty'),
      e => result.failed.push({ channel: 'pagerduty', error: String(e?.message ?? e) }),
    ),
  ])

  return result
}

async function sendSlack(payload: AlertPayload, source: string): Promise<boolean> {
  const url = process.env.ALERT_SLACK_WEBHOOK_URL
  if (!url) return false

  const ctx = payload.context
    ? '\n```' + JSON.stringify(payload.context, null, 2).slice(0, 1500) + '```'
    : ''
  const body = {
    text: `${SEVERITY_EMOJI[payload.severity]} *${payload.title}* — \`${source}\``,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${SEVERITY_EMOJI[payload.severity]} *${payload.title}*\n${payload.message}${ctx}`,
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `severity: \`${payload.severity}\` · source: \`${source}\`` },
        ],
      },
    ],
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Slack webhook ${res.status}: ${await res.text()}`)
  return true
}

async function sendPagerDuty(payload: AlertPayload, source: string): Promise<boolean> {
  const routingKey = process.env.ALERT_PAGERDUTY_ROUTING_KEY
  if (!routingKey) return false

  const eventAction = payload.severity === 'info' ? 'acknowledge' : 'trigger'
  const body = {
    routing_key: routingKey,
    event_action: eventAction,
    dedup_key: payload.dedupeKey,
    payload: {
      summary: `${payload.title}: ${payload.message}`.slice(0, 1024),
      severity: SEVERITY_TO_PD[payload.severity],
      source,
      custom_details: payload.context ?? {},
    },
  }

  const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PagerDuty ${res.status}: ${await res.text()}`)
  return true
}

export function alertingConfigured(): { slack: boolean; pagerduty: boolean } {
  return {
    slack: !!process.env.ALERT_SLACK_WEBHOOK_URL,
    pagerduty: !!process.env.ALERT_PAGERDUTY_ROUTING_KEY,
  }
}
