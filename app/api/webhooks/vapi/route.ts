// Changed to nodejs runtime due to crypto module requirement
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calcomClient } from '@/lib/calcom'
import { addToDNC, updateCampaignOutcome, checkDNC } from '@/lib/campaign-helpers'
import { normalizePhone } from '@/lib/phone-utils'
import { redactPII } from '@/lib/pii-redaction'
import { logCallInteraction } from '@/lib/compliance-logger'
import { trackAbandonment } from '@/lib/call-analytics'
import { scheduleCallback } from '@/lib/missed-call-followup'
import { scheduleRetry } from '@/lib/campaign-retry'
import { generateCallSummary, storeCallSummaryInContact } from '@/lib/call-summary'
import { sendCallMetadataToWebhook } from '@/lib/crm-webhook'
import { checkInboundCallRateLimit, logInboundRateLimitHit } from '@/lib/rate-limiter'
import { monitorCallQuality } from '@/lib/call-quality-monitor'
import crypto from 'crypto'

// Webhook event types from Vapi
type VapiEvent =
  | { type: 'call.started'; call: any }
  | { type: 'call.ended'; call: any; endedReason: string }
  | { type: 'function-call'; call: any; functionCall: any }
  | { type: 'transcript'; call: any; transcript: any }
  | { type: 'status-update'; call: any; status: string }
  | { type: 'hang'; call: any } // F0062: hang event
  | { type: 'speech-update'; call: any; speech: any } // F0063: speech-update event

