// F0174: Caller reputation check - Check caller against spam reputation DB

import { supabaseAdmin } from '@/lib/supabase'

export interface CallerReputation {
  phone_number: string
  is_spam: boolean
  reputation_score: number // 0-100, where 0 is spam, 100 is trusted
  carrier?: string
  caller_type?: 'mobile' | 'landline' | 'voip' | 'unknown'
  spam_reports_count?: number
  last_checked_at: string
  source: 'twilio' | 'cache' | 'manual'
}

/**
 * F0174: Check caller reputation
 * Uses Twilio Lookup API with caller name and spam score
 */
export async function checkCallerReputation(phoneNumber: string): Promise<CallerReputation> {
  // First, check cache in database
  const cached = await getCachedReputation(phoneNumber)
  if (cached && isCacheFresh(cached.last_checked_at)) {
    return cached
  }

  // If not cached or stale, check via Twilio (if configured)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const reputation = await checkViaTwilio(phoneNumber)
      await cacheReputation(reputation)
      return reputation
    } catch (error) {
      console.error('Error checking via Twilio:', error)
      // Fall through to default
    }
  }

  // Default: unknown reputation
  const defaultReputation: CallerReputation = {
    phone_number: phoneNumber,
    is_spam: false,
    reputation_score: 50, // Neutral
    caller_type: 'unknown',
    last_checked_at: new Date().toISOString(),
    source: 'cache',
  }

  await cacheReputation(defaultReputation)
  return defaultReputation
}

/**
 * Check reputation via Twilio Lookup API
 */
async function checkViaTwilio(phoneNumber: string): Promise<CallerReputation> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  // Twilio Lookup v2 with caller name and spam score add-ons
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=caller_name,line_type_intelligence`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${credentials}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Twilio Lookup failed: ${response.statusText}`)
  }

  const data = await response.json()

  // Extract spam score if available (some Twilio add-ons provide this)
  const callerName = data.caller_name?.caller_name
  const lineType = data.line_type_intelligence?.type || 'unknown'

  // Heuristic: VoIP numbers from unknown sources are more likely spam
  let reputationScore = 50
  let isSpam = false

  if (lineType === 'voip') {
    reputationScore = 30 // Lower score for VoIP
  } else if (lineType === 'mobile') {
    reputationScore = 70 // Higher score for mobile
  } else if (lineType === 'landline') {
    reputationScore = 80 // Highest score for landline
  }

  // If caller name is blocked or spam-like, flag it
  if (callerName && (
    callerName.toLowerCase().includes('spam') ||
    callerName.toLowerCase().includes('scam') ||
    callerName.toLowerCase().includes('telemarketer')
  )) {
    isSpam = true
    reputationScore = 0
  }

  return {
    phone_number: phoneNumber,
    is_spam: isSpam,
    reputation_score: reputationScore,
    carrier: data.carrier?.name,
    caller_type: lineType,
    last_checked_at: new Date().toISOString(),
    source: 'twilio',
  }
}

/**
 * Get cached reputation from database
 */
async function getCachedReputation(phoneNumber: string): Promise<CallerReputation | null> {
  const { data, error } = await supabaseAdmin
    .from('caller_reputation_cache')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (error || !data) return null

  return {
    phone_number: data.phone_number,
    is_spam: data.is_spam,
    reputation_score: data.reputation_score,
    carrier: data.carrier,
    caller_type: data.caller_type,
    spam_reports_count: data.spam_reports_count,
    last_checked_at: data.last_checked_at,
    source: 'cache',
  }
}

/**
 * Cache reputation in database
 */
async function cacheReputation(reputation: CallerReputation): Promise<void> {
  await supabaseAdmin
    .from('caller_reputation_cache')
    .upsert({
      phone_number: reputation.phone_number,
      is_spam: reputation.is_spam,
      reputation_score: reputation.reputation_score,
      carrier: reputation.carrier,
      caller_type: reputation.caller_type,
      spam_reports_count: reputation.spam_reports_count || 0,
      last_checked_at: reputation.last_checked_at,
    }, { onConflict: 'phone_number' })
}

/**
 * Check if cached reputation is fresh (within 30 days)
 */
function isCacheFresh(lastCheckedAt: string): boolean {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  return new Date(lastCheckedAt) > thirtyDaysAgo
}

/**
 * F0174: Manually flag a phone number as spam
 */
export async function flagAsSpam(phoneNumber: string, notes?: string): Promise<void> {
  await supabaseAdmin
    .from('caller_reputation_cache')
    .upsert({
      phone_number: phoneNumber,
      is_spam: true,
      reputation_score: 0,
      last_checked_at: new Date().toISOString(),
      manual_flag: true,
      manual_flag_notes: notes,
    }, { onConflict: 'phone_number' })
}

/**
 * F0174: Handle spam caller based on reputation
 */
export async function handleSpamCaller(
  phoneNumber: string,
  reputation: CallerReputation,
  callId?: string
): Promise<{
  action: 'allow' | 'block' | 'flag'
  reason: string
}> {
  if (reputation.is_spam) {
    // Block known spam
    await logSpamCall(phoneNumber, callId, 'blocked')
    return {
      action: 'block',
      reason: 'Phone number flagged as spam',
    }
  }

  if (reputation.reputation_score < 20) {
    // Flag low reputation for review
    await logSpamCall(phoneNumber, callId, 'flagged')
    return {
      action: 'flag',
      reason: 'Low reputation score',
    }
  }

  // Allow call
  return {
    action: 'allow',
    reason: 'Reputation check passed',
  }
}

/**
 * Log spam call attempt
 */
async function logSpamCall(
  phoneNumber: string,
  callId: string | undefined,
  action: 'blocked' | 'flagged'
): Promise<void> {
  await supabaseAdmin
    .from('spam_call_log')
    .insert({
      phone_number: phoneNumber,
      call_id: callId,
      action,
      detected_at: new Date().toISOString(),
    })
}
