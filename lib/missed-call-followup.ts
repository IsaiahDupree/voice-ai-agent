// F0176: Auto-follow-up on missed calls
// Schedule outbound callback for missed inbound calls

import { supabaseAdmin } from './supabase'
import { startCall } from './vapi'

export interface MissedCallFollowup {
  id?: string
  call_id: string
  original_caller: string
  assistant_id: string
  scheduled_at: string
  status: 'pending' | 'completed' | 'failed'
  callback_call_id?: string
  created_at?: string
  updated_at?: string
}

/**
 * F0176: Schedule callback for missed inbound call
 * Queues callback within 5 minutes by default
 */
export async function scheduleCallback(
  callId: string,
  originalCaller: string,
  assistantId: string,
  delayMinutes: number = 5
): Promise<MissedCallFollowup> {
  try {
    // Calculate scheduled time (default: 5 minutes from now)
    const scheduledAt = new Date()
    scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes)

    // Insert followup record
    const { data, error } = await supabaseAdmin
      .from('voice_agent_missed_call_followups')
      .insert({
        call_id: callId,
        original_caller: originalCaller,
        assistant_id: assistantId,
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    console.log(`Scheduled callback for ${originalCaller} at ${scheduledAt.toISOString()}`)

    return data as MissedCallFollowup
  } catch (error) {
    console.error('Error scheduling callback:', error)
    throw error
  }
}

/**
 * F0176: Process pending callbacks
 * Should be called periodically (e.g., every minute)
 */
export async function processPendingCallbacks(): Promise<number> {
  try {
    const now = new Date().toISOString()

    // Get all pending callbacks that are due
    const { data: pending } = await supabaseAdmin
      .from('voice_agent_missed_call_followups')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })

    if (!pending || pending.length === 0) {
      return 0
    }

    let processed = 0

    for (const followup of pending) {
      try {
        // Initiate outbound call
        const call = await startCall({
          assistantId: followup.assistant_id,
          customerNumber: followup.original_caller,
          metadata: {
            followup_type: 'missed_call',
            original_call_id: followup.call_id,
            scheduled_at: followup.scheduled_at,
          },
          assistantOverrides: {
            firstMessage: `Hi! I'm calling you back. I saw you tried to reach us earlier but we missed your call. How can I help you today?`,
          },
        })

        // Update followup record
        await supabaseAdmin
          .from('voice_agent_missed_call_followups')
          .update({
            status: 'completed',
            callback_call_id: call.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', followup.id)

        // Create call record
        await supabaseAdmin.from('voice_agent_calls').insert({
          call_id: call.id,
          assistant_id: followup.assistant_id,
          status: 'queued',
          direction: 'outbound',
          to_number: followup.original_caller,
          from_number: call.phoneNumber,
          metadata: {
            followup_type: 'missed_call',
            original_call_id: followup.call_id,
          },
        })

        processed++
        console.log(`Processed callback for ${followup.original_caller} (call: ${call.id})`)
      } catch (error) {
        console.error(`Failed to process callback ${followup.id}:`, error)

        // Mark as failed
        await supabaseAdmin
          .from('voice_agent_missed_call_followups')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', followup.id)
      }
    }

    return processed
  } catch (error) {
    console.error('Error processing callbacks:', error)
    return 0
  }
}

/**
 * F0176: Cancel a scheduled callback
 */
export async function cancelCallback(followupId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('voice_agent_missed_call_followups')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', followupId)
      .eq('status', 'pending')

    if (error) throw error

    console.log(`Cancelled callback ${followupId}`)
    return true
  } catch (error) {
    console.error('Error cancelling callback:', error)
    return false
  }
}
