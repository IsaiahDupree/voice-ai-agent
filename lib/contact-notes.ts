// F0578: Contact notes append functionality

import { supabaseAdmin } from './supabase'

/**
 * F0578: Append note to contact's notes array
 */
export async function appendContactNote(
  contactId: number,
  note: string,
  source?: string
): Promise<void> {
  try {
    // Get existing contact
    const { data: contact, error: fetchError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('notes, metadata')
      .eq('id', contactId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch contact: ${fetchError.message}`)
    }

    // Get existing notes array
    const existingNotes = Array.isArray(contact.notes) ? contact.notes : []

    // Create new note entry
    const newNote = {
      content: note,
      created_at: new Date().toISOString(),
      source: source || 'system',
    }

    // Append new note
    const updatedNotes = [...existingNotes, newNote]

    // Update contact
    const { error: updateError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    if (updateError) {
      throw new Error(`Failed to update contact notes: ${updateError.message}`)
    }

    console.log(`[Contact Notes] Appended note to contact ${contactId}`)
  } catch (error) {
    console.error('[Contact Notes] Failed to append note:', error)
    throw error
  }
}

/**
 * F0579: Get contact notes history
 */
export async function getContactNotes(
  contactId: number
): Promise<Array<{ content: string; created_at: string; source: string }>> {
  try {
    const { data: contact, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('notes')
      .eq('id', contactId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch contact: ${error.message}`)
    }

    return Array.isArray(contact.notes) ? contact.notes : []
  } catch (error) {
    console.error('[Contact Notes] Failed to get notes:', error)
    return []
  }
}

/**
 * Update contact deal stage
 * F0576: Deal stage values: lead/qualified/booked/won/lost
 */
export type DealStage = 'lead' | 'qualified' | 'booked' | 'won' | 'lost'

/**
 * F0577: Update contact deal_stage
 */
export async function updateContactDealStage(
  contactId: number,
  dealStage: DealStage,
  reason?: string
): Promise<void> {
  try {
    // Get existing metadata
    const { data: contact, error: fetchError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('metadata')
      .eq('id', contactId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch contact: ${fetchError.message}`)
    }

    // Update metadata with deal_stage
    const updatedMetadata = {
      ...(contact.metadata || {}),
      deal_stage: dealStage,
      deal_stage_updated_at: new Date().toISOString(),
      deal_stage_reason: reason || null,
    }

    // Update contact
    const { error: updateError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    if (updateError) {
      throw new Error(`Failed to update deal stage: ${updateError.message}`)
    }

    console.log(`[Contact] Updated deal stage for contact ${contactId} to ${dealStage}`)
  } catch (error) {
    console.error('[Contact] Failed to update deal stage:', error)
    throw error
  }
}
