import { supabaseAdmin } from './supabase'

// F0159: Call whispering to rep - Play context to human rep before call connects
// F0173: Live transfer context - Brief rep on caller before transfer completes

export interface TransferWhisperContext {
  callerName?: string
  callerCompany?: string
  callerPhone: string
  callReason?: string
  callDuration?: number
  sentiment?: string
  previousNotes?: string
  isHighValue?: boolean
  isUrgent?: boolean
}

/**
 * F0159: Generate transfer whisper message for human rep
 * This is played to the rep BEFORE the call is transferred
 * The caller is on hold and doesn't hear this
 */
export function generateTransferWhisperMessage(context: TransferWhisperContext): string {
  const parts: string[] = []

  // Start with caller identification
  if (context.callerName) {
    parts.push(`Transferring call from ${context.callerName}`)
  } else {
    parts.push(`Transferring call from ${context.callerPhone}`)
  }

  // Add company if known
  if (context.callerCompany) {
    parts.push(`from ${context.callerCompany}`)
  }

  // Add call reason
  if (context.callReason) {
    parts.push(`regarding ${context.callReason}`)
  }

  // Add urgency/priority flags
  const flags: string[] = []
  if (context.isHighValue) {
    flags.push('high value account')
  }
  if (context.isUrgent) {
    flags.push('urgent')
  }
  if (context.sentiment === 'negative' || context.sentiment === 'frustrated') {
    flags.push('caller is frustrated')
  }

  if (flags.length > 0) {
    parts.push(`Note: ${flags.join(', ')}`)
  }

  // Add previous notes if available
  if (context.previousNotes) {
    parts.push(`Previous notes: ${context.previousNotes.substring(0, 100)}`)
  }

  // Add call duration if available
  if (context.callDuration && context.callDuration > 0) {
    const minutes = Math.floor(context.callDuration / 60)
    parts.push(`Call duration: ${minutes} minute${minutes !== 1 ? 's' : ''}`)
  }

  parts.push('Connecting now.')

  return parts.join('. ') + '.'
}

/**
 * F0159: Lookup transfer context from call ID and generate whisper
 */
export async function generateTransferWhisperFromCall(callId: string): Promise<string> {
  try {
    // Get call details
    const { data: call, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('*, contact:voice_agent_contacts(*)')
      .eq('call_id', callId)
      .single()

    if (error || !call) {
      // Fallback if call not found
      return 'Transferring call. Connecting now.'
    }

    const context: TransferWhisperContext = {
      callerPhone: call.from_number || 'Unknown',
      callerName: call.contact?.name || call.contact_name,
      callerCompany: call.contact?.company,
      callReason: call.metadata?.call_reason,
      callDuration: call.duration_seconds,
      sentiment: call.metadata?.sentiment,
      previousNotes: call.contact?.notes,
      isHighValue: call.contact?.metadata?.is_high_value || false,
      isUrgent: call.is_emergency || call.metadata?.is_urgent || false,
    }

    return generateTransferWhisperMessage(context)
  } catch (error) {
    console.error('Error generating transfer whisper:', error)
    return 'Transferring call. Connecting now.'
  }
}

/**
 * F0173: Enhanced transfer function with whisper context
 * To be called from Vapi function tool
 */
export async function transferCallWithWhisper(params: {
  callId: string
  transferNumber: string
  whisperEnabled?: boolean
}) {
  const { callId, transferNumber, whisperEnabled = true } = params

  let whisperMessage: string | undefined

  if (whisperEnabled) {
    whisperMessage = await generateTransferWhisperFromCall(callId)
  }

  // Return transfer action with whisper
  // Vapi will handle the actual transfer and whisper playback
  return {
    action: 'transfer',
    destination: transferNumber,
    whisperMessage, // F0159: Message played to rep before transfer
    // Vapi will:
    // 1. Put caller on hold
    // 2. Call the transfer number
    // 3. Play whisperMessage to the rep
    // 4. Connect the two parties
  }
}
