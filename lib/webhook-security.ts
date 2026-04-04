// F1161: Webhook replay attack prevention - Reject webhook events older than 5min
// F1162: Webhook event dedup - Prevent replay by storing processed event IDs

import { supabaseAdmin } from './supabase'

const WEBHOOK_EVENT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * F1161: Validate webhook timestamp to prevent replay attacks
 * Reject events older than 5 minutes
 */
export function validateWebhookTimestamp(timestamp: string | number): {
  valid: boolean
  error?: string
} {
  const eventTime = new Date(timestamp).getTime()
  const now = Date.now()
  const age = now - eventTime

  // Reject events older than 5 minutes
  if (age > WEBHOOK_EVENT_TIMEOUT_MS) {
    return {
      valid: false,
      error: `Webhook event too old (${Math.floor(age / 1000)}s), must be within 5 minutes`,
    }
  }

  // Reject events from the future (more than 1 minute ahead)
  if (age < -60000) {
    return {
      valid: false,
      error: 'Webhook event timestamp is in the future',
    }
  }

  return { valid: true }
}

/**
 * F1162: Check if webhook event has already been processed
 * Prevent replay attacks by storing and checking event IDs
 */
export async function checkWebhookEventProcessed(
  eventId: string,
  provider: string
): Promise<{
  processed: boolean
  eventRecord?: any
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_webhook_events')
      .select('*')
      .eq('event_id', eventId)
      .eq('provider', provider)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return {
      processed: !!data,
      eventRecord: data || undefined,
    }
  } catch (error: any) {
    console.error('Error checking webhook event:', error)
    return { processed: false }
  }
}

/**
 * F1162: Record a processed webhook event
 * Store event ID to prevent duplicate processing
 */
export async function recordWebhookEvent(params: {
  eventId: string
  provider: string
  eventType: string
  payload: any
  processedAt?: Date
}): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('voice_agent_webhook_events')
      .insert({
        event_id: params.eventId,
        provider: params.provider,
        event_type: params.eventType,
        payload: params.payload,
        processed_at: (params.processedAt || new Date()).toISOString(),
      })

    if (error) {
      // Ignore duplicate key errors (event already processed)
      if (error.code === '23505') {
        return false
      }
      throw error
    }

    return true
  } catch (error: any) {
    console.error('Error recording webhook event:', error)
    return false
  }
}

/**
 * Secure webhook processing flow
 * 1. Validate timestamp (F1161)
 * 2. Check for duplicates (F1162)
 * 3. Process event
 * 4. Record event
 */
export async function processWebhookSecurely(params: {
  eventId: string
  eventType: string
  provider: string
  timestamp: string | number
  payload: any
  processor: (payload: any) => Promise<any>
}): Promise<{
  success: boolean
  error?: string
  result?: any
}> {
  // F1161: Validate timestamp
  const timestampValidation = validateWebhookTimestamp(params.timestamp)
  if (!timestampValidation.valid) {
    return {
      success: false,
      error: timestampValidation.error,
    }
  }

  // F1162: Check for duplicates
  const { processed } = await checkWebhookEventProcessed(
    params.eventId,
    params.provider
  )

  if (processed) {
    return {
      success: false,
      error: 'Webhook event already processed',
    }
  }

  try {
    // Process the event
    const result = await params.processor(params.payload)

    // Record the event
    await recordWebhookEvent({
      eventId: params.eventId,
      provider: params.provider,
      eventType: params.eventType,
      payload: params.payload,
    })

    return {
      success: true,
      result,
    }
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return {
      success: false,
      error: error.message || 'Failed to process webhook',
    }
  }
}
