// F0636, F0637, F0638: Human handoff triggers

import { supabaseAdmin } from './supabase'

export interface HandoffTrigger {
  type: 'high_value' | 'frustration' | 'compliance' | 'confused' | 'explicit_request'
  detected: boolean
  confidence: number // 0-1
  reason: string
  metadata?: any
}

/**
 * F0636: Detect high-value signal
 * Triggers handoff when caller indicates high purchase intent or budget
 */
export function detectHighValueSignal(transcript: string, metadata?: any): HandoffTrigger {
  const lowerTranscript = transcript.toLowerCase()

  // High-value keywords
  const highValueKeywords = [
    'enterprise',
    'team of',
    'company-wide',
    'budget',
    'million',
    'thousand employees',
    'fortune 500',
    'serious about',
    'ready to buy',
    'purchase order',
    'contract',
    'legal team',
    'c-level',
    'ceo',
    'cto',
    'vp',
    'director',
  ]

  let matchCount = 0
  const matches: string[] = []

  highValueKeywords.forEach((keyword) => {
    if (lowerTranscript.includes(keyword)) {
      matchCount++
      matches.push(keyword)
    }
  })

  const detected = matchCount >= 2 // At least 2 high-value signals
  const confidence = Math.min(matchCount / 5, 1.0) // Max out at 5 signals

  return {
    type: 'high_value',
    detected,
    confidence,
    reason: detected
      ? `High-value signals detected: ${matches.join(', ')}`
      : 'No high-value signals detected',
    metadata: { matches, matchCount },
  }
}

/**
 * F0637: Detect frustration
 * Triggers handoff when caller is frustrated or upset
 */
export function detectFrustration(transcript: string, metadata?: any): HandoffTrigger {
  const lowerTranscript = transcript.toLowerCase()

  // Frustration keywords
  const frustrationKeywords = [
    'frustrated',
    'annoyed',
    'upset',
    'angry',
    'ridiculous',
    'waste of time',
    'unacceptable',
    "doesn't work",
    "not working",
    'terrible',
    'awful',
    'worst',
    'horrible',
    'useless',
    'speak to a person',
    'real person',
    'human',
    'manager',
    'supervisor',
    "can't believe",
    'seriously',
  ]

  // Repetition patterns (sign of frustration)
  const repetitionPatterns = [
    /(.+)\1{2,}/, // Same word/phrase repeated 3+ times
    /\b(\w+)\s+\1\s+\1\b/, // Same word repeated 3 times in a row
  ]

  let matchCount = 0
  const matches: string[] = []

  frustrationKeywords.forEach((keyword) => {
    if (lowerTranscript.includes(keyword)) {
      matchCount++
      matches.push(keyword)
    }
  })

  // Check repetition
  repetitionPatterns.forEach((pattern) => {
    if (pattern.test(lowerTranscript)) {
      matchCount += 2 // Weight repetition higher
      matches.push('repetition detected')
    }
  })

  // Check for excessive punctuation (!!!, ???)
  if (/[!?]{3,}/.test(transcript)) {
    matchCount += 2
    matches.push('excessive punctuation')
  }

  const detected = matchCount >= 2 // At least 2 frustration signals
  const confidence = Math.min(matchCount / 6, 1.0)

  return {
    type: 'frustration',
    detected,
    confidence,
    reason: detected
      ? `Frustration signals detected: ${matches.join(', ')}`
      : 'No frustration detected',
    metadata: { matches, matchCount },
  }
}

/**
 * F0638: Detect compliance/legal trigger
 * Handoff required for legal, compliance, or regulatory topics
 */
export function detectComplianceTrigger(transcript: string, metadata?: any): HandoffTrigger {
  const lowerTranscript = transcript.toLowerCase()

  // Compliance keywords that require human review
  const complianceKeywords = [
    'legal',
    'lawyer',
    'attorney',
    'lawsuit',
    'sue',
    'court',
    'regulation',
    'compliance',
    'gdpr',
    'hipaa',
    'privacy policy',
    'terms of service',
    'data breach',
    'security incident',
    'whistleblow',
    'fraud',
    'illegal',
    'discrimination',
    'harassment',
    'complaint',
    'report',
    'investigation',
  ]

  let matchCount = 0
  const matches: string[] = []

  complianceKeywords.forEach((keyword) => {
    if (lowerTranscript.includes(keyword)) {
      matchCount++
      matches.push(keyword)
    }
  })

  // Even 1 compliance keyword should trigger
  const detected = matchCount >= 1
  const confidence = Math.min(matchCount / 3, 1.0)

  return {
    type: 'compliance',
    detected,
    confidence,
    reason: detected
      ? `Compliance/legal topic detected: ${matches.join(', ')}`
      : 'No compliance issues detected',
    metadata: { matches, matchCount },
  }
}

/**
 * Evaluate all handoff triggers for a call
 */
export function evaluateHandoffTriggers(
  transcript: string,
  metadata?: any
): {
  shouldHandoff: boolean
  triggers: HandoffTrigger[]
  primaryTrigger?: HandoffTrigger
} {
  const triggers = [
    detectHighValueSignal(transcript, metadata),
    detectFrustration(transcript, metadata),
    detectComplianceTrigger(transcript, metadata),
  ]

  const detectedTriggers = triggers.filter((t) => t.detected)
  const shouldHandoff = detectedTriggers.length > 0

  // Get highest confidence trigger
  const primaryTrigger = detectedTriggers.sort((a, b) => b.confidence - a.confidence)[0]

  return {
    shouldHandoff,
    triggers,
    primaryTrigger,
  }
}

