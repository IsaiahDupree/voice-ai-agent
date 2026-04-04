// F0511: SMS opt-in handling
// Handle incoming START/STOP/HELP messages from Twilio

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0511: Handle Twilio incoming SMS webhook for opt-in/opt-out
 * Standard keywords: START, STOP, UNSTOP, HELP, INFO
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const from = formData.get('From') as string
    const body = (formData.get('Body') as string)?.trim().toUpperCase()
    const messageSid = formData.get('MessageSid') as string

    if (!from || !body) {
      return NextResponse.json(
        { error: 'From and Body are required' },
        { status: 400 }
      )
    }

    console.log(`[SMS Opt-In] Received: ${body} from ${from}`)

    // Handle opt-in keywords
    if (body === 'START' || body === 'UNSTOP' || body === 'YES') {
      await handleOptIn(from)
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been subscribed to SMS notifications. Reply STOP to unsubscribe.</Message></Response>',
        {
          headers: { 'Content-Type': 'text/xml' },
        }
      )
    }

    // Handle opt-out keywords
    if (body === 'STOP' || body === 'STOPALL' || body === 'UNSUBSCRIBE' || body === 'CANCEL' || body === 'END' || body === 'QUIT') {
      await handleOptOut(from)
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from SMS notifications. Reply START to resubscribe.</Message></Response>',
        {
          headers: { 'Content-Type': 'text/xml' },
        }
      )
    }

    // Handle HELP keyword
    if (body === 'HELP' || body === 'INFO') {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Voice AI Agent - Reply START to subscribe, STOP to unsubscribe. For support, visit our website or call our support line.</Message></Response>',
        {
          headers: { 'Content-Type': 'text/xml' },
        }
      )
    }

    // Log other incoming messages
    await logIncomingSMS(from, body, messageSid)

    // Return empty response (no auto-reply)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error: any) {
    console.error('[SMS Opt-In] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process SMS' },
      { status: 500 }
    )
  }
}

/**
 * F0511: Re-enable SMS for contact when they reply START
 */
async function handleOptIn(phoneNumber: string) {
  try {
    // Find contact by phone
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, sms_consent')
      .eq('phone', phoneNumber)
      .single()

    if (contact) {
      // Update SMS consent
      await supabaseAdmin
        .from('voice_agent_contacts')
        .update({
          sms_consent: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id)

      console.log(`[SMS Opt-In] Enabled SMS for contact ${contact.id}`)
    } else {
      // Create new contact with SMS consent
      await supabaseAdmin
        .from('voice_agent_contacts')
        .insert({
          phone: phoneNumber,
          sms_consent: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      console.log(`[SMS Opt-In] Created new contact with SMS consent: ${phoneNumber}`)
    }
  } catch (error) {
    console.error('[SMS Opt-In] Failed to handle opt-in:', error)
  }
}

/**
 * Disable SMS for contact when they reply STOP
 */
async function handleOptOut(phoneNumber: string) {
  try {
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id')
      .eq('phone', phoneNumber)
      .single()

    if (contact) {
      await supabaseAdmin
        .from('voice_agent_contacts')
        .update({
          sms_consent: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id)

      console.log(`[SMS Opt-Out] Disabled SMS for contact ${contact.id}`)
    }
  } catch (error) {
    console.error('[SMS Opt-Out] Failed to handle opt-out:', error)
  }
}

/**
 * Log incoming SMS for future reference
 */
async function logIncomingSMS(from: string, body: string, messageSid: string) {
  try {
    await supabaseAdmin.from('voice_agent_sms_logs').insert({
      message_sid: messageSid,
      from_number: from,
      body,
      direction: 'inbound',
      status: 'received',
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[SMS Opt-In] Failed to log incoming SMS:', error)
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    webhook: 'sms-opt-in',
    status: 'active',
    features: ['F0511'],
  })
}
