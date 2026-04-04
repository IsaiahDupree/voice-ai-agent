// F0960 & F0419: POST /api/tools/sendSMS - Executes sendSMS tool with MMS support

import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, isTwilioTestMode } from '@/lib/sms'
import { supabaseAdmin } from '@/lib/supabase'
import { withTelemetry } from '@/lib/tool-telemetry'

/**
 * F0960 & F0419: POST /api/tools/sendSMS
 * Sends SMS/MMS via Twilio
 * Used by voice agent to send follow-ups or confirmations during call
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  return withTelemetry('sendSMS', body.callId, body, async () => {
    const { to, message, callId, contactId, mediaUrl } = body // F0419: Added mediaUrl for MMS

    // Validate inputs
    if (!to) {
      return NextResponse.json({ error: 'to phone number is required' }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // Validate phone number format
    if (!/^\+?[1-9]\d{1,14}$/.test(to)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)' },
        { status: 400 }
      )
    }

    // Check if contact has opted out of SMS
    if (contactId) {
      const { data: contact } = await supabaseAdmin
        .from('voice_agent_contacts')
        .select('opt_out_sms')
        .eq('id', contactId)
        .single()

      if (contact?.opt_out_sms) {
        return NextResponse.json(
          {
            success: false,
            error: 'Contact has opted out of SMS',
            optedOut: true,
          },
          { status: 400 }
        )
      }
    }

    // Check message length (Twilio limit is 1600 chars for concatenated messages)
    if (message.length > 1600) {
      return NextResponse.json(
        { error: 'Message exceeds 1600 character limit' },
        { status: 400 }
      )
    }

    // F0419: Validate media URL if provided
    if (mediaUrl) {
      if (!/^https?:\/\/.+/.test(mediaUrl)) {
        return NextResponse.json(
          { error: 'mediaUrl must be a valid HTTP(S) URL' },
          { status: 400 }
        )
      }
    }

    // Send SMS/MMS via Twilio
    const result = await sendSMS({
      to,
      body: message,
      mediaUrl: mediaUrl ? [mediaUrl] : undefined, // F0419: Pass media URL for MMS
    })

    // Format response for voice agent
    const isTest = isTwilioTestMode()
    const messageType = mediaUrl ? 'MMS' : 'SMS'
    const response = {
      success: true,
      messageSid: result.sid,
      to,
      message,
      mediaUrl: mediaUrl || null, // F0419: Include media URL in response
      messageType, // F0419: Indicate if SMS or MMS
      status: result.status,
      isTest,
      sentAt: new Date().toISOString(),
      confirmation: isTest
        ? `Test ${messageType} queued (no actual message sent)`
        : `${messageType} sent successfully to ${to}`,
    }

    return NextResponse.json(response, { status: 201 })
  })
}
