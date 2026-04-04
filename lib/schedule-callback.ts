// F0393: scheduleCallback tool
// Allows agent to schedule a future callback for a contact

import { supabaseAdmin } from './supabase'
import { VapiFunctionTool } from './vapi'

/**
 * F0393: scheduleCallback tool definition
 */
export const scheduleCallbackTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'scheduleCallback',
    description:
      'Schedule a callback for a future date and time. Use when caller requests a follow-up call.',
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'Contact ID to callback',
        },
        phone: {
          type: 'string',
          description: 'Phone number to call back',
        },
        scheduledFor: {
          type: 'string',
          description: 'ISO8601 datetime for callback (e.g., 2024-12-25T10:00:00Z)',
        },
        reason: {
          type: 'string',
          description: 'Reason for callback (e.g., "Follow up on demo")',
        },
        notes: {
          type: 'string',
          description: 'Additional notes for the callback',
        },
      },
      required: ['phone', 'scheduledFor'],
    },
  },
  async: true,
}

export interface ScheduleCallbackParams {
  contactId?: number
  phone: string
  scheduledFor: string // ISO8601 datetime
  reason?: string
  notes?: string
  campaignId?: number
  assignedTo?: string // User or agent ID
}

/**
 * F0393: Schedule a future callback
 * Creates a pending callback record
 */
export async function scheduleCallback(
  params: ScheduleCallbackParams
): Promise<{ success: boolean; callbackId?: number; error?: string }> {
  try {
    // Validate scheduledFor is in the future
    const scheduledTime = new Date(params.scheduledFor)
    const now = new Date()

    if (scheduledTime <= now) {
      return {
        success: false,
        error: 'Scheduled time must be in the future',
      }
    }

    // Create callback record
    const { data: callback, error: insertError } = await supabaseAdmin
      .from('voice_agent_callbacks')
      .insert({
        contact_id: params.contactId || null,
        phone: params.phone,
        scheduled_for: params.scheduledFor,
        status: 'pending',
        reason: params.reason || null,
        notes: params.notes || null,
        campaign_id: params.campaignId || null,
        assigned_to: params.assignedTo || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Schedule Callback] Error creating callback:', insertError)
      return {
        success: false,
        error: insertError.message,
      }
    }

    console.log(
      `[Schedule Callback] Callback ${callback.id} scheduled for ${params.scheduledFor}`
    )

    return {
      success: true,
      callbackId: callback.id,
    }
  } catch (error: any) {
    console.error('[Schedule Callback] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to schedule callback',
    }
  }
}

/**
 * Get pending callbacks for processing
 */
export async function getPendingCallbacks(params?: {
  before?: string // ISO8601 datetime - get callbacks scheduled before this time
  assignedTo?: string
  limit?: number
}): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_callbacks')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true })

    if (params?.before) {
      query = query.lte('scheduled_for', params.before)
    }

    if (params?.assignedTo) {
      query = query.eq('assigned_to', params.assignedTo)
    }

    if (params?.limit) {
      query = query.limit(params.limit)
    }

    const { data, error } = await query

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('[Get Pending Callbacks] Error:', error)
    return []
  }
}

/**
 * Mark callback as completed
 */
export async function completeCallback(
  callbackId: number,
  result: {
    callId?: string
    outcome?: string
    notes?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('voice_agent_callbacks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        call_id: result.callId || null,
        outcome: result.outcome || null,
        completion_notes: result.notes || null,
      })
      .eq('id', callbackId)

    if (error) throw error

    console.log(`[Complete Callback] Callback ${callbackId} marked as completed`)

    return { success: true }
  } catch (error: any) {
    console.error('[Complete Callback] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to complete callback',
    }
  }
}

/**
 * Cancel a scheduled callback
 */
export async function cancelCallback(
  callbackId: number,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('voice_agent_callbacks')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      })
      .eq('id', callbackId)

    if (error) throw error

    console.log(`[Cancel Callback] Callback ${callbackId} cancelled`)

    return { success: true }
  } catch (error: any) {
    console.error('[Cancel Callback] Error:', error)
    return {
      success: false,
      error: error.message || 'Failed to cancel callback',
    }
  }
}

/**
 * Parse natural language time to ISO8601
 * Examples: "tomorrow at 2pm", "next Monday at 10am", "in 2 hours"
 */
export function parseCallbackTime(input: string): string | null {
  const now = new Date()

  // Simple patterns - expand as needed
  const lower = input.toLowerCase()

  // "tomorrow at 2pm"
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Try to extract time
    const timeMatch = lower.match(/(\d{1,2})(:\d{2})?\s*(am|pm)?/)
    if (timeMatch) {
      let hour = parseInt(timeMatch[1])
      const minute = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0
      const isPM = timeMatch[3] === 'pm'

      if (isPM && hour < 12) hour += 12
      if (!isPM && hour === 12) hour = 0

      tomorrow.setHours(hour, minute, 0, 0)
      return tomorrow.toISOString()
    }

    // Default to 10am tomorrow
    tomorrow.setHours(10, 0, 0, 0)
    return tomorrow.toISOString()
  }

  // "in 2 hours"
  const hoursMatch = lower.match(/in (\d+) hours?/)
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1])
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000)
    return future.toISOString()
  }

  // "next week"
  if (lower.includes('next week')) {
    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)
    nextWeek.setHours(10, 0, 0, 0)
    return nextWeek.toISOString()
  }

  // Default: 1 day from now
  const defaultFuture = new Date(now)
  defaultFuture.setDate(defaultFuture.getDate() + 1)
  defaultFuture.setHours(10, 0, 0, 0)
  return defaultFuture.toISOString()
}
