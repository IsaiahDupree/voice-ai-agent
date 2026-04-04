// F0639, F0642, F0643, F0647, F0648, F0650, F0653, F0656, F0661, F0662, F0670, F0673
// Core transfer/handoff functionality

import { supabaseAdmin } from './supabase'
import { logHandoffEvent } from './human-handoff'

export interface TransferConfig {
  warmTransferEnabled: boolean // F0642
  coldTransferEnabled: boolean // F0643
  timeoutSeconds: number // F0648: Default 30s
  holdMusicUrl?: string // F0645
  voicemailEnabled: boolean // F0647
  voicemailNumber?: string // F0647
}

export interface RepAvailability {
  available: boolean
  repId?: string
  repName?: string
  phoneNumber?: string
  reason?: string
}

export interface HandoffContextPacket {
  // F0673: Context passed to human rep
  callId: string
  contactId?: number
  contactName?: string
  contactPhone: string
  callDuration: number
  transcriptSummary: string
  sentiment: string
  handoffReason: string
  handoffTrigger: string
  dealStage?: string
  previousCalls: number
  metadata?: any
}

export interface TransferOutcome {
  // F0650: Track transfer outcome
  callId: string
  success: boolean
  transferType: 'warm' | 'cold'
  transferReason: string
  transferredTo?: string
  repConnected: boolean
  repAnsweredInSeconds?: number
  outcome: 'completed' | 'voicemail' | 'timeout' | 'failed' | 'declined'
  createdAt: string
}

/**
 * F0639: Detect configured handoff phrases
 */
export function detectConfiguredPhrase(
  transcript: string,
  configuredPhrases: string[] = []
): {
  detected: boolean
  matchedPhrase?: string
} {
  const lowerTranscript = transcript.toLowerCase()

  // Default phrases
  const defaultPhrases = [
    'speak to a person',
    'talk to a human',
    'transfer me',
    'speak to someone',
    'real person',
    'customer service',
    'representative',
    'agent',
    'manager',
    'supervisor',
  ]

  const allPhrases = [...defaultPhrases, ...configuredPhrases]

  for (const phrase of allPhrases) {
    if (lowerTranscript.includes(phrase.toLowerCase())) {
      return {
        detected: true,
        matchedPhrase: phrase,
      }
    }
  }

  return { detected: false }
}

/**
 * F0656: Check if human rep is available
 */
export async function checkRepAvailability(
  options: {
    preferredRepId?: string
    skillRequired?: string
  } = {}
): Promise<RepAvailability> {
  try {
    // Query rep availability table
    let query = supabaseAdmin
      .from('voice_agent_rep_availability')
      .select('*')
      .eq('available', true)
      .order('priority', { ascending: true })
      .limit(1)

    if (options.preferredRepId) {
      query = query.eq('rep_id', options.preferredRepId)
    }

    if (options.skillRequired) {
      query = query.contains('skills', [options.skillRequired])
    }

    const { data: reps } = await query

    if (!reps || reps.length === 0) {
      return {
        available: false,
        reason: 'No reps available',
      }
    }

    const rep = reps[0]

    return {
      available: true,
      repId: rep.rep_id,
      repName: rep.name,
      phoneNumber: rep.phone_number,
    }
  } catch (error) {
    console.error('[Rep Availability] Error checking:', error)
    return {
      available: false,
      reason: 'Error checking availability',
    }
  }
}

/**
 * F0673: Build handoff context packet for human rep
 */
export async function buildHandoffContext(
  callId: string,
  handoffReason: string,
  handoffTrigger: string
): Promise<HandoffContextPacket> {
  try {
    // Get call details
    const { data: call } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('*')
      .eq('call_id', callId)
      .single()

    if (!call) {
      throw new Error('Call not found')
    }

    // Get contact details
    let contactName: string | undefined
    let dealStage: string | undefined
    let previousCalls = 0

    if (call.contact_id) {
      const { data: contact } = await supabaseAdmin
        .from('voice_agent_contacts')
        .select('name, deal_stage, call_count')
        .eq('id', call.contact_id)
        .single()

      if (contact) {
        contactName = contact.name
        dealStage = contact.deal_stage
        previousCalls = contact.call_count || 0
      }
    }

    // Get transcript summary
    const transcriptSummary = call.transcript
      ? call.transcript.substring(0, 200) + '...'
      : 'No transcript available'

    const duration = call.duration_seconds || 0

    return {
      callId,
      contactId: call.contact_id,
      contactName,
      contactPhone: call.from_number || call.to_number || 'Unknown',
      callDuration: duration,
      transcriptSummary,
      sentiment: call.sentiment || 'neutral',
      handoffReason,
      handoffTrigger,
      dealStage,
      previousCalls,
      metadata: call.metadata,
    }
  } catch (error) {
    console.error('[Handoff Context] Error building context:', error)
    throw error
  }
}