/**
 * Log handoff event to database
 * F0676: Record transfer reason in call transcript
 */
export async function logHandoffEvent(
  callId: string,
  trigger: HandoffTrigger,
  options: {
    transferredTo?: string
    transferSuccessful?: boolean
    transcriptNote?: string // F0676
  } = {}
): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_handoff_log').insert({
      call_id: callId,
      trigger_type: trigger.type,
      trigger_confidence: trigger.confidence,
      trigger_reason: trigger.reason,
      trigger_metadata: trigger.metadata,
      transferred_to: options.transferredTo,
      transfer_successful: options.transferSuccessful,
    })

    // F0676: Add handoff reason to call transcript/notes
    if (options.transcriptNote !== undefined) {
      await supabaseAdmin.from('voice_agent_call_notes').insert({
        call_id: callId,
        note_type: 'handoff_trigger',
        content: `Transfer initiated: ${trigger.reason}`,
        metadata: {
          trigger_type: trigger.type,
          confidence: trigger.confidence,
        },
      })
    }

    console.log(`[Handoff] Logged ${trigger.type} handoff for call ${callId}`)
  } catch (error) {
    console.error('[Handoff] Error logging handoff event:', error)
  }
}

/**
 * F0679: Detect DTMF 0 press to trigger transfer
 */
export function detectDTMFTransferRequest(dtmfInput: string): HandoffTrigger {
  const detected = dtmfInput === '0'

  return {
    type: 'explicit_request',
    detected,
    confidence: 1.0,
    reason: detected
      ? 'Caller pressed 0 to request transfer to representative'
      : 'No DTMF transfer request',
    metadata: { dtmf: dtmfInput },
  }
}

/**
 * F0645: Get hold music configuration
 */
export async function getHoldMusicUrl(assistantId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('voice_agent_handoff_config')
      .select('hold_music_url')
      .eq('assistant_id', assistantId)
      .single()

    return data?.hold_music_url || null
  } catch (error) {
    console.error('[Handoff] Error fetching hold music:', error)
    return null
  }
}

/**
 * F0672: Check if representative is online/available
 */
export async function checkRepAvailability(destination: string): Promise<boolean> {
  try {
    // Check rep availability in database
    const { data } = await supabaseAdmin
      .from('voice_agent_representatives')
      .select('is_available, max_concurrent_calls, current_calls')
      .eq('phone_number', destination)
      .single()

    if (!data) {
      return false // Rep not found
    }

    // Check if rep is available and under capacity
    return data.is_available && data.current_calls < data.max_concurrent_calls
  } catch (error) {
    console.error('[Handoff] Error checking rep availability:', error)
    return false
  }
}

/**
 * F0672, F0681: Handle fallback when rep is offline
 */
export async function handleRepOfflineFallback(
  callId: string,
  callerPhone: string,
  fallbackBehavior: 'callback' | 'voicemail' | 'sms',
  smsTemplate?: string
): Promise<void> {
  try {
    if (fallbackBehavior === 'callback') {
      // Schedule a callback
      await supabaseAdmin.from('voice_agent_callbacks').insert({
        call_id: callId,
        phone_number: callerPhone,
        scheduled_for: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        reason: 'Representative offline during transfer attempt',
        status: 'pending',
      })
      console.log(`[Handoff] Scheduled callback for ${callerPhone}`)
    } else if (fallbackBehavior === 'sms') {
      // F0681: Send SMS with rep contact info
      const message =
        smsTemplate ||
        `Thank you for calling. Our representative is currently unavailable. We'll call you back within 1 hour. For immediate assistance, email support@example.com`

      // Send SMS via Twilio API (not implemented in this snippet)
      await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: callerPhone,
          message,
          call_id: callId,
        }),
      })
      console.log(`[Handoff] Sent fallback SMS to ${callerPhone}`)
    }

    // Log the fallback action
    await supabaseAdmin.from('voice_agent_call_notes').insert({
      call_id: callId,
      note_type: 'handoff_fallback',
      content: `Representative offline. Fallback: ${fallbackBehavior}`,
    })
  } catch (error) {
    console.error('[Handoff] Error handling rep offline fallback:', error)
  }
}

/**
 * F0682: Get recording notice message
 */
export async function getRecordingNoticeMessage(assistantId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('voice_agent_handoff_config')
      .select('recording_notice_enabled, recording_notice_message')
      .eq('assistant_id', assistantId)
      .single()

    if (data?.recording_notice_enabled) {
      return (
        data.recording_notice_message ||
        'This call is being recorded for quality and training purposes.'
      )
    }

    return null
  } catch (error) {
    console.error('[Handoff] Error fetching recording notice:', error)
    return null
  }
}

/**
 * F0675: Check if agent should resume after declined transfer
 */
export async function shouldResumeOnDecline(assistantId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('voice_agent_handoff_config')
      .select('resume_on_decline')
      .eq('assistant_id', assistantId)
      .single()

    return data?.resume_on_decline ?? true // Default to true
  } catch (error) {
    console.error('[Handoff] Error checking resume setting:', error)
    return true
  }
}
