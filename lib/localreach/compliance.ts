/**
 * LocalReach V3 — Compliance Engine
 * Enforces calling hours, suppression lists, B2B-only checks,
 * and logs all compliance events.
 */
import { supabaseAdmin } from '../supabase'
import { formatE164, validatePhoneNumber } from '../sms'
import type { ComplianceCheck, ComplianceEvent, ComplianceResult } from './types'

const SUPPRESSION_WINDOW_DAYS = 90

/**
 * Run all compliance checks for a phone number before dialing.
 */
export async function checkCompliance(
  phone: string,
  businessId?: string,
  timezone: string = 'America/New_York'
): Promise<ComplianceResult> {
  const checks: ComplianceCheck[] = []
  let blocked = false
  let blockReason = ''

  // 1. Validate phone number format
  const isValid = validatePhoneNumber(phone)
  checks.push({
    check: 'phone_format',
    passed: isValid,
    reason: isValid ? 'Valid phone number format' : 'Invalid phone number format',
  })
  if (!isValid) {
    blocked = true
    blockReason = 'Invalid phone number format'
  }

  const phoneE164 = formatE164(phone)

  // 2. Suppression list check
  if (!blocked) {
    const isSuppressed = await isInSuppressionList(phoneE164)
    checks.push({
      check: 'suppression_list',
      passed: !isSuppressed,
      reason: isSuppressed
        ? 'Phone number is on the suppression list'
        : 'Not on suppression list',
    })
    if (isSuppressed) {
      blocked = true
      blockReason = 'Phone number is on the suppression list (DNC or recent contact)'
    }
  }

  // 3. Calling hours check
  if (!blocked) {
    const withinHours = isWithinCallingHours(timezone)
    checks.push({
      check: 'calling_hours',
      passed: withinHours,
      reason: withinHours
        ? 'Within permitted calling hours (8am-8pm local)'
        : 'Outside permitted calling hours (8am-8pm local)',
    })
    if (!withinHours) {
      blocked = true
      blockReason = 'Outside permitted calling hours (8am-8pm local time)'
    }
  }

  // 4. B2B check
  if (!blocked) {
    const isB2B = await checkB2BOnly(phoneE164, businessId)
    checks.push({
      check: 'b2b_verification',
      passed: isB2B,
      reason: isB2B
        ? 'Confirmed business number'
        : 'Could not verify as business number',
    })
    if (!isB2B) {
      blocked = true
      blockReason = 'Phone number could not be verified as a business number'
    }
  }

  // 5. Duplicate call check (don't call same number twice in 24 hours)
  if (!blocked) {
    const recentCallCutoff = new Date()
    recentCallCutoff.setHours(recentCallCutoff.getHours() - 24)

    const { data: recentCalls, error: recentError } = await supabaseAdmin
      .from('localreach_call_attempts')
      .select('id')
      .eq('phone_dialed', phoneE164)
      .gte('created_at', recentCallCutoff.toISOString())
      .limit(1)

    const hasRecentCall = !recentError && recentCalls && recentCalls.length > 0
    checks.push({
      check: 'duplicate_call_24h',
      passed: !hasRecentCall,
      reason: hasRecentCall
        ? 'Already called this number in the last 24 hours'
        : 'No recent calls to this number',
    })
    if (hasRecentCall) {
      blocked = true
      blockReason = 'Already called this number in the last 24 hours'
    }
  }

  // Log the compliance event
  const eventType = blocked ? 'call_blocked' : 'call_allowed'
  await logComplianceEvent({
    id: '',
    business_id: businessId || null,
    phone: phoneE164,
    event_type: eventType,
    reason: blocked ? blockReason : 'All compliance checks passed',
    details: { checks },
    created_at: new Date().toISOString(),
  })

  return {
    allowed: !blocked,
    reason: blocked ? blockReason : 'All compliance checks passed',
    checks,
  }
}

