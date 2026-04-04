// F0525: SMS delivery timeout - retry failed/pending SMS with exponential backoff

import { supabaseAdmin } from '@/lib/supabase'
import { sendSMS } from '@/lib/sms'

interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 5000, // 5 seconds
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
}

/**
 * F0525: Calculate next retry delay using exponential backoff
 */
export function calculateRetryDelay(
  attemptNumber: number,
  config: RetryConfig = defaultRetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1)
  return Math.min(delay, config.maxDelayMs)
}

/**
 * F0525: Check for timed-out SMS and retry
 */
export async function processSMSTimeouts(config: RetryConfig = defaultRetryConfig): Promise<{
  checked: number
  retried: number
  failed: number
}> {
  const supabase = supabaseAdmin
  const now = new Date()
  const timeoutThreshold = new Date(now.getTime() - 60000) // 1 minute timeout

  // Find messages that are pending/sending and older than timeout threshold
  const { data: timedOutMessages, error } = await supabase
    .from('sms_messages')
    .select('*')
    .in('status', ['pending', 'sending'])
    .lt('created_at', timeoutThreshold.toISOString())
    .lt('retry_count', config.maxRetries)

  if (error || !timedOutMessages) {
    console.error('Failed to fetch timed-out SMS:', error)
    return { checked: 0, retried: 0, failed: 0 }
  }

  let retried = 0
  let failed = 0

  for (const message of timedOutMessages) {
    const retryCount = (message.retry_count || 0) + 1

    if (retryCount > config.maxRetries) {
      // Mark as failed
      await supabase
        .from('sms_messages')
        .update({
          status: 'failed',
          error: 'Max retries exceeded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id)

      failed++
      continue
    }

    try {
      // Retry sending
      const result = await sendSMS({
        to: message.to_number,
        body: message.body,
        from: message.from_number,
      })

      // Update message
      await supabase
        .from('sms_messages')
        .update({
          status: result.status === 'sent' ? 'sent' : 'failed',
          twilio_sid: result.sid,
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id)

      retried++
    } catch (err: any) {
      console.error(`Failed to retry SMS ${message.id}:`, err)

      await supabase
        .from('sms_messages')
        .update({
          status: retryCount >= config.maxRetries ? 'failed' : 'pending',
          error: err.message,
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id)

      if (retryCount >= config.maxRetries) {
        failed++
      }
    }
  }

  return {
    checked: timedOutMessages.length,
    retried,
    failed,
  }
}

/**
 * F0525: Schedule retry for a specific message
 */
export async function scheduleMessageRetry(messageId: string, delayMs?: number): Promise<void> {
  const supabase = supabaseAdmin

  const { data: message } = await supabase
    .from('sms_messages')
    .select('retry_count')
    .eq('id', messageId)
    .single()

  if (!message) {
    throw new Error(`Message ${messageId} not found`)
  }

  const retryCount = (message.retry_count || 0) + 1
  const delay = delayMs || calculateRetryDelay(retryCount)

  // Schedule retry (in production, use a job queue like BullMQ or Inngest)
  setTimeout(async () => {
    try {
      const { data: msg } = await supabase
        .from('sms_messages')
        .select('*')
        .eq('id', messageId)
        .single()

      if (!msg) return

      const result = await sendSMS({
        to: msg.to_number,
        body: msg.body,
        from: msg.from_number,
      })

      await supabase
        .from('sms_messages')
        .update({
          status: result.status === 'sent' ? 'sent' : 'failed',
          twilio_sid: result.sid,
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId)
    } catch (err) {
      console.error(`Retry failed for message ${messageId}:`, err)
    }
  }, delay)
}
