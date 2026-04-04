// F0580, F0581, F0582: Contact statistics and tracking

import { supabaseAdmin } from './supabase'

/**
 * F0580: Increment call_count for contact
 */
export async function incrementContactCallCount(contactId: number): Promise<void> {
  try {
    // Use PostgreSQL increment function
    await supabaseAdmin.rpc('increment_contact_call_count', {
      p_contact_id: contactId,
    })
  } catch (error) {
    // Fallback: manual increment
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('metadata')
      .eq('id', contactId)
      .single()

    if (contact) {
      const callCount = (contact.metadata?.call_count || 0) + 1

      await supabaseAdmin
        .from('voice_agent_contacts')
        .update({
          metadata: {
            ...contact.metadata,
            call_count: callCount,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
    }
  }
}

/**
 * F0581: Increment booking_count for contact
 */
export async function incrementContactBookingCount(
  contactId: number
): Promise<void> {
  try {
    // Use PostgreSQL increment function
    await supabaseAdmin.rpc('increment_contact_booking_count', {
      p_contact_id: contactId,
    })
  } catch (error) {
    // Fallback: manual increment
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('metadata')
      .eq('id', contactId)
      .single()

    if (contact) {
      const bookingCount = (contact.metadata?.booking_count || 0) + 1

      await supabaseAdmin
        .from('voice_agent_contacts')
        .update({
          metadata: {
            ...contact.metadata,
            booking_count: bookingCount,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
    }
  }
}

/**
 * F0582: Contact source tracking
 */
export type ContactSource =
  | 'inbound_call'
  | 'outbound_call'
  | 'sms'
  | 'web_form'
  | 'import_csv'
  | 'api'
  | 'manual'

/**
 * Set contact source on creation
 */
export async function setContactSource(
  contactId: number,
  source: ContactSource
): Promise<void> {
  try {
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('metadata, source')
      .eq('id', contactId)
      .single()

    if (contact && !contact.source) {
      // Only set source if not already set
      await supabaseAdmin
        .from('voice_agent_contacts')
        .update({
          source,
          metadata: {
            ...contact.metadata,
            source_set_at: new Date().toISOString(),
          },
        })
        .eq('id', contactId)

      console.log(`[Contact] Set source for contact ${contactId}: ${source}`)
    }
  } catch (error) {
    console.error('[Contact] Failed to set source:', error)
  }
}

/**
 * Get contact statistics
 */
export async function getContactStats(contactId: number): Promise<{
  callCount: number
  bookingCount: number
  smsCount: number
  lastContact?: string
  source?: string
}> {
  try {
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('phone, metadata, source')
      .eq('id', contactId)
      .single()

    if (!contact) {
      throw new Error('Contact not found')
    }

    // Get SMS count
    const { count: smsCount } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('*', { count: 'exact', head: true })
      .or(`to_number.eq.${contact.phone},from_number.eq.${contact.phone}`)

    // Get last contact timestamp
    const { data: lastCall } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('created_at')
      .eq('customer_phone', contact.phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return {
      callCount: contact.metadata?.call_count || 0,
      bookingCount: contact.metadata?.booking_count || 0,
      smsCount: smsCount || 0,
      lastContact: lastCall?.created_at,
      source: contact.source,
    }
  } catch (error) {
    console.error('[Contact Stats] Error:', error)
    return {
      callCount: 0,
      bookingCount: 0,
      smsCount: 0,
    }
  }
}
