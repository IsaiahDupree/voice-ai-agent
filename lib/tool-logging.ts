// F0352: checkAvailability logging
// F0366: lookupContact logging
// F0381: transferCall logging
// F0385: endCall logging
// F0398: Tool execution logging
// All tool calls logged to voice_agent_function_calls table

import { supabaseAdmin } from './supabase'

export interface ToolInvocation {
  call_id: string
  function_name: string
  parameters: Record<string, any>
  result?: Record<string, any>
  error?: string
  timestamp?: string
}

/**
 * F0398: Log tool execution
 * Logs all tool calls to voice_agent_function_calls table
 */
export async function logToolInvocation(invocation: ToolInvocation): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_function_calls').insert({
      call_id: invocation.call_id,
      function_name: invocation.function_name,
      parameters: invocation.parameters || {},
      result: invocation.result || null,
      error: invocation.error || null,
      timestamp: invocation.timestamp || new Date().toISOString(),
    })

    console.log(
      `[Tool Log] ${invocation.function_name} - call_id: ${invocation.call_id}`
    )
  } catch (error) {
    console.error('[Tool Log] Error logging tool invocation:', error)
    // Don't throw - logging failures shouldn't break the main flow
  }
}

/**
 * F0352: Log checkAvailability call
 */
export async function logCheckAvailability(
  callId: string,
  date: string,
  eventTypeId: string | null,
  result: { success: boolean; slotCount?: number; error?: string }
): Promise<void> {
  await logToolInvocation({
    call_id: callId,
    function_name: 'checkAvailability',
    parameters: { date, eventTypeId },
    result: {
      success: result.success,
      slot_count: result.slotCount || 0,
    },
    error: result.error,
  })
}

/**
 * F0366: Log lookupContact call
 * Logs with found/not-found outcome
 */
export async function logLookupContact(
  callId: string,
  phone: string,
  result: {
    found: boolean
    contactId?: number
    name?: string
    dealStage?: string
    error?: string
  }
): Promise<void> {
  await logToolInvocation({
    call_id: callId,
    function_name: 'lookupContact',
    parameters: { phone },
    result: {
      found: result.found,
      contact_id: result.contactId,
      name: result.name,
      deal_stage: result.dealStage,
    },
    error: result.error,
  })
}

/**
 * F0381: Log transferCall event
 */
export async function logTransferCall(
  callId: string,
  transferType: 'warm' | 'cold',
  targetNumber: string,
  result: { success: boolean; error?: string }
): Promise<void> {
  await logToolInvocation({
    call_id: callId,
    function_name: 'transferCall',
    parameters: {
      transfer_type: transferType,
      target_number: targetNumber,
    },
    result: {
      success: result.success,
    },
    error: result.error,
  })
}

/**
 * F0385: Log endCall with reason
 */
export async function logEndCall(
  callId: string,
  reason?: string
): Promise<void> {
  await logToolInvocation({
    call_id: callId,
    function_name: 'endCall',
    parameters: {
      reason: reason || 'call_complete',
    },
    result: {
      success: true,
    },
  })
}

/**
 * Log bookAppointment call
 */
export async function logBookAppointment(
  callId: string,
  params: {
    name: string
    email: string
    phone: string
    date: string
    time: string
  },
  result: { success: boolean; bookingId?: string; error?: string }
): Promise<void> {
  await logToolInvocation({
    call_id: callId,
    function_name: 'bookAppointment',
    parameters: params,
    result: {
      success: result.success,
      booking_id: result.bookingId,
    },
    error: result.error,
  })
}

/**
 * Log sendSMS call
 */
export async function logSendSMS(
  callId: string,
  to: string,
  template: string | null,
  result: { success: boolean; messageSid?: string; error?: string }
): Promise<void> {
  await logToolInvocation({
    call_id: callId,
    function_name: 'sendSMS',
    parameters: {
      to,
      template,
    },
    result: {
      success: result.success,
      message_sid: result.messageSid,
    },
    error: result.error,
  })
}

/**
 * F0399: Tool rate limiting
 * Check if call has exceeded tool call limit
 */
export async function checkToolRateLimit(
  callId: string,
  maxToolCalls: number = 10
): Promise<{ allowed: boolean; count: number }> {
  try {
    const { count, error } = await supabaseAdmin
      .from('voice_agent_function_calls')
      .select('*', { count: 'exact', head: true })
      .eq('call_id', callId)

    if (error) throw error

    const allowed = (count || 0) < maxToolCalls

    if (!allowed) {
      console.log(
        `[Tool Rate Limit] Call ${callId} exceeded limit (${count}/${maxToolCalls})`
      )
    }

    return {
      allowed,
      count: count || 0,
    }
  } catch (error) {
    console.error('[Tool Rate Limit] Error checking limit:', error)
    // Allow on error to avoid blocking calls
    return { allowed: true, count: 0 }
  }
}

/**
 * Get tool invocation history for a call
 */
export async function getToolHistory(callId: string): Promise<ToolInvocation[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_function_calls')
      .select('*')
      .eq('call_id', callId)
      .order('timestamp', { ascending: true })

    if (error) throw error

    return (data || []).map((row) => ({
      call_id: row.call_id,
      function_name: row.function_name,
      parameters: row.parameters || {},
      result: row.result || {},
      timestamp: row.timestamp,
    }))
  } catch (error) {
    console.error('[Tool History] Error fetching history:', error)
    return []
  }
}
