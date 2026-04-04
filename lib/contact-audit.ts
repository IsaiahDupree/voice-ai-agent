// F0617: Contact audit log - track all changes to contact records

import { supabaseAdmin } from './supabase'

export interface ContactAuditEntry {
  id: string
  contactId: number
  action: 'created' | 'updated' | 'deleted' | 'note_added' | 'call_logged' | 'booking_created' | 'stage_changed'
  actor: string // User email or 'system'
  previousValue?: any
  newValue?: any
  metadata?: any
  createdAt: string
}

/**
 * F0617: Log contact audit event
 */
export async function logContactAudit(
  contactId: number,
  action: ContactAuditEntry['action'],
  actor: string,
  options: {
    previousValue?: any
    newValue?: any
    metadata?: any
  } = {}
): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_contact_audit_log').insert({
      contact_id: contactId,
      action,
      actor,
      previous_value: options.previousValue,
      new_value: options.newValue,
      metadata: options.metadata,
    })

    console.log(`[Contact Audit] Logged ${action} for contact ${contactId} by ${actor}`)
  } catch (error) {
    // Fail-open: don't block operations if audit logging fails
    console.error('[Contact Audit] Error logging audit:', error)
  }
}

/**
 * F0617: Get audit log for a contact
 */
export async function getContactAuditLog(
  contactId: number,
  options: {
    limit?: number
    action?: ContactAuditEntry['action']
  } = {}
): Promise<ContactAuditEntry[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_contact_audit_log')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })

    if (options.action) {
      query = query.eq('action', options.action)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data } = await query

    return (
      data?.map((entry) => ({
        id: entry.id,
        contactId: entry.contact_id,
        action: entry.action,
        actor: entry.actor,
        previousValue: entry.previous_value,
        newValue: entry.new_value,
        metadata: entry.metadata,
        createdAt: entry.created_at,
      })) || []
    )
  } catch (error) {
    console.error('[Contact Audit] Error fetching audit log:', error)
    return []
  }
}

/**
 * F0617: Get recent audit events across all contacts
 */
export async function getRecentContactAudits(
  limit: number = 50,
  action?: ContactAuditEntry['action']
): Promise<ContactAuditEntry[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_contact_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (action) {
      query = query.eq('action', action)
    }

    const { data } = await query

    return (
      data?.map((entry) => ({
        id: entry.id,
        contactId: entry.contact_id,
        action: entry.action,
        actor: entry.actor,
        previousValue: entry.previous_value,
        newValue: entry.new_value,
        metadata: entry.metadata,
        createdAt: entry.created_at,
      })) || []
    )
  } catch (error) {
    console.error('[Contact Audit] Error fetching recent audits:', error)
    return []
  }
}
