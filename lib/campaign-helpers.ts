// Campaign helper functions for outbound calling
// F0193-F0243: DNC, voicemail, retry logic, TCPA compliance, etc.

import { supabaseAdmin } from './supabase'

// F0193: Check if number is on DNC list
export async function checkDNC(phone: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_dnc')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (error) {
      console.error('Error checking DNC:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('Error in checkDNC:', error)
    return false
  }
}

// F0195: Self-service opt-out - Add number to DNC
export async function addToDNC(
  phone: string,
  source: 'manual' | 'self-service' | 'import' = 'self-service',
  reason?: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('voice_agent_dnc').insert({
      phone,
      source,
      reason: reason || 'Caller requested removal',
      added_at: new Date().toISOString(),
    })

    if (error && error.code !== '23505') {
      // Ignore duplicate key errors
      console.error('Error adding to DNC:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in addToDNC:', error)
    return false
  }
}

// F0265: Validate E.164 phone number format
export function validateE164(phone: string): boolean {
  // E.164 format: +[country code][subscriber number]
  // Max 15 digits, must start with +
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phone)
}

// F0226, F0227: TCPA compliance - Check if we can call this number now
export async function canCallNow(
  phone: string,
  campaign: {
    tcpa_compliance?: boolean
    calling_window?: {
      start: string // "HH:MM"
      end: string // "HH:MM"
      timezone?: string
    }
  }
): Promise<{ canCall: boolean; reason?: string; localTime?: string }> {
  // F0265: Validate E.164 format
  if (!validateE164(phone)) {
    return { canCall: false, reason: 'Invalid phone number format' }
  }

  // F0193: Check DNC list
  const isDNC = await checkDNC(phone)
  if (isDNC) {
    return { canCall: false, reason: 'Number on DNC list' }
  }

  // F0226: TCPA compliance mode - enforce 8am-9pm local time
  if (campaign.tcpa_compliance !== false) {
    // F0227: Contact local time check - get timezone from area code
    const timezone = getTimezoneFromPhone(phone)
    const localTime = new Date().toLocaleString('en-US', { timeZone: timezone })
    const localHour = new Date(localTime).getHours()

    // TCPA: 8am to 9pm local time
    if (localHour < 8 || localHour >= 21) {
      return {
        canCall: false,
        reason: 'Outside TCPA calling hours (8am-9pm local)',
        localTime: localTime,
      }
    }
  }

  // Check campaign calling window if specified
  if (campaign.calling_window) {
    const { start, end, timezone = 'America/New_York' } = campaign.calling_window
    const now = new Date().toLocaleString('en-US', { timeZone: timezone })
    const currentHour = new Date(now).getHours()
    const currentMinute = new Date(now).getMinutes()

    const [startHour, startMinute] = start.split(':').map(Number)
    const [endHour, endMinute] = end.split(':').map(Number)

    const currentTime = currentHour * 60 + currentMinute
    const startTime = startHour * 60 + startMinute
    const endTime = endHour * 60 + endMinute

    if (currentTime < startTime || currentTime >= endTime) {
      return {
        canCall: false,
        reason: `Outside calling window (${start}-${end} ${timezone})`,
      }
    }
  }

  return { canCall: true }
}

// F0227: Get timezone from phone number area code (simplified)
function getTimezoneFromPhone(phone: string): string {
  // Extract area code (first 3 digits after country code)
  const areaCode = phone.replace(/^\+1/, '').substring(0, 3)

  // Simplified US timezone mapping by area code
  // Eastern: 2xx, 3xx, 4xx, 5xx
  // Central: 2xx, 3xx, 5xx, 6xx, 7xx
  // Mountain: 3xx, 4xx, 5xx, 6xx, 7xx, 8xx
  // Pacific: 2xx, 3xx, 4xx, 5xx, 6xx, 7xx, 8xx, 9xx

  // This is a simplified version - in production, use a full area code database
  const easternCodes = ['201', '202', '203', '212', '215', '216', '301', '302', '305', '401', '404', '407', '410', '412', '413', '414', '415', '508', '516', '518', '607', '617', '703', '704', '718', '802', '914', '919']
  const centralCodes = ['205', '214', '217', '256', '281', '312', '314', '316', '318', '319', '402', '405', '409', '414', '501', '504', '507', '512', '608', '612', '615', '618', '630', '708', '713', '715', '817', '901', '903', '913', '918', '920']
  const mountainCodes = ['303', '307', '385', '406', '435', '480', '505', '520', '602', '623', '702', '719', '720', '801', '928']
  const pacificCodes = ['206', '209', '213', '253', '310', '323', '360', '408', '415', '425', '503', '510', '530', '541', '559', '562', '619', '626', '650', '661', '707', '714', '760', '805', '818', '831', '858', '909', '916', '925', '949', '951']

  if (easternCodes.includes(areaCode)) return 'America/New_York'
  if (centralCodes.includes(areaCode)) return 'America/Chicago'
  if (mountainCodes.includes(areaCode)) return 'America/Denver'
  if (pacificCodes.includes(areaCode)) return 'America/Los_Angeles'

  // Default to Eastern
  return 'America/New_York'
}

// F0264: Check if contact has exceeded max call attempts
export async function hasExceededMaxAttempts(
  campaignId: number,
  contactId: number,
  maxAttempts: number
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('attempts')
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)
      .single()

    if (error || !data) return false

    return data.attempts >= maxAttempts
  } catch (error) {
    console.error('Error checking max attempts:', error)
    return false
  }
}

// F0209: Check if contact should be excluded from retry (already booked)
export async function shouldExcludeFromRetry(
  campaignId: number,
  contactId: number
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('outcome')
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)
      .single()

    if (error || !data) return false

    // F0209: Skip retry if contact already booked
    return data.outcome === 'booked'
  } catch (error) {
    console.error('Error checking retry exclusion:', error)
    return false
  }
}

// F0223: Inject contact variables into script
export function injectScriptVariables(
  script: string,
  contact: { first_name?: string; last_name?: string; company?: string; [key: string]: any }
): string {
  let result = script

  // Replace {{variable}} patterns with contact data
  result = result.replace(/\{\{first_name\}\}/g, contact.first_name || 'there')
  result = result.replace(/\{\{last_name\}\}/g, contact.last_name || '')
  result = result.replace(/\{\{name\}\}/g, contact.first_name || 'there')
  result = result.replace(/\{\{company\}\}/g, contact.company || 'your company')

  // Replace any other custom fields
  Object.keys(contact).forEach((key) => {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(pattern, String(contact[key] || ''))
  })

  return result
}

// F0212: Update campaign contact outcome
export async function updateCampaignOutcome(
  campaignId: number,
  contactId: number,
  outcome: 'booked' | 'no-answer' | 'dnc' | 'voicemail' | 'failed',
  callId?: string
): Promise<boolean> {
  try {
    // Fetch current attempts count
    const { data: currentContact } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('attempts')
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)
      .single();

    const updates: any = {
      outcome,
      attempts: (currentContact?.attempts || 0) + 1,
      last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (callId) {
      updates.last_call_id = callId
    }

    if (outcome === 'booked') {
      updates.booked_at = new Date().toISOString()
      updates.status = 'completed'
    } else if (outcome === 'dnc') {
      updates.status = 'dnc'
    } else if (outcome === 'failed') {
      updates.status = 'failed'
    }

    const { error } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .update(updates)
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)

    if (error) {
      console.error('Error updating campaign outcome:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in updateCampaignOutcome:', error)
    return false
  }
}
