// F0521, F0523, F0524, F0529: SMS utilities
// Length validation, retry logic, and rate limiting

import { supabaseAdmin } from './supabase'

/**
 * F0521: Validate SMS body length
 * Standard SMS: 160 chars per segment, max 10 segments = 1600 chars
 */
export function validateSMSLength(body: string): {
  valid: boolean
  length: number
  segments: number
  maxLength: number
  error?: string
} {
  const length = body.length
  const maxLength = 1600 // 10 SMS segments

  // Calculate segments
  // Standard SMS: 160 chars per segment
  // With GSM-7 encoding: 160 chars
  // With Unicode (emoji, etc.): 70 chars per segment
  const hasUnicode = /[^\x00-\x7F]/.test(body)
  const charsPerSegment = hasUnicode ? 70 : 160
  const segments = Math.ceil(length / charsPerSegment)

  if (length === 0) {
    return {
      valid: false,
      length: 0,
      segments: 0,
      maxLength,
      error: 'SMS body cannot be empty',
    }
  }

  if (length > maxLength) {
    return {
      valid: false,
      length,
      segments,
      maxLength,
      error: `SMS body exceeds maximum length of ${maxLength} characters (${length} chars, ${segments} segments)`,
    }
  }

  return {
    valid: true,
    length,
    segments,
    maxLength,
  }
}

/**
 * F0529: Check SMS rate limit for a phone number
 * Max 1 SMS per number per hour
 */
export async function checkSMSRateLimit(
  phoneNumber: string,
  windowMinutes: number = 60
): Promise<{
  allowed: boolean
  lastSentAt?: string
  remainingTime?: number
}> {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

    // Check for recent SMS to this number
    const { data, error } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('created_at')
      .eq('to_number', phoneNumber)
      .eq('direction', 'outbound')
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('[SMS Rate Limit] Database error:', error)
      // Fail-open: allow send on error
      return { allowed: true }
    }

    if (data && data.length > 0) {
      const lastSentAt = data[0].created_at
      const lastSentTime = new Date(lastSentAt).getTime()
      const now = Date.now()
      const timeSinceLastSMS = now - lastSentTime
      const remainingTime = windowMinutes * 60 * 1000 - timeSinceLastSMS

      return {
        allowed: false,
        lastSentAt,
        remainingTime: Math.ceil(remainingTime / 1000 / 60), // minutes
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('[SMS Rate Limit] Error:', error)
    // Fail-open: allow send on error
    return { allowed: true }
  }
}

/**
 * F0523, F0524: Retry failed SMS with exponential backoff
 */
export interface SMSRetryConfig {
  maxRetries: number // F0523: Default 3
  baseDelayMs: number // F0524: Base delay (e.g., 1000ms)
  maxDelayMs: number // F0524: Max delay (e.g., 30000ms)
}

export const defaultRetryConfig: SMSRetryConfig = {
  maxRetries: 3, // F0523
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
}

/**
 * F0524: Calculate exponential backoff delay
 * Delay = min(baseDelay * 2^attempt, maxDelay)
 */
export function calculateBackoffDelay(
  attempt: number,
  config: SMSRetryConfig = defaultRetryConfig
): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt)
  return Math.min(delay, config.maxDelayMs)
}

/**
 * F0523: Check if SMS should be retried
 * Returns retry attempt number if should retry, null otherwise
 */
export async function shouldRetrySMS(
  messageSid: string
): Promise<{
  shouldRetry: boolean
  retryAttempt?: number
  nextRetryDelay?: number
}> {
  try {
    const { data: log } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('retry_count, status')
      .eq('message_sid', messageSid)
      .single()

    if (!log) {
      return { shouldRetry: false }
    }

    // Only retry failed/undelivered messages
    if (log.status !== 'failed' && log.status !== 'undelivered') {
      return { shouldRetry: false }
    }

    const currentRetries = log.retry_count || 0

    // F0523: Max 3 retries
    if (currentRetries >= defaultRetryConfig.maxRetries) {
      return { shouldRetry: false }
    }

    // F0524: Calculate next retry delay with exponential backoff
    const nextRetryDelay = calculateBackoffDelay(currentRetries)

    return {
      shouldRetry: true,
      retryAttempt: currentRetries + 1,
      nextRetryDelay,
    }
  } catch (error) {
    console.error('[SMS Retry] Error checking retry status:', error)
    return { shouldRetry: false }
  }
}

