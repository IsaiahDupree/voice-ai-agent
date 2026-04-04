// F0549: SMS campaign batch - send post-campaign SMS to all contacted numbers
// F0551: SMS timezone awareness - send SMS within recipient local daytime hours (9am-9pm)
// F0555: SMS PII handling - SMS body does not include SSN/CC/passwords

import { supabaseAdmin } from './supabase'
import { getTwilioCredentials } from './test-mode'
const twilio = require('twilio')

/**
 * F0555: Check if SMS body contains PII
 * Returns true if PII detected
 */
export function containsPII(body: string): boolean {
  // SSN pattern (XXX-XX-XXXX or XXXXXXXXX)
  if (/\b\d{3}-?\d{2}-?\d{4}\b/.test(body)) {
    return true
  }

  // Credit card pattern (4-4-4-4 or 16 digits)
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(body)) {
    return true
  }

  // CVV pattern (3-4 digits standalone)
  if (/\b(CVV|CVC)[\s:]+\d{3,4}\b/i.test(body)) {
    return true
  }

  // Password/credentials keywords
  if (/\b(password|pwd|secret|api[_\s]?key|token|auth[_\s]?token)[\s:=]+\S+/i.test(body)) {
    return true
  }

  return false
}

/**
 * F0551: Check if current time is within local daytime hours
 * Returns true if OK to send (9am-9pm local time)
 */
export function isWithinLocalDaytime(timezone: string): boolean {
  try {
    // Get current time in recipient's timezone
    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }

    const formatter = new Intl.DateTimeFormat('en-US', options)
    const hourStr = formatter.format(now)
    const hour = parseInt(hourStr, 10)

    // Allow SMS between 9am (9) and 9pm (21)
    return hour >= 9 && hour < 21
  } catch (error) {
    console.error('[SMS Timezone] Error checking timezone:', error)
    // Fail-safe: allow send if timezone check fails
    return true
  }
}

/**
 * F0551: Detect timezone from phone number area code
 * Returns IANA timezone string (e.g., 'America/New_York')
 */
export function detectTimezoneFromPhone(phone: string): string {
  // Extract area code (first 3 digits after country code)
  const normalized = phone.replace(/\D/g, '')
  const areaCode = normalized.substring(normalized.length - 10, normalized.length - 7)

  // US timezone mapping by area code ranges
  const areaCodeMap: Record<string, string> = {
    // Eastern (default for most)
    default: 'America/New_York',

    // Pacific
    '206': 'America/Los_Angeles', // WA
    '213': 'America/Los_Angeles', // CA
    '310': 'America/Los_Angeles', // CA
    '323': 'America/Los_Angeles', // CA
    '415': 'America/Los_Angeles', // CA
    '510': 'America/Los_Angeles', // CA
    '619': 'America/Los_Angeles', // CA
    '650': 'America/Los_Angeles', // CA
    '714': 'America/Los_Angeles', // CA
    '818': 'America/Los_Angeles', // CA
    '858': 'America/Los_Angeles', // CA
    '916': 'America/Los_Angeles', // CA
    '949': 'America/Los_Angeles', // CA

    // Mountain
    '303': 'America/Denver', // CO
    '480': 'America/Denver', // AZ
    '602': 'America/Denver', // AZ
    '623': 'America/Denver', // AZ
    '720': 'America/Denver', // CO
    '801': 'America/Denver', // UT
    '970': 'America/Denver', // CO

    // Central
    '214': 'America/Chicago', // TX
    '281': 'America/Chicago', // TX
    '312': 'America/Chicago', // IL
    '314': 'America/Chicago', // MO
    '469': 'America/Chicago', // TX
    '512': 'America/Chicago', // TX
    '630': 'America/Chicago', // IL
    '713': 'America/Chicago', // TX
    '773': 'America/Chicago', // IL
    '817': 'America/Chicago', // TX
    '832': 'America/Chicago', // TX
    '972': 'America/Chicago', // TX
  }

  return areaCodeMap[areaCode] || areaCodeMap.default
}

