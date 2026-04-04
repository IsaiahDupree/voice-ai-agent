// F0383: endCall params - accepts reason parameter
// F0385: endCall logging - logs reason to voice_agent_calls
// End call functionality with reason tracking

import { supabaseAdmin } from './supabase'
import { logEndCall } from './tool-logging'

export type EndCallReason =
  | 'call_complete'
  | 'user_requested'
  | 'no_response'
  | 'error'
  | 'timeout'
  | 'transferred'
  | 'voicemail'
  | 'hung_up'

/**
 * F0383: End call with reason parameter
 * F0385: Logs reason to voice_agent_calls table
 */
export async function endCall(
  callId: string,
  reason: EndCallReason = 'call_complete'
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[End Call] Ending call ${callId} - Reason: ${reason}`)

    // Update call record with end reason
    const { error: updateError } = await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        end_reason: reason,
        ended_at: new Date().toISOString(),
        status: 'ended',
      })
      .eq('call_id', callId)

    if (updateError) {
      console.error('[End Call] Error updating call record:', updateError)
    }

    // F0385: Log endCall reason to function calls table
    await logEndCall(callId, reason)

    return { success: true }
  } catch (error: any) {
    console.error('[End Call] Error ending call:', error)
    return {
      success: false,
      error: error.message || 'Failed to end call',
    }
  }
}

/**
 * Parse end call reason from natural language
 */
export function parseEndCallReason(input: string): EndCallReason {
  const lower = input.toLowerCase()

  if (lower.includes('complete') || lower.includes('done')) {
    return 'call_complete'
  }

  if (lower.includes('transfer')) {
    return 'transferred'
  }

  if (lower.includes('voicemail') || lower.includes('vm')) {
    return 'voicemail'
  }

  if (
    lower.includes('hang') ||
    lower.includes('hung') ||
    lower.includes('disconnect')
  ) {
    return 'hung_up'
  }

  if (lower.includes('timeout') || lower.includes('no response')) {
    return 'timeout'
  }

  if (lower.includes('error') || lower.includes('fail')) {
    return 'error'
  }

  return 'call_complete'
}

/**
 * Get human-readable end call reason
 */
export function formatEndCallReason(reason: EndCallReason): string {
  const reasonMap: Record<EndCallReason, string> = {
    call_complete: 'Call completed successfully',
    user_requested: 'User requested to end call',
    no_response: 'No response from caller',
    error: 'Error occurred',
    timeout: 'Call timed out',
    transferred: 'Call transferred',
    voicemail: 'Reached voicemail',
    hung_up: 'Caller hung up',
  }

  return reasonMap[reason] || reason
}
