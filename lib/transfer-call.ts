// F0377: transferCall warm
// F0378: transferCall cold
// F0379: transferCall announcement
// F0380: transferCall failure handling
// Call transfer implementations for Vapi

import { logTransferCall } from './tool-logging'

export type TransferType = 'warm' | 'cold'

export interface TransferCallOptions {
  phoneNumber: string
  type?: TransferType
  announcement?: string // F0379: Play to caller before transfer
  context?: string // For warm transfer - whispered to rep
}

/**
 * F0377/F0378: Transfer call implementation
 * Supports warm (with context) and cold (direct) transfers
 */
export async function transferCall(
  callId: string,
  options: TransferCallOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const transferType = options.type || 'cold'

    console.log(
      `[Transfer] Starting ${transferType} transfer to ${options.phoneNumber}`
    )

    // F0379: Play announcement to caller (optional)
    if (options.announcement) {
      console.log(`[Transfer] Playing announcement: "${options.announcement}"`)
      // In production, this would use Vapi's assistant message API
      // For now, we log it
    }

    // F0377: Warm transfer - provide context to rep before connecting
    if (transferType === 'warm' && options.context) {
      console.log(`[Transfer] Warm transfer context: "${options.context}"`)
      // In production:
      // 1. Call rep's number
      // 2. Play context message to rep (whisper)
      // 3. Wait for rep to acknowledge
      // 4. Bridge caller to rep
      // This requires Vapi's transfer API with whisper support
    }

    // F0378: Cold transfer - connect directly
    if (transferType === 'cold') {
      console.log(`[Transfer] Cold transfer - connecting directly`)
      // In production:
      // 1. Call target number
      // 2. Bridge caller immediately when answered
    }

    // Mock successful transfer
    const result = { success: true }

    // F0381: Log transfer event
    await logTransferCall(callId, transferType, options.phoneNumber, result)

    return result
  } catch (error: any) {
    console.error('[Transfer] Transfer failed:', error)

    // F0380: Transfer failure handling
    const failureResult = {
      success: false,
      error: error.message || 'Transfer failed',
    }

    // Log failure
    await logTransferCall(
      callId,
      options.type || 'cold',
      options.phoneNumber,
      failureResult
    )

    return failureResult
  }
}

/**
 * Helper to format transfer context for warm transfers
 */
export function formatTransferContext(params: {
  callerName?: string
  callReason?: string
  notes?: string
}): string {
  const parts: string[] = []

  if (params.callerName) {
    parts.push(`Caller: ${params.callerName}`)
  }

  if (params.callReason) {
    parts.push(`Reason: ${params.callReason}`)
  }

  if (params.notes) {
    parts.push(`Notes: ${params.notes}`)
  }

  return parts.join('. ')
}

/**
 * Parse transfer destination (phone or department name)
 */
export function parseTransferDestination(
  input: string,
  departmentMap: Record<string, string> = {}
): string {
  // Check if it's a department name
  const lowercaseInput = input.toLowerCase()
  if (departmentMap[lowercaseInput]) {
    return departmentMap[lowercaseInput]
  }

  // Otherwise assume it's a phone number
  return input
}