/**
 * F0549: Send SMS to all contacts in campaign
 * F0551: Respects timezone - only sends during daytime hours (9am-9pm)
 * F0555: Checks for PII before sending
 */
export async function sendCampaignBatchSMS(
  campaignId: number,
  messageBody: string,
  options: {
    dryRun?: boolean
    respectTimezone?: boolean
    skipPIICheck?: boolean
  } = {}
): Promise<{
  total: number
  sent: number
  skipped: number
  failed: number
  errors: string[]
}> {
  const dryRun = options.dryRun ?? false
  const respectTimezone = options.respectTimezone ?? true
  const skipPIICheck = options.skipPIICheck ?? false

  console.log(`[Campaign SMS] Sending batch SMS for campaign ${campaignId} (dryRun: ${dryRun})`)

  // F0555: Check for PII in message body
  if (!skipPIICheck && containsPII(messageBody)) {
    throw new Error('Message body contains PII (SSN, credit card, password, etc.). Send blocked.')
  }

  try {
    // Get all contacts from campaign
    const { data: campaignContacts } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('contact_id, last_attempt_at')
      .eq('campaign_id', campaignId)
      .not('last_attempt_at', 'is', null) // Only contacts that were actually called

    if (!campaignContacts || campaignContacts.length === 0) {
      console.log('[Campaign SMS] No contacted users found')
      return { total: 0, sent: 0, skipped: 0, failed: 0, errors: [] }
    }

    const contactIds = campaignContacts.map((cc) => cc.contact_id)

    // Get contact details
    const { data: contacts } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, phone, name, opt_out_sms')
      .in('id', contactIds)

    if (!contacts) {
      return { total: 0, sent: 0, skipped: 0, failed: 0, errors: [] }
    }

    const twilioConfig = getTwilioCredentials()
    const twilioClient = dryRun ? null : twilio(twilioConfig.accountSid, twilioConfig.authToken)

    let sent = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []

    for (const contact of contacts) {
      // Skip opted-out contacts
      if (contact.opt_out_sms) {
        console.log(`[Campaign SMS] Skipping opted-out contact ${contact.id}`)
        skipped++
        continue
      }

      // F0551: Check timezone
      if (respectTimezone) {
        const timezone = detectTimezoneFromPhone(contact.phone)
        const isAllowed = isWithinLocalDaytime(timezone)

        if (!isAllowed) {
          console.log(
            `[Campaign SMS] Skipping contact ${contact.id} - outside local daytime hours (${timezone})`
          )
          skipped++
          continue
        }
      }

      // Send SMS
      if (dryRun) {
        console.log(`[Campaign SMS] [DRY RUN] Would send to ${contact.phone}: ${messageBody}`)
        sent++
      } else {
        try {
          const message = await twilioClient.messages.create({
            to: contact.phone,
            from: twilioConfig.phoneNumber,
            body: messageBody,
          })

          // Log to database
          await supabaseAdmin.from('voice_agent_sms_logs').insert({
            message_sid: message.sid,
            to_number: contact.phone,
            from_number: twilioConfig.phoneNumber,
            body: messageBody,
            status: message.status,
            contact_id: contact.id,
            direction: 'outbound',
            is_test: twilioConfig.isTest,
          })

          console.log(`[Campaign SMS] Sent to ${contact.phone}: ${message.sid}`)
          sent++
        } catch (error: any) {
          console.error(`[Campaign SMS] Failed to send to ${contact.phone}:`, error)
          errors.push(`${contact.phone}: ${error.message}`)
          failed++

          // Log failed attempt
          await supabaseAdmin.from('voice_agent_sms_logs').insert({
            to_number: contact.phone,
            from_number: twilioConfig.phoneNumber,
            body: messageBody,
            status: 'failed',
            error_message: error.message,
            contact_id: contact.id,
            direction: 'outbound',
          })
        }
      }
    }

    console.log(
      `[Campaign SMS] Batch complete: ${sent} sent, ${skipped} skipped, ${failed} failed`
    )

    return {
      total: contacts.length,
      sent,
      skipped,
      failed,
      errors,
    }
  } catch (error: any) {
    console.error('[Campaign SMS] Error:', error)
    throw error
  }
}
