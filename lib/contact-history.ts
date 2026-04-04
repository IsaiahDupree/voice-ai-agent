// F0365: lookupContact history
// Track contact lookup history and interaction timeline

import { supabaseAdmin } from './supabase'

export interface ContactHistoryEntry {
  id: string
  contact_id: string
  event_type: string
  event_data: Record<string, any>
  created_at: string
}

/**
 * F0365: Log contact lookup event
 * Records when a contact is looked up during a call
 */
export async function logContactLookup(
  contactId: string,
  phone: string,
  callId?: string
): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_contact_history').insert({
      contact_id: contactId,
      event_type: 'lookup',
      event_data: {
        phone,
        call_id: callId,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ContactHistory] Failed to log lookup:', error)
  }
}

/**
 * F0365: Get contact history
 * Returns timeline of all interactions with a contact
 */
export async function getContactHistory(
  contactId: string,
  limit: number = 50
): Promise<ContactHistoryEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('voice_agent_contact_history')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[ContactHistory] Failed to fetch history:', error)
    return []
  }

  return data || []
}

/**
 * F0365: Log contact interaction
 * Records any type of interaction (call, email, SMS, booking, etc.)
 */
export async function logContactInteraction(
  contactId: string,
  eventType: string,
  eventData: Record<string, any>
): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_contact_history').insert({
      contact_id: contactId,
      event_type: eventType,
      event_data: eventData,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ContactHistory] Failed to log interaction:', error)
  }
}

/**
 * F0365: Get contact interaction count by type
 */
export async function getContactInteractionCounts(
  contactId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from('voice_agent_contact_history')
    .select('event_type')
    .eq('contact_id', contactId)

  if (error || !data) {
    return {}
  }

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.event_type] = (counts[row.event_type] || 0) + 1
  }

  return counts
}
