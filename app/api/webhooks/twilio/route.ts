// F0512: POST /api/webhooks/twilio - Handles inbound SMS
// F0510: SMS opt-out handling - STOP reply adds to DNC
// F0547: SMS webhook signature validation
// F1323: Use edge runtime for webhook performance

// Changed to nodejs runtime due to twilio module requirement
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isOptOutMessage } from '@/lib/sms-templates'
import { normalizePhoneNumber } from '@/lib/phone-utils'

const twilio = require('twilio')

// F0547: Validate Twilio webhook signature
function validateTwilioSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('x-twilio-signature')
  const url = request.url

  if (!signature || !process.env.TWILIO_AUTH_TOKEN) {
    return false
  }

  try {
    return twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      body
    )
  } catch (error) {
    console.error('Error validating Twilio signature:', error)
    return false
  }
}

// F0512: Handle incoming SMS
export async function POST(request: NextRequest) {
  try {
    // Parse form data (Twilio sends application/x-www-form-urlencoded)
    const formData = await request.formData()
    const body = Object.fromEntries(formData.entries())

    // F0547: Validate webhook signature
    // Note: In production, you should validate the signature
    // For now, we'll log a warning if validation fails
    const isValid = validateTwilioSignature(
      request,
      new URLSearchParams(formData as any).toString()
    )

    if (!isValid && process.env.NODE_ENV === 'production') {
      console.error('Invalid Twilio webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const from = body.From as string
    const to = body.To as string
    const messageBody = body.Body as string
    const messageSid = body.MessageSid as string

    console.log(`Inbound SMS from ${from}: ${messageBody}`)

    // Normalize phone number
    const fromNormalized = normalizePhoneNumber(from)

    // F0510: Check if message is an opt-out keyword (STOP, UNSUBSCRIBE, etc.)
    if (isOptOutMessage(messageBody)) {
      console.log(`Opt-out request from ${fromNormalized}`)

      // Add to DNC list
      const { error: dncError } = await supabaseAdmin
        .from('dnc_list')
        .upsert(
          {
            phone: fromNormalized,
            source: 'self-service',
            reason: 'SMS opt-out via STOP keyword',
            added_by: 'system',
          },
          { onConflict: 'phone' }
        )

      if (dncError) {
        console.error('Error adding to DNC:', dncError)
      }

      // Update contact opt_out_sms flag
      const { error: contactError } = await supabaseAdmin
        .from('voice_agent_contacts')
        .update({ opt_out_sms: true })
        .eq('phone', fromNormalized)

      if (contactError && contactError.code !== 'PGRST116') {
        console.error('Error updating contact opt-out:', contactError)
      }

      // Log the inbound SMS
      await supabaseAdmin.from('sms_logs').insert({
        message_sid: messageSid,
        to_number: to,
        from_number: fromNormalized,
        body: messageBody,
        status: 'received',
      })

      // Respond with confirmation (optional - Twilio will send auto-reply)
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You have been unsubscribed and will not receive further messages.</Message>
</Response>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        }
      )
    }

    // Log all other inbound SMS
    await supabaseAdmin.from('sms_logs').insert({
      message_sid: messageSid,
      to_number: to,
      from_number: fromNormalized,
      body: messageBody,
      status: 'received',
    })

    // For non-opt-out messages, you could:
    // - Trigger a webhook to your CRM
    // - Create a task for human follow-up
    // - Use AI to classify intent and auto-respond

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    )
  } catch (error: any) {
    console.error('Error in POST /api/webhooks/twilio:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
