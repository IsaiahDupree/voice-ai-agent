// F0383: endCall params
// Enhanced end call functionality with reason tracking

import { supabaseAdmin } from './supabase'

export type EndCallReason =
  | 'completed'
  | 'transferred'
  | 'caller_hung_up'
  | 'agent_error'
  | 'timeout'
  | 'opted_out'
  | 'invalid_request'
  | 'other'

export interface EndCallParams {
  call_id: string
  reason: EndCallReason
  metadata?: Record<string, any>
  summary?: string
}

/**
 * F0383: End call with detailed parameters
 * Logs call completion with reason and metadata
 */
export async function endCallWithReason(params: EndCallParams): Promise<void> {
  const { call_id, reason, metadata = {}, summary } = params

  try {
    // Update call record with end reason
    const { error } = await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        end_reason: reason, // F0383: Track end reason
        end_metadata: metadata,
        summary: summary || null,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', call_id)

    if (error) {
      console.error('[EndCall] Failed to update call:', error)
      throw new Error('Failed to end call')
    }

    console.log(`[EndCall] Call ${call_id} ended - Reason: ${reason}`)
  } catch (error) {
    console.error('[EndCall] Error:', error)
    throw error
  }
}

/**
 * F0383: Get end call reason statistics
 * Returns distribution of call end reasons
 */
export async function getEndReasonStats(
  startDate?: string,
  endDate?: string
): Promise<Record<EndCallReason, number>> {
  let query = supabaseAdmin
    .from('voice_agent_calls')
    .select('end_reason')
    .eq('status', 'ended')
    .not('end_reason', 'is', null)

  if (startDate) {
    query = query.gte('ended_at', startDate)
  }

  if (endDate) {
    query = query.lte('ended_at', endDate)
  }

  const { data, error } = await query

  if (error || !data) {
    return {} as Record<EndCallReason, number>
  }

  const stats: Record<string, number> = {}
  for (const row of data) {
    const reason = row.end_reason as EndCallReason
    stats[reason] = (stats[reason] || 0) + 1
  }

  return stats as Record<EndCallReason, number>
}

/**
 * F0383: Determine end reason from call context
 * Automatically infers end reason from call state
 */
export function inferEndReason(
  callDuration: number,
  wasTransferred: boolean,
  hadError: boolean,
  callerHungUp: boolean
): EndCallReason {
  if (hadError) return 'agent_error'
  if (wasTransferred) return 'transferred'
  if (callerHungUp && callDuration < 10) return 'caller_hung_up'
  if (callDuration > 0) return 'completed'
  return 'other'
}
