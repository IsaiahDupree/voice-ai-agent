// F0386: updateContact tool definition
// F0387: updateContact params - accepts contactId, fields object
// F0388: updateContact deal_stage - can update deal_stage field
// F0389: updateContact notes - appends to notes array
// CRM contact update functionality for voice agents

import { supabaseAdmin } from './supabase'
import { VapiFunctionTool } from './vapi'

/**
 * F0386: updateContact tool definition
 */
export const updateContactTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'updateContact',
    description: 'Update contact information in CRM',
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'Contact ID to update',
        },
        fields: {
          type: 'object',
          description: 'Fields to update',
          properties: {
            name: { type: 'string', description: "Contact's name" },
            email: { type: 'string', description: "Contact's email" },
            company: { type: 'string', description: "Contact's company" },
            dealStage: {
              type: 'string',
              description:
                'Deal stage: lead, qualified, demo_scheduled, proposal, closed_won, closed_lost',
            },
            notes: {
              type: 'string',
              description: 'Note to append to contact history',
            },
          },
        },
      },
      required: ['contactId', 'fields'],
    },
  },
  async: true,
}

export type DealStage =
  | 'lead'
  | 'qualified'
  | 'demo_scheduled'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'
  | 'unqualified'

export interface UpdateContactFields {
  name?: string
  email?: string
  company?: string
  dealStage?: DealStage // F0388
  notes?: string // F0389
  phone?: string
  timezone?: string
  optOutSms?: boolean
}

/**
 * F0387: Update contact with fields object
 */
export async function updateContact(
  contactId: number,
  fields: UpdateContactFields
): Promise<{ success: boolean; contact?: any; error?: string }> {
  try {
    // Fetch current contact
    const { data: currentContact, error: fetchError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (fetchError || !currentContact) {
      return {
        success: false,
        error: `Contact ${contactId} not found`,
      }
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (fields.name) updates.name = fields.name
    if (fields.email) updates.email = fields.email
    if (fields.company) updates.company = fields.company
    if (fields.phone) updates.phone = fields.phone
    if (fields.timezone) updates.timezone = fields.timezone
    if (fields.optOutSms !== undefined) updates.opt_out_sms = fields.optOutSms

    // F0388: Update deal_stage
    if (fields.dealStage) {
      updates.deal_stage = fields.dealStage

      // Track stage transition in metadata
      if (!updates.metadata) updates.metadata = currentContact.metadata || {}
      updates.metadata.stage_history = [
        ...(currentContact.metadata?.stage_history || []),
        {
          from: currentContact.deal_stage,
          to: fields.dealStage,
          changed_at: new Date().toISOString(),
        },
      ]
    }

    // F0389: Append note to notes array
    if (fields.notes) {
      const existingNotes = currentContact.notes || ''
      const timestamp = new Date().toISOString()
      const noteEntry = `[${timestamp}] ${fields.notes}`

      updates.notes = existingNotes
        ? `${existingNotes}\n${noteEntry}`
        : noteEntry
    }

    // Update contact
    const { data: updatedContact, error: updateError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update(updates)
      .eq('id', contactId)
      .select()
      .single()

    if (updateError) {
      console.error('[Update Contact] Error updating:', updateError)
      return {
        success: false,
        error: updateError.message,
      }
    }

    console.log(`[Update Contact] Updated contact ${contactId}`)

    return {
      success: true,
      contact: updatedContact,
    }
  } catch (error: any) {
    console.error('[Update Contact] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to update contact',
    }
  }
}

/**
 * Helper to validate deal stage
 */
export function isValidDealStage(stage: string): stage is DealStage {
  const validStages: DealStage[] = [
    'lead',
    'qualified',
    'demo_scheduled',
    'proposal',
    'negotiation',
    'closed_won',
    'closed_lost',
    'unqualified',
  ]

  return validStages.includes(stage as DealStage)
}

/**
 * Parse deal stage from natural language
 */
export function parseDealStage(input: string): DealStage | null {
  const lower = input.toLowerCase()

  if (lower.includes('won') || lower.includes('closed won')) {
    return 'closed_won'
  }

  if (lower.includes('lost') || lower.includes('closed lost')) {
    return 'closed_lost'
  }

  if (lower.includes('proposal') || lower.includes('quote')) {
    return 'proposal'
  }

  if (
    lower.includes('demo') ||
    lower.includes('meeting') ||
    lower.includes('scheduled')
  ) {
    return 'demo_scheduled'
  }

  if (lower.includes('qualified') || lower.includes('interested')) {
    return 'qualified'
  }

  if (lower.includes('unqualified') || lower.includes('not interested')) {
    return 'unqualified'
  }

  if (lower.includes('lead') || lower.includes('new')) {
    return 'lead'
  }

  if (lower.includes('negotiat')) {
    return 'negotiation'
  }

  return null
}

/**
 * Get deal stage display name
 */
export function formatDealStage(stage: DealStage): string {
  const stageMap: Record<DealStage, string> = {
    lead: 'Lead',
    qualified: 'Qualified',
    demo_scheduled: 'Demo Scheduled',
    proposal: 'Proposal Sent',
    negotiation: 'In Negotiation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
    unqualified: 'Unqualified',
  }

  return stageMap[stage] || stage
}