/**
 * F0653: Log transfer to CRM with note
 */
export async function logTransferToCRM(
  contactId: number,
  callId: string,
  transferReason: string,
  outcome: string
): Promise<void> {
  try {
    const note = `Transfer initiated: ${transferReason}. Outcome: ${outcome}.`

    // Add note to contact
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('notes')
      .eq('id', contactId)
      .single()

    const updatedNotes = contact?.notes
      ? `${contact.notes}\n\n[${new Date().toISOString()}] ${note}`
      : note

    await supabaseAdmin
      .from('voice_agent_contacts')
      .update({ notes: updatedNotes })
      .eq('id', contactId)

    console.log(`[Transfer CRM] Logged transfer to contact ${contactId}`)
  } catch (error) {
    console.error('[Transfer CRM] Error logging transfer:', error)
  }
}

/**
 * F0650: Log transfer outcome
 */
export async function logTransferOutcome(outcome: Omit<TransferOutcome, 'createdAt'>): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_transfer_outcomes').insert({
      call_id: outcome.callId,
      success: outcome.success,
      transfer_type: outcome.transferType,
      transfer_reason: outcome.transferReason,
      transferred_to: outcome.transferredTo,
      rep_connected: outcome.repConnected,
      rep_answered_in_seconds: outcome.repAnsweredInSeconds,
      outcome: outcome.outcome,
    })

    console.log(`[Transfer Outcome] Logged ${outcome.outcome} for call ${outcome.callId}`)
  } catch (error) {
    console.error('[Transfer Outcome] Error logging:', error)
  }
}

/**
 * F0661: Get transfer rate metric
 */
export async function getTransferRate(options: {
  startDate?: string
  endDate?: string
  campaignId?: number
}): Promise<{
  totalCalls: number
  transferredCalls: number
  transferRate: number
  byOutcome: Record<string, number>
  averageTimeToAnswer: number
}> {
  try {
    // Get all calls in period
    let callsQuery = supabaseAdmin.from('voice_agent_calls').select('call_id')

    if (options.startDate) {
      callsQuery = callsQuery.gte('started_at', options.startDate)
    }

    if (options.endDate) {
      callsQuery = callsQuery.lte('started_at', options.endDate)
    }

    if (options.campaignId) {
      callsQuery = callsQuery.eq('campaign_id', options.campaignId)
    }

    const { data: calls } = await callsQuery

    const totalCalls = calls?.length || 0

    if (totalCalls === 0) {
      return {
        totalCalls: 0,
        transferredCalls: 0,
        transferRate: 0,
        byOutcome: {},
        averageTimeToAnswer: 0,
      }
    }

    const callIds = calls!.map((c) => c.call_id)

    // Get transfers
    const { data: transfers } = await supabaseAdmin
      .from('voice_agent_transfer_outcomes')
      .select('*')
      .in('call_id', callIds)

    const transferredCalls = transfers?.length || 0
    const transferRate = (transferredCalls / totalCalls) * 100

    // Count by outcome
    const byOutcome: Record<string, number> = {}
    let totalAnswerTime = 0
    let answeredCount = 0

    transfers?.forEach((t) => {
      const outcome = t.outcome || 'unknown'
      byOutcome[outcome] = (byOutcome[outcome] || 0) + 1

      if (t.rep_answered_in_seconds) {
        totalAnswerTime += t.rep_answered_in_seconds
        answeredCount++
      }
    })

    const averageTimeToAnswer = answeredCount > 0 ? totalAnswerTime / answeredCount : 0

    return {
      totalCalls,
      transferredCalls,
      transferRate: Math.round(transferRate * 100) / 100,
      byOutcome,
      averageTimeToAnswer: Math.round(averageTimeToAnswer * 100) / 100,
    }
  } catch (error) {
    console.error('[Transfer Rate] Error:', error)
    throw error
  }
}

/**
 * F0662: Classify transfer reason
 */
export function classifyTransferReason(trigger: string, transcript: string): string {
  const lowerTranscript = transcript.toLowerCase()

  // Map triggers to standardized categories
  if (trigger === 'high_value') {
    return 'high_value_opportunity'
  }

  if (trigger === 'frustration') {
    return 'customer_frustration'
  }

  if (trigger === 'compliance') {
    return 'legal_compliance'
  }

  if (trigger === 'explicit_request') {
    // Sub-classify based on keywords
    if (lowerTranscript.includes('cancel') || lowerTranscript.includes('refund')) {
      return 'cancellation_request'
    }

    if (lowerTranscript.includes('technical') || lowerTranscript.includes('not working')) {
      return 'technical_support'
    }

    if (lowerTranscript.includes('billing') || lowerTranscript.includes('charge')) {
      return 'billing_inquiry'
    }

    return 'general_request'
  }

  return 'other'
}
