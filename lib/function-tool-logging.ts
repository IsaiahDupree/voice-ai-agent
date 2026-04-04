// F0352: checkAvailability logging
// F0366: lookupContact logging
// F0381: transferCall logging
// F0385: endCall logging
// Centralized logging for function tool calls

import { supabaseAdmin } from './supabase'

interface ToolLogEntry {
  tool_name: string
  call_id?: string
  phone?: string
  parameters: Record<string, any>
  result?: any
  error?: string
  duration_ms: number
  timestamp: string
}

/**
 * F0352, F0366, F0381, F0385: Log function tool calls
 * Stores tool usage for analytics and debugging
 */
export async function logToolCall(entry: ToolLogEntry): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_tool_logs').insert({
      tool_name: entry.tool_name,
      call_id: entry.call_id || null,
      phone: entry.phone || null,
      parameters: entry.parameters,
      result: entry.result || null,
      error: entry.error || null,
      duration_ms: entry.duration_ms,
      created_at: entry.timestamp,
    })

    console.log(`[ToolLog] ${entry.tool_name} - ${entry.duration_ms}ms`, {
      call_id: entry.call_id,
      success: !entry.error,
    })
  } catch (error) {
    console.error('[ToolLog] Failed to log tool call:', error)
    // Don't throw - logging failures shouldn't break tool execution
  }
}

/**
 * F0352: checkAvailability logging wrapper
 */
export function withAvailabilityLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  callId?: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    const [date, eventTypeId] = args

    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: 'checkAvailability',
        call_id: callId,
        parameters: { date, eventTypeId },
        result: { slots: result?.length || 0 },
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: 'checkAvailability',
        call_id: callId,
        parameters: { date, eventTypeId },
        error: error.message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }) as T
}

/**
 * F0366: lookupContact logging wrapper
 */
export function withContactLookupLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  callId?: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    const [phone] = args

    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: 'lookupContact',
        call_id: callId,
        phone,
        parameters: { phone },
        result: { found: !!result, contactId: result?.id },
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: 'lookupContact',
        call_id: callId,
        phone,
        parameters: { phone },
        error: error.message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }) as T
}

/**
 * F0381: transferCall logging wrapper
 */
export function withTransferLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  callId?: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    const [phoneNumber, type] = args

    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: 'transferCall',
        call_id: callId,
        parameters: { phoneNumber, type },
        result: { success: true },
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: 'transferCall',
        call_id: callId,
        parameters: { phoneNumber, type },
        error: error.message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }) as T
}

/**
 * F0385: endCall logging wrapper
 */
export function withEndCallLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  callId?: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    const [reason] = args

    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: 'endCall',
        call_id: callId,
        parameters: { reason },
        result: { success: true },
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: 'endCall',
        call_id: callId,
        parameters: { reason },
        error: error.message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }) as T
}

/**
 * Generic tool logging wrapper
 * Can be used for any tool
 */
export function withToolLogging<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  fn: T,
  callId?: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()

    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: toolName,
        call_id: callId,
        parameters: args[0] || {},
        result,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      await logToolCall({
        tool_name: toolName,
        call_id: callId,
        parameters: args[0] || {},
        error: error.message,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }) as T
}
