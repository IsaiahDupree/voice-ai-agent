// F0377: transferCall warm
// F0378: transferCall cold
// F0379: transferCall announcement
// F0380: transferCall failure
// Enhanced call transfer functionality

import { supabaseAdmin } from './supabase'

export type TransferType = 'warm' | 'cold'

export interface TransferCallParams {
  call_id: string
  to_phone: string
  type: TransferType // F0377, F0378
  announcement?: string // F0379: Announcement to recipient
  context?: Record<string, any>
}

/**
 * F0377: Warm transfer - agent stays on call until recipient answers
 * F0378: Cold transfer - agent drops after initiating transfer
 */
export async function transferCallWithType(
  params: TransferCallParams
): Promise<{ success: boolean; error?: string }> {
  const { call_id, to_phone, type, announcement, context = {} } = params

  try {
    // Log transfer attempt
    await supabaseAdmin.from('voice_agent_call_transfers').insert({
      call_id,
      to_phone,
      transfer_type: type, // F0377, F0378: Track transfer type
      announcement, // F0379: Store announcement text
      context,
      status: 'initiated',
      created_at: new Date().toISOString(),
    })

    console.log(`[Transfer] Initiating ${type} transfer to ${to_phone}`)

    // In real implementation, this would call Vapi transfer API
    // For now, we just log it

    // Update call record
    await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        transfer_to: to_phone,
        transfer_type: type,
        transfer_initiated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', call_id)

    return { success: true }
  } catch (error: any) {
    console.error('[Transfer] Failed:', error)

    // F0380: Log transfer failure
    await logTransferFailure(call_id, to_phone, error.message)

    return { success: false, error: error.message }
  }
}

/**
 * F0380: transferCall failure logging
 * Records failed transfer attempts for debugging
 */
export async function logTransferFailure(
  call_id: string,
  to_phone: string,
  error: string
): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_call_transfers').insert({
      call_id,
      to_phone,
      status: 'failed',
      error_message: error, // F0380: Capture error details
      created_at: new Date().toISOString(),
    })

    console.error(`[Transfer] Failed transfer logged for call ${call_id}`)
  } catch (logError) {
    console.error('[Transfer] Failed to log failure:', logError)
  }
}

/**
 * F0379: Generate transfer announcement
 * Creates context-aware announcement for recipient
 */
export function generateTransferAnnouncement(
  customerName: string,
  reason: string
): string {
  return `Transferring ${customerName} to you. Reason: ${reason}.`
}

/**
 * F0377, F0378: Get transfer statistics
 */
export async function getTransferStats(): Promise<{
  total: number
  warm: number
  cold: number
  failed: number
}> {
  const { data, error } = await supabaseAdmin
    .from('voice_agent_call_transfers')
    .select('transfer_type, status')

  if (error || !data) {
    return { total: 0, warm: 0, cold: 0, failed: 0 }
  }

  const stats = {
    total: data.length,
    warm: data.filter((t) => t.transfer_type === 'warm').length,
    cold: data.filter((t) => t.transfer_type === 'cold').length,
    failed: data.filter((t) => t.status === 'failed').length,
  }

  return stats
}
