// F1169: Contact data portability - GET /api/contacts/export includes all PII
// F1170: Contact data deletion - DELETE /api/contacts/:id removes all PII
// F1171: GDPR compliance - Data retention and deletion policies enforced
// F1478: API key inactive expiry - Expire API keys unused for 90 days

import { supabaseAdmin } from './supabase'

// F1169: Export all contact data including PII
export async function exportContactData(contactId: string) {
  try {
    // Get contact with all PII fields
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (contactError) throw contactError

    // Get all related data
    const [calls, sms, bookings, feedback] = await Promise.all([
      supabaseAdmin
        .from('voice_agent_calls')
        .select('*')
        .eq('contact_id', contactId),
      supabaseAdmin
        .from('voice_agent_sms_logs')
        .select('*')
        .eq('to_number', contact.phone),
      supabaseAdmin
        .from('voice_agent_bookings')
        .select('*')
        .eq('attendee_phone', contact.phone),
      supabaseAdmin
        .from('voice_agent_feedback')
        .select('*')
        .eq('contact_id', contactId),
    ])

    return {
      contact: contact,
      calls: calls.data || [],
      sms: sms.data || [],
      bookings: bookings.data || [],
      feedback: feedback.data || [],
      exported_at: new Date().toISOString(),
    }
  } catch (error: any) {
    console.error('Error exporting contact data:', error)
    throw error
  }
}

// F1170: Delete all contact PII (GDPR right to erasure)
export async function deleteContactData(contactId: string, reason?: string) {
  try {
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('phone, email')
      .eq('id', contactId)
      .single()

    if (!contact) {
      throw new Error('Contact not found')
    }

    // Log deletion request for audit trail
    await supabaseAdmin.from('voice_agent_deletion_requests').insert({
      contact_id: contactId,
      phone: contact.phone,
      email: contact.email,
      reason: reason || 'GDPR erasure request',
      requested_at: new Date().toISOString(),
      status: 'processing',
    })

    // Anonymize PII in calls
    await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        contact_name: '[REDACTED]',
        from_number: contact.phone ? '[REDACTED]' : null,
        transcript: '[REDACTED]',
        recording_url: null,
      })
      .eq('contact_id', contactId)

    // Anonymize PII in SMS logs
    await supabaseAdmin
      .from('voice_agent_sms_logs')
      .update({
        to_number: '[REDACTED]',
        body: '[REDACTED]',
      })
      .eq('to_number', contact.phone)

    // Anonymize booking data
    await supabaseAdmin
      .from('voice_agent_bookings')
      .update({
        attendee_name: '[REDACTED]',
        attendee_email: '[REDACTED]',
        attendee_phone: '[REDACTED]',
      })
      .eq('attendee_phone', contact.phone)

    // Delete feedback (no business need to retain)
    await supabaseAdmin
      .from('voice_agent_feedback')
      .delete()
      .eq('contact_id', contactId)

    // Finally, anonymize contact record
    await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        name: '[REDACTED]',
        email: '[REDACTED]',
        phone: '[REDACTED]',
        company: null,
        notes: null,
        metadata: null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    // Mark deletion as complete
    await supabaseAdmin
      .from('voice_agent_deletion_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId)

    console.log(`Contact ${contactId} PII deleted successfully`)
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting contact data:', error)

    // Mark deletion as failed
    await supabaseAdmin
      .from('voice_agent_deletion_requests')
      .update({
        status: 'failed',
        error: error.message,
      })
      .eq('contact_id', contactId)

    throw error
  }
}

// F1171: Enforce data retention policies
export async function enforceDataRetention() {
  try {
    const RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS || '365', 10)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

    console.log(`Enforcing data retention policy: deleting data older than ${cutoffDate.toISOString()}`)

    // Delete old call recordings (expensive to store)
    await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        recording_url: null,
        transcript: null,
      })
      .lt('ended_at', cutoffDate.toISOString())
      .not('recording_url', 'is', null)

    // Archive old calls
    const { data: oldCalls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id')
      .lt('ended_at', cutoffDate.toISOString())
      .eq('archived', false)
      .limit(1000)

    if (oldCalls && oldCalls.length > 0) {
      await supabaseAdmin
        .from('voice_agent_calls')
        .update({ archived: true, archived_at: new Date().toISOString() })
        .in('call_id', oldCalls.map(c => c.call_id))

      console.log(`Archived ${oldCalls.length} old calls`)
    }

    // Delete old SMS logs
    await supabaseAdmin
      .from('voice_agent_sms_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())

    console.log('Data retention policy enforced successfully')
    return { success: true }
  } catch (error: any) {
    console.error('Error enforcing data retention:', error)
    throw error
  }
}

// F1478: Expire unused API keys
export async function expireInactiveAPIKeys() {
  try {
    const INACTIVITY_DAYS = 90
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - INACTIVITY_DAYS)

    const { data: inactiveKeys, error } = await supabaseAdmin
      .from('voice_agent_api_keys')
      .update({
        active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: `Inactive for ${INACTIVITY_DAYS} days`,
      })
      .eq('active', true)
      .lt('last_used_at', cutoffDate.toISOString())
      .select()

    if (error) throw error

    if (inactiveKeys && inactiveKeys.length > 0) {
      console.log(`Expired ${inactiveKeys.length} inactive API keys`)

      // Send notification to key owners
      for (const key of inactiveKeys) {
        // Would send email here in production
        console.log(`Would notify owner of API key ${key.name}: expired due to inactivity`)
      }
    }

    return { expired_count: inactiveKeys?.length || 0 }
  } catch (error: any) {
    console.error('Error expiring inactive API keys:', error)
    throw error
  }
}