/**
 * F0523: Increment retry count for SMS
 */
export async function incrementSMSRetryCount(messageSid: string) {
  try {
    await supabaseAdmin.rpc('increment_sms_retry_count', {
      p_message_sid: messageSid,
    })
  } catch (error) {
    // If RPC doesn't exist, do manual increment
    const { data: log } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('retry_count')
      .eq('message_sid', messageSid)
      .single()

    if (log) {
      await supabaseAdmin
        .from('voice_agent_sms_logs')
        .update({
          retry_count: (log.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
        })
        .eq('message_sid', messageSid)
    }
  }
}

/**
 * Truncate SMS body to max length
 */
export function truncateSMS(body: string, maxLength: number = 1600): string {
  if (body.length <= maxLength) {
    return body
  }

  // Truncate and add ellipsis
  return body.substring(0, maxLength - 3) + '...'
}

/**
 * Count SMS segments for pricing calculation
 */
export function calculateSMSCost(body: string, costPerSegment: number = 0.0079): number {
  const validation = validateSMSLength(body)
  return validation.segments * costPerSegment
}

/**
 * F1489: SMS opt-out parse failure - robust parsing of opt-out keywords
 * Handles typos, variations, and edge cases
 */
export function parseSMSOptOut(messageBody: string): {
  isOptOut: boolean
  keyword?: string
  confidence: 'high' | 'medium' | 'low'
} {
  if (!messageBody || typeof messageBody !== 'string') {
    return { isOptOut: false, confidence: 'high' }
  }

  // Normalize: lowercase, trim, remove punctuation
  const normalized = messageBody.toLowerCase().trim().replace(/[^\w\s]/g, '')

  // High confidence opt-out keywords (exact match)
  const highConfidenceKeywords = [
    'stop',
    'stopall',
    'unsubscribe',
    'cancel',
    'end',
    'quit',
    'remove',
    'optout',
    'opt out',
  ]

  for (const keyword of highConfidenceKeywords) {
    if (normalized === keyword || normalized === keyword.replace(/\s/g, '')) {
      return { isOptOut: true, keyword, confidence: 'high' }
    }
  }

  // Medium confidence (contains keyword but with extra words)
  const mediumConfidencePatterns = [
    /\bstop\b/,
    /\bunsubscribe\b/,
    /\bcancel\b/,
    /\bremove me\b/,
    /\bopt out\b/,
    /\boptout\b/,
    /\bno more\b/,
    /\bdont (text|message|call|contact) me\b/,
    /\bdon't (text|message|call|contact) me\b/,
  ]

  for (const pattern of mediumConfidencePatterns) {
    if (pattern.test(normalized)) {
      const match = normalized.match(pattern)
      return {
        isOptOut: true,
        keyword: match ? match[0] : undefined,
        confidence: 'medium',
      }
    }
  }

  // Low confidence (typos and variations)
  const lowConfidencePatterns = [
    /\bstpo\b/, // typo of stop
    /\bstoop\b/, // typo of stop
    /\bstpp\b/, // typo of stop
    /\bunsbuscribe\b/, // typo of unsubscribe
    /\bunsubscirbe\b/, // typo of unsubscribe
    /\bremov\b/, // incomplete "remove"
    /\bcancel\b/,
  ]

  for (const pattern of lowConfidencePatterns) {
    if (pattern.test(normalized)) {
      return {
        isOptOut: true,
        keyword: 'possible_typo',
        confidence: 'low',
      }
    }
  }

  return { isOptOut: false, confidence: 'high' }
}