/**
 * Check if a phone number (E.164) is on the suppression list.
 */
export async function isInSuppressionList(phoneE164: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('localreach_suppression_list')
    .select('id, suppressed_until')
    .eq('phone_e164', phoneE164)
    .gte('suppressed_until', new Date().toISOString())
    .limit(1)

  if (error) {
    console.error('Suppression list check failed:', error.message)
    // Fail safe — treat as suppressed
    return true
  }

  return data !== null && data.length > 0
}

/**
 * Add a phone number to the suppression list.
 */
export async function addToSuppression(
  phone: string,
  reason: 'dnc_requested' | 'converted' | 'wrong_number' | 'complaint' | 'manual',
  businessId?: string
): Promise<void> {
  const phoneE164 = formatE164(phone)

  const suppressedUntil = new Date()
  suppressedUntil.setDate(suppressedUntil.getDate() + SUPPRESSION_WINDOW_DAYS)

  const { error } = await supabaseAdmin
    .from('localreach_suppression_list')
    .upsert(
      {
        phone_e164: phoneE164,
        business_id: businessId || null,
        reason,
        suppressed_until: suppressedUntil.toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        onConflict: 'phone_e164',
      }
    )

  if (error) {
    throw new Error(`Failed to add ${phoneE164} to suppression list: ${error.message}`)
  }

  // Log the DNC event
  await logComplianceEvent({
    id: '',
    business_id: businessId || null,
    phone: phoneE164,
    event_type: 'dnc_added',
    reason: `Added to suppression: ${reason}`,
    details: {
      suppressed_until: suppressedUntil.toISOString(),
      reason,
    },
    created_at: new Date().toISOString(),
  })

  // If DNC requested, also update the business status
  if (reason === 'dnc_requested' && businessId) {
    await supabaseAdmin
      .from('localreach_businesses')
      .update({ status: 'dnc', updated_at: new Date().toISOString() })
      .eq('id', businessId)
  }
}

/**
 * Check if the current time is within permitted calling hours (8am-8pm local).
 */
export function isWithinCallingHours(timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    const localHour = parseInt(formatter.format(new Date()), 10)
    return localHour >= 8 && localHour < 20
  } catch {
    // If timezone is invalid, default to a conservative check
    const utcHour = new Date().getUTCHours()
    // Assume US Eastern (UTC-5) and be conservative
    const estHour = (utcHour - 5 + 24) % 24
    return estHour >= 9 && estHour < 19
  }
}

/**
 * Check if a phone number belongs to a business (B2B verification).
 * Verifies against the localreach_businesses table — if the number is
 * associated with a known business record, it's considered B2B.
 */
export async function checkB2BOnly(
  phoneE164: string,
  businessId?: string
): Promise<boolean> {
  // If we have a business ID, check that the business exists and has this phone
  if (businessId) {
    const { data, error } = await supabaseAdmin
      .from('localreach_businesses')
      .select('id, phone_e164')
      .eq('id', businessId)
      .single()

    if (error || !data) return false
    return data.phone_e164 === phoneE164
  }

  // Otherwise check if any business has this phone number
  const { data, error } = await supabaseAdmin
    .from('localreach_businesses')
    .select('id')
    .eq('phone_e164', phoneE164)
    .limit(1)

  if (error) {
    console.error('B2B check failed:', error.message)
    return false
  }

  return data !== null && data.length > 0
}

/**
 * Log a compliance event to the localreach_compliance_events table.
 */
export async function logComplianceEvent(
  event: ComplianceEvent
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('localreach_compliance_events')
    .insert({
      business_id: event.business_id,
      phone: event.phone,
      event_type: event.event_type,
      reason: event.reason,
      details: event.details,
      created_at: event.created_at || new Date().toISOString(),
    })

  if (error) {
    // Log but don't throw — compliance logging should not block the call flow
    console.error('Failed to log compliance event:', error.message, event)
  }
}