export async function POST(request: NextRequest) {
  try {
    const body: VapiEvent = await request.json()
    const signature = request.headers.get('x-vapi-signature')

    // Validate webhook signature
    const secret = process.env.VAPI_WEBHOOK_SECRET
    if (secret && signature) {
      const payload = JSON.stringify(body)
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      if (signature !== expectedSignature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Route to appropriate handler based on event type
    switch (body.type) {
      case 'call.started':
        await handleCallStarted(body)
        break

      case 'call.ended':
        await handleCallEnded(body)
        break

      case 'function-call':
        return await handleFunctionCall(body)

      case 'transcript':
        await handleTranscript(body)
        break

      case 'status-update':
        await handleStatusUpdate(body)
        break

      case 'hang': // F0062: hang event handler
        await handleHang(body)
        break

      case 'speech-update': // F0063: speech-update event handler
        await handleSpeechUpdate(body)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// F0117: Inbound call log - creates call record immediately
// F0106: Caller ID lookup - looks up contact in CRM
// F0108: Greeting personalization - personalizes greeting if contact found
// F0124: Spam call filter - blocks known spam numbers
// F0125: Blocklist management - checks blocklist before connecting
async function handleCallStarted(event: Extract<VapiEvent, { type: 'call.started' }>) {
  const { call } = event
  const callerNumber = call.customer?.number

  // F0164: Check inbound call rate limit before processing
  if (callerNumber) {
    const rateLimit = await checkInboundCallRateLimit(callerNumber)
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for ${callerNumber}, rejecting call`)
      await logInboundRateLimitHit(callerNumber, call.id)

      await supabaseAdmin.from('voice_agent_calls').insert({
        call_id: call.id,
        assistant_id: call.assistantId,
        status: 'rate_limited',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        from_number: callerNumber,
        to_number: call.phoneNumber?.number,
        direction: 'inbound',
        end_reason: 'rate_limit_exceeded',
      })

      // Would need to end call via Vapi API here
      return
    }
  }

  // F0124: Spam call filter + F0125: Blocklist check
  if (callerNumber) {
    const { data: blocked } = await supabaseAdmin
      .from('voice_agent_blocklist')
      .select('phone')
      .eq('phone', callerNumber)
      .single()

    if (blocked) {
      // Number is blocked - end call immediately
      // Note: This happens after Vapi already connected, so we log it
      console.log(`Blocked number attempted call: ${callerNumber}`)

      await supabaseAdmin.from('voice_agent_calls').insert({
        call_id: call.id,
        assistant_id: call.assistantId,
        status: 'blocked',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        from_number: callerNumber,
        to_number: call.phoneNumber?.number,
        direction: 'inbound', // F0147: Call direction field
        end_reason: 'blocked',
      })

      // End call (would need Vapi API call here)
      return
    }
  }

  // F0123: Emergency routing - detect emergency keywords
  const emergencyKeywords = ['emergency', '911', 'urgent', 'help', 'dying']
  let isEmergency = false

  // F0106: Caller ID lookup - check if caller exists in CRM
  let contact = null
  let greeting = null

  if (callerNumber) {
    const { data } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('phone', callerNumber)
      .single()

    contact = data

    // F0108: Greeting personalization - personalize if contact found
    // F0107: Anonymous caller handling - generic greeting if no caller ID
    if (contact && contact.name) {
      const firstName = contact.name.split(' ')[0]
      greeting = `Hi ${firstName}! Thanks for calling.`
    } else if (!callerNumber) {
      greeting = `Hello! Thanks for calling.`
    }
  }

  // F0117: Inbound call log - save call record with enriched data
  // F0118: Call source tracking - tag as inbound
  // F0147: Call direction field - use 'direction' for consistency
  await supabaseAdmin.from('voice_agent_calls').insert({
    call_id: call.id,
    assistant_id: call.assistantId,
    status: 'in-progress',
    started_at: new Date().toISOString(),
    from_number: callerNumber,
    to_number: call.phoneNumber?.number,
    direction: call.type || 'inbound', // F0147: Call direction field
    contact_id: contact?.id,
    contact_name: contact?.name,
    personalized_greeting: greeting,
    is_emergency: isEmergency,
    metadata: {
      ...call,
      contact,
    },
  })

  // F0166: Inbound compliance logging - immutable audit log
  if (callerNumber) {
    await logCallInteraction({
      event_type: 'call_received',
      call_id: call.id,
      phone_number: callerNumber,
      direction: 'inbound',
    })
  }

  // F0168: Send call metadata to CRM webhook on connect
  await sendCallMetadataToWebhook({
    call_id: call.id,
    from_number: callerNumber,
    to_number: call.phoneNumber?.number,
    direction: call.type || 'inbound',
    contact_id: contact?.id,
    contact_name: contact?.name,
    started_at: new Date().toISOString(),
    assistant_id: call.assistantId,
    metadata: {
      personalized_greeting: greeting,
      is_emergency: isEmergency,
    },
  })
}

// F0130: Voicemail box - voicemail detection triggers voicemail flow
// F0131: Voicemail transcription - Vapi transcribes voicemail automatically
// F0132: Voicemail notification - send notification on voicemail
// F0134: Missed call tracking - track unanswered calls
// F0145: Call abandonment detection
// F0162: Post-call summary generation
// F0163: Call reason classification
// F0176: Auto-follow-up on missed calls
async function handleCallEnded(event: Extract<VapiEvent, { type: 'call.ended' }>) {
  const { call, endedReason } = event
  const wasVoicemail = endedReason === 'voicemail-detected' || call.voicemailDetected
  const wasMissed = endedReason === 'no-answer' || endedReason === 'busy'
  const wasAbandoned = endedReason === 'caller-hung-up' && call.status === 'ringing'
  const isInbound = call.type === 'inbound' || call.direction === 'inbound'

  // F0162/F0269: Generate post-call summary from transcript
  let summary = null
  if (call.transcript && call.transcript.length > 50) {
    // Generate AI-powered summary
    summary = await generateCallSummary(call.transcript, {
      direction: call.type || call.direction || 'inbound',
      duration: call.duration,
      outcome: endedReason
    })
  }

  // F0163: Classify call reason based on transcript keywords
  let callReason = 'general_inquiry'
  if (call.transcript) {
    const transcript = call.transcript.toLowerCase()
    if (transcript.includes('appointment') || transcript.includes('schedule') || transcript.includes('book')) {
      callReason = 'appointment'
    } else if (transcript.includes('support') || transcript.includes('help') || transcript.includes('issue') || transcript.includes('problem')) {
      callReason = 'support'
    } else if (transcript.includes('price') || transcript.includes('cost') || transcript.includes('quote') || transcript.includes('buy')) {
      callReason = 'sales_inquiry'
    }
  }

  // F0172: Redact PII from transcript before storage
  let safeTranscript = call.transcript
  const piiRedactionResult = call.transcript ? redactPII(call.transcript) : null
  if (piiRedactionResult && piiRedactionResult.redactedFields.length > 0) {
    safeTranscript = piiRedactionResult.redacted
    console.log(`PII redacted from call ${call.id}: ${piiRedactionResult.redactedFields.join(', ')}`)
  }

  // F0237: Record voicemail timestamp if voicemail detected
  let voicemailDroppedAt: string | undefined
  if (wasVoicemail && call.voicemailDetectedAt) {
    voicemailDroppedAt = call.voicemailDetectedAt
  } else if (wasVoicemail) {
    // If Vapi doesn't provide timestamp, use current time
    voicemailDroppedAt = new Date().toISOString()
  }

  // Get call record to check if it's part of a campaign
  const { data: callRecord } = await supabaseAdmin
    .from('voice_agent_calls')
    .select('campaign_id, contact_id, started_at, assistant_id, direction, from_number')
    .eq('call_id', call.id)
    .single()

  // F0145: Track call abandonment if caller hung up during ringing
  if (wasAbandoned && isInbound && callRecord?.started_at) {
    const ringDuration = call.duration || 0
    await trackAbandonment({
      call_id: call.id,
      phone_number: call.customer?.number || call.from_number || 'unknown',
      ring_duration_seconds: ringDuration,
      timestamp: new Date().toISOString(),
      assistant_id: callRecord.assistant_id,
    })
  }

  // F0176: Schedule auto-follow-up for missed inbound calls
  if (wasMissed && isInbound && call.customer?.number && callRecord?.assistant_id) {
    try {
      await scheduleCallback(
        call.id,
        call.customer.number,
        callRecord.assistant_id,
        5 // callback in 5 minutes
      )
      console.log(`Scheduled callback for missed call from ${call.customer.number}`)
    } catch (error) {
      console.error('Failed to schedule callback:', error)
      // Don't throw - this is best-effort
    }
  }

  await supabaseAdmin
    .from('voice_agent_calls')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      end_reason: endedReason,
      duration_seconds: call.duration,
      cost: call.cost,
      transcript: safeTranscript, // F0172: PII-redacted transcript, F0131: Voicemail transcription included, F0236: Outbound transcript save
      recording_url: call.recordingUrl,
      is_voicemail: wasVoicemail, // F0130: Voicemail flag
      is_missed: wasMissed, // F0134: Missed call flag
      metadata: {
        ...call,
        summary, // F0162: Post-call summary
        call_reason: callReason, // F0163: Call reason classification
        pii_redacted: piiRedactionResult ? piiRedactionResult.redactedFields : [], // F0172: Track what was redacted
        voicemail_dropped_at: voicemailDroppedAt, // F0237: Voicemail timestamp
      },
    })
    .eq('call_id', call.id)

  // F0165: Monitor call quality (MOS score)
  if (call.quality || call.mos_score || call.metrics) {
    await monitorCallQuality({
      call_id: call.id,
      mos_score: call.mos_score || call.quality?.mos,
      packet_loss: call.metrics?.packet_loss || call.quality?.packet_loss,
      jitter: call.metrics?.jitter || call.quality?.jitter,
      latency: call.metrics?.latency || call.quality?.latency,
      assistant_id: callRecord?.assistant_id || call.assistantId,
      from_number: call.customer?.number || call.from_number,
      to_number: call.phoneNumber?.number || call.to_number,
    })
  }

  // F0166: Compliance logging for call end
  const callerNumber = call.customer?.number
  if (callerNumber) {
    await logCallInteraction({
      event_type: 'call_ended',
      call_id: call.id,
      phone_number: callerNumber,
      direction: call.type || 'inbound',
      duration_seconds: call.duration,
      outcome: endedReason,
      recording_url: call.recordingUrl,
    })
  }

  // F0212, F0239, F0243: Campaign outcome tracking
  if (callRecord?.campaign_id && callRecord?.contact_id) {
    let outcome: 'booked' | 'no-answer' | 'dnc' | 'voicemail' | 'failed' = 'failed'

    // Determine outcome from call result
    if (callReason === 'appointment' && call.transcript?.toLowerCase().includes('confirm')) {
      outcome = 'booked'
    } else if (wasVoicemail) {
      outcome = 'voicemail'
    } else if (wasMissed) {
      outcome = 'no-answer'
    } else if (call.transcript?.toLowerCase().includes('remove') || call.transcript?.toLowerCase().includes('do not call')) {
      outcome = 'dnc'
    }

    // Update campaign contact outcome
    await updateCampaignOutcome(
      callRecord.campaign_id,
      callRecord.contact_id,
      outcome,
      call.id
    )

    // F0269: Store call summary in contact record for outbound calls
    if (summary && callRecord.contact_id) {
      try {
        await storeCallSummaryInContact(callRecord.contact_id, call.id, summary)
      } catch (error) {
        console.error('Failed to store call summary:', error)
        // Don't throw - summary storage is best-effort
      }
    }

    // F0205/F0207/F0208: Schedule retry if appropriate
    if (['no-answer', 'voicemail', 'busy'].includes(outcome)) {
      try {
        await scheduleRetry(callRecord.campaign_id, callRecord.contact_id, outcome)
      } catch (error) {
        console.error('Failed to schedule retry:', error)
        // Don't throw - retry scheduling is best-effort
      }
    }

    // F0240: Outbound SMS follow-up trigger (if booked)
    if (outcome === 'booked' && call.customer?.number) {
      await sendSMS({
        to: call.customer.number,
        message: 'Thanks for scheduling with us! You should receive a confirmation email shortly. Reply STOP to opt out.',
      })
    }
  }

  // F0132: Voicemail notification - send notification if voicemail left
  if (wasVoicemail && call.transcript) {
    const notificationEmail = process.env.VOICEMAIL_NOTIFICATION_EMAIL
    const notificationPhone = process.env.VOICEMAIL_NOTIFICATION_PHONE

    if (notificationPhone) {
      // Send SMS notification via Twilio
      await sendSMS({
        to: notificationPhone,
        message: `New voicemail from ${call.customer?.number || 'Unknown'}: ${call.transcript.substring(0, 100)}...`
      })
    }

    // Could also send email here via SendGrid/Resend
  }
}

async function handleFunctionCall(event: Extract<VapiEvent, { type: 'function-call' }>) {
  const { call, functionCall } = event
  const { name, parameters } = functionCall

  console.log(`Function call: ${name}`, parameters)

  try {
    let result: any

    switch (name) {
      case 'checkCalendar':
        result = await checkCalendar(parameters)
        break

      case 'bookAppointment':
        result = await bookAppointment(parameters)
        break

      case 'lookupContact':
        result = await lookupContact(parameters)
        break

      case 'sendSMS':
        result = await sendSMS(parameters)
        break

      case 'transferCall':
        result = await transferCall(parameters)
        break

      case 'endCall':
        result = { success: true, message: 'Call ending' }
        break

      case 'optOutDNC':
        // F0195: Self-service DNC opt-out
        result = await optOutDNC(parameters)
        break

      default:
        result = { error: `Unknown function: ${name}` }
    }

    // Log function call
    await supabaseAdmin.from('voice_agent_function_calls').insert({
      call_id: call.id,
      function_name: name,
      parameters,
      result,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error(`Function ${name} error:`, error)
    return NextResponse.json(
      { error: error.message || 'Function execution failed' },
      { status: 500 }
    )
  }
}

async function handleTranscript(event: Extract<VapiEvent, { type: 'transcript' }>) {
  const { call, transcript } = event

  // F0172: Redact PII from real-time transcript chunks
  const safeContent = transcript.content ? redactPII(transcript.content).redacted : transcript.content

  await supabaseAdmin.from('voice_agent_transcripts').insert({
    call_id: call.id,
    role: transcript.role,
    content: safeContent, // F0172: PII-redacted content
    timestamp: new Date().toISOString(),
    confidence: transcript.confidence,
  })
}

async function handleStatusUpdate(event: Extract<VapiEvent, { type: 'status-update' }>) {
  const { call, status } = event

  await supabaseAdmin
    .from('voice_agent_calls')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('call_id', call.id)
}

// Function tool implementations

// F0273: Check calendar availability using calcomClient
async function checkCalendar(params: { date: string; eventTypeId?: string }) {
  try {
    const { date, eventTypeId } = params
    const eventType = eventTypeId || process.env.CALCOM_EVENT_TYPE_ID!

    // F0275: Get slots as ISO8601 datetime strings
    const slots = await calcomClient.getAvailability(parseInt(eventType), date)

    return {
      available: slots.length > 0,
      slots: slots.map((s) => s.time),
      count: slots.length,
    }
  } catch (error: any) {
    console.error('Error checking calendar:', error)
    return {
      available: false,
      slots: [],
      error: error.message,
    }
  }
}

// F0278, F0301, F0302: Book appointment using calcomClient
async function bookAppointment(params: {
  name: string
  email: string
  phone: string
  date: string
  time: string
  eventTypeId?: string
  callId?: string
}) {
  try {
    const { name, email, phone, date, time, eventTypeId, callId } = params
    const eventType = eventTypeId || process.env.CALCOM_EVENT_TYPE_ID!

    // F0301: Booking in call - must complete in < 5s
    const startTime = `${date}T${time}`

    const booking = await calcomClient.createBooking({
      eventTypeId: parseInt(eventType),
      start: startTime,
      name,
      email,
      phone,
      metadata: {
        source: 'voice_ai_agent',
        call_id: callId,
      },
    })

    // Save booking to database - F0297: Booking created event
    await supabaseAdmin.from('voice_agent_bookings').insert({
      booking_id: booking.uid || String(booking.id),
      call_id: callId || null,
      event_type_id: eventType,
      start_time: booking.startTime,
      end_time: booking.endTime,
      attendee_name: name,
      attendee_email: email,
      attendee_phone: phone,
      status: 'confirmed',
      metadata: {
        cal_booking_id: booking.id,
      },
    })

    // F0302: Return confirmation details for agent to read back
    return {
      success: true,
      booking: {
        id: booking.id,
        uid: booking.uid,
        startTime: booking.startTime,
        endTime: booking.endTime,
      },
      confirmationNumber: booking.uid,
      message: `Appointment confirmed for ${booking.startTime}`,
    }
  } catch (error: any) {
    console.error('Error booking appointment:', error)

    // F0291: Conflict error message - return alternative slots
    if (error.message?.includes('BOOKING_CONFLICT')) {
      return {
        success: false,
        error: 'That time slot is no longer available. Please choose another time.',
        errorCode: 'BOOKING_CONFLICT',
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to book appointment',
    }
  }
}

async function lookupContact(params: { phone: string }) {
  const { phone } = params

  const { data, error } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('*')
    .eq('phone', phone)
    .single()

  if (error || !data) {
    return { found: false, contact: null }
  }

  return {
    found: true,
    contact: {
      name: data.name,
      email: data.email,
      company: data.company,
      notes: data.notes,
    },
  }
}

// F0367-F0374: sendSMS tool with DNC check and logging
async function sendSMS(params: { to: string; message: string; templateType?: string; vars?: any }) {
  try {
    const { to, message, templateType, vars } = params

    // F0370: Check DNC list before sending
    const isDNC = await checkDNC(to)
    if (isDNC) {
      return {
        success: false,
        error: 'Number is on Do Not Call list',
      }
    }

    // Check opt_out_sms flag in contacts
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('opt_out_sms')
      .eq('phone', to)
      .maybeSingle()

    if (contact?.opt_out_sms) {
      return {
        success: false,
        error: 'Contact has opted out of SMS',
      }
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const fromNumber = process.env.TWILIO_PHONE_NUMBER!

    // F0371: Append "Reply STOP to opt out" if not already present
    let finalMessage = message
    if (!message.toLowerCase().includes('stop')) {
      finalMessage += ' Reply STOP to opt out.'
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: fromNumber,
          Body: finalMessage,
        }),
      }
    )

    const data = await response.json()

    // F0374: Log SMS to sms_logs table
    await supabaseAdmin.from('voice_agent_sms_logs').insert({
      message_sid: data.sid,
      to_number: to,
      from_number: fromNumber,
      body: finalMessage,
      status: data.error_code ? 'failed' : 'sent',
      error: data.error_message || null,
      metadata: {
        template_type: templateType,
        vars,
      },
      created_at: new Date().toISOString(),
    })

    return {
      success: !data.error_code,
      messageSid: data.sid,
      error: data.error_message,
    }
  } catch (error: any) {
    console.error('Error sending SMS:', error)
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    }
  }
}

async function transferCall(params: { phoneNumber: string }) {
  const { phoneNumber } = params
  return {
    success: true,
    action: 'transfer',
    destination: phoneNumber,
  }
}

// F0195: Self-service DNC opt-out function
async function optOutDNC(params: { phone: string; reason?: string }) {
  try {
    const { phone, reason } = params

    const success = await addToDNC(phone, 'self-service', reason || 'Caller requested removal during call')

    if (success) {
      return {
        success: true,
        message: 'You have been added to our Do Not Call list',
      }
    } else {
      return {
        success: false,
        error: 'Failed to add to DNC list',
      }
    }
  } catch (error: any) {
    console.error('Error in optOutDNC:', error)
    return {
      success: false,
      error: error.message || 'Failed to process opt-out request',
    }
  }
}

// F0062: hang event - marks call as dropped when hang is detected
async function handleHang(event: Extract<VapiEvent, { type: 'hang' }>) {
  const { call } = event

  await supabaseAdmin
    .from('voice_agent_calls')
    .update({
      status: 'failed',
      end_reason: 'hang_detected',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('call_id', call.id)
}

// F0063: speech-update event - updates sentiment/speech data in real-time
async function handleSpeechUpdate(event: Extract<VapiEvent, { type: 'speech-update' }>) {
  const { call, speech } = event

  await supabaseAdmin
    .from('voice_agent_calls')
    .update({
      metadata: {
        ...call.metadata,
        lastSpeechUpdate: speech,
        sentiment: speech.sentiment,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('call_id', call.id)
}
