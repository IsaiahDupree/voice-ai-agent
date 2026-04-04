// F0235: Time-zone clustering
// Dial same-timezone contacts in batches

import { supabaseAdmin } from './supabase'

/**
 * F0235: Get contacts clustered by timezone
 * Returns contacts grouped by timezone, sorted by timezone offset
 */
export async function getContactsByTimezone(
  campaignId: number,
  limit: number = 50
): Promise<Record<string, any[]>> {
  try {
    // Get pending contacts for this campaign
    const { data: contacts } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select(`
        *,
        contact:contact_id (
          id,
          name,
          phone,
          email,
          timezone,
          timezone_override,
          timezone_source,
          company
        )
      `)
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'retry'])
      .limit(limit)

    if (!contacts || contacts.length === 0) {
      return {}
    }

    // Group by timezone
    const byTimezone: Record<string, any[]> = {}

    for (const contact of contacts) {
      // F0258: Prefer timezone_override over auto-detected timezone
      const timezone =
        contact.contact?.timezone_override ||
        contact.contact?.timezone ||
        'America/New_York'

      if (!byTimezone[timezone]) {
        byTimezone[timezone] = []
      }

      byTimezone[timezone].push(contact)
    }

    // Sort timezones by offset (so we dial East to West as the day progresses)
    const sorted: Record<string, any[]> = {}
    const timezones = Object.keys(byTimezone).sort((a, b) => {
      const offsetA = getTimezoneOffset(a)
      const offsetB = getTimezoneOffset(b)
      return offsetB - offsetA // Descending order (UTC+12 to UTC-12)
    })

    for (const tz of timezones) {
      sorted[tz] = byTimezone[tz]
    }

    console.log(
      `Clustered ${contacts.length} contacts into ${timezones.length} timezones`
    )

    return sorted
  } catch (error) {
    console.error('Error clustering by timezone:', error)
    return {}
  }
}

/**
 * F0235: Get current calling window for timezone
 * Returns true if it's currently business hours in that timezone
 */
export function isCallingWindow(
  timezone: string,
  businessHours: { start: string; end: string } = {
    start: '09:00',
    end: '17:00',
  }
): boolean {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const timeInTz = formatter.format(now)
    const [hours, minutes] = timeInTz.split(':').map(Number)
    const currentMinutes = hours * 60 + minutes

    const [startHours, startMinutes] = businessHours.start.split(':').map(Number)
    const startTotalMinutes = startHours * 60 + startMinutes

    const [endHours, endMinutes] = businessHours.end.split(':').map(Number)
    const endTotalMinutes = endHours * 60 + endMinutes

    return currentMinutes >= startTotalMinutes && currentMinutes < endTotalMinutes
  } catch (error) {
    console.error('Error checking calling window:', error)
    return true // Default to allowing calls
  }
}

/**
 * F0235: Get timezone offset in minutes
 * Helper for sorting timezones
 */
function getTimezoneOffset(timezone: string): number {
  try {
    const date = new Date()
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))

    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60)
  } catch (error) {
    console.error(`Error getting offset for ${timezone}:`, error)
    return 0
  }
}

/**
 * F0235: Get next timezone batch to dial
 * Returns contacts from the timezone currently in business hours
 */
export async function getNextTimezoneBatch(
  campaignId: number,
  batchSize: number = 20
): Promise<any[]> {
  const clusters = await getContactsByTimezone(campaignId, batchSize * 5)

  // Find first timezone that's in calling window
  for (const [timezone, contacts] of Object.entries(clusters)) {
    if (isCallingWindow(timezone)) {
      console.log(
        `Selected ${contacts.length} contacts from ${timezone} (in calling window)`
      )
      return contacts.slice(0, batchSize)
    }
  }

  // If no timezone is in calling window, return from default timezone
  const allContacts = Object.values(clusters).flat()
  return allContacts.slice(0, batchSize)
}
