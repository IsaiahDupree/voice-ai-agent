// F0933: POST /api/sms/send - Sends SMS via Twilio
// F0509: Send SMS function
// F0506-F0556: Twilio SMS integration

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizePhoneNumber } from '@/lib/phone-utils'
import { renderSMSTemplate } from '@/lib/sms-templates'
import { getTwilioCredentials } from '@/lib/test-mode'
import { checkSMSRateLimit } from '@/lib/sms-utils'

const twilio = require('twilio')

// F0507: Twilio credentials from env
// F1186: Twilio test mode - uses test credentials when TWILIO_TEST_MODE=true
const twilioConfig = getTwilioCredentials()
const TWILIO_ACCOUNT_SID = twilioConfig.accountSid
const TWILIO_AUTH_TOKEN = twilioConfig.authToken
const TWILIO_PHONE_NUMBER = twilioConfig.phoneNumber
const IS_TEST_MODE = twilioConfig.isTest

let twilioClient: any = null

// Only initialize if we have valid credentials (not placeholder values)
const hasValidCredentials = TWILIO_ACCOUNT_SID &&
                             TWILIO_AUTH_TOKEN &&
                             (TWILIO_ACCOUNT_SID.startsWith('AC') || TWILIO_ACCOUNT_SID === '')

if (hasValidCredentials && TWILIO_ACCOUNT_SID !== '') {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
}

export async function POST(request: NextRequest) {
  try {
    if (!twilioClient) {
      return NextResponse.json(
        { error: 'Twilio not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const {
      to,
      message,
      template,
      templateVars,
      contactId,
      callId, // F0536: Link to voice_agent_calls
      campaignId, // F0537: Link to campaigns
      preview,
    } = body // F0426: preview mode

    // Normalize phone number to E.164
    const toNumber = normalizePhoneNumber(to)

    // F0550: Deduplication - prevent duplicate SMS in 10min window
    const dedup = await checkSMSRateLimit(toNumber, 10) // 10 minutes
    if (!dedup.allowed) {
      console.log(`[SMS Dedup] Blocking duplicate SMS to ${toNumber}`)
      return NextResponse.json(
        {
          error: `Duplicate SMS blocked. Last sent ${dedup.remainingTime} minutes ago.`,
          duplicate: true,
          remainingTime: dedup.remainingTime,
        },
        { status: 429 } // Too Many Requests
      )
    }

    // F0431: checkDNC tool - Check if number is on DNC list
    const { data: dncRecord } = await supabaseAdmin
      .from('dnc_list')
      .select('*')
      .eq('phone', toNumber)
      .single()

    if (dncRecord) {
      console.log(`Number ${toNumber} is on DNC list, skipping SMS`)
      return NextResponse.json(
        { error: 'Number is on Do Not Call list', dnc: true },
        { status: 403 }
      )
    }

    // F0610: Check if contact has opted out of SMS
    if (contactId) {
      const { data: contact } = await supabaseAdmin
        .from('voice_agent_contacts')
        .select('opt_out_sms')
        .eq('id', contactId)
        .single()

      if (contact?.opt_out_sms) {
        console.log(`Contact ${contactId} has opted out of SMS`)
        return NextResponse.json(
          { error: 'Contact has opted out of SMS', optedOut: true },
          { status: 403 }
        )
      }
    }

    // F0519: Template variable render
    let messageBody = message
    if (template) {
      messageBody = renderSMSTemplate(template, templateVars || {})
    }

    // F0556: SMS compliance footer - append opt-out instructions
    if (!messageBody.includes('STOP')) {
      messageBody = `${messageBody}\n\nReply STOP to opt out.`
    }

    // F0405: sendSMS length check - validate <= 1600 chars
    const MAX_SMS_LENGTH = 1600
    if (messageBody.length > MAX_SMS_LENGTH) {
      return NextResponse.json(
        {
          error: `Message too long: ${messageBody.length} characters (max ${MAX_SMS_LENGTH})`,
          length: messageBody.length,
          maxLength: MAX_SMS_LENGTH
        },
        { status: 400 }
      )
    }

    // F0426: sendSMS preview - return preview without sending in test mode or if preview=true
    if (preview || IS_TEST_MODE) {
      return NextResponse.json({
        preview: true,
        to: toNumber,
        from: TWILIO_PHONE_NUMBER,
        message: messageBody,
        length: messageBody.length,
        segmentCount: Math.ceil(messageBody.length / 160), // SMS segments
        estimatedCost: Math.ceil(messageBody.length / 160) * 0.0075, // $0.0075 per segment
      })
    }

    // F1186: Test mode - simulate SMS without real send
    let twilioMessage: any

    if (IS_TEST_MODE) {
      console.log('[TWILIO TEST MODE] Simulating SMS send:', {
        from: TWILIO_PHONE_NUMBER,
        to: toNumber,
        body: messageBody
      })

      // Return mock Twilio response
      twilioMessage = {
        sid: `TEST${Date.now()}`,
        status: 'sent',
        to: toNumber,
        from: TWILIO_PHONE_NUMBER,
        body: messageBody
      }
    } else {
      // F0509: Send SMS via Twilio
      twilioMessage = await twilioClient.messages.create({
        from: TWILIO_PHONE_NUMBER,
        to: toNumber,
        body: messageBody,
      })
    }

    // F0531-F0537: Log SMS to sms_logs table with links
    const { data: smsLog, error: logError } = await supabaseAdmin
      .from('sms_logs')
      .insert({
        message_sid: twilioMessage.sid, // F0534
        to_number: toNumber,
        from_number: TWILIO_PHONE_NUMBER,
        body: messageBody,
        status: twilioMessage.status, // F0533: queued/sent/delivered/failed
        contact_id: contactId || null, // F0535: Link to contacts
        call_id: callId || null, // F0536: Link to calls
        campaign_id: campaignId || null, // F0537: Link to campaigns
        direction: 'outbound',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (logError) {
      console.error('Error logging SMS:', logError)
    }

    return NextResponse.json({
      success: true,
      messageSid: twilioMessage.sid,
      status: twilioMessage.status,
      smsLog,
    })
  } catch (error: any) {
    console.error('Error sending SMS:', error)

    // F0373: sendSMS error - log failed SMS
    const { to } = await request.json()
    if (to) {
      await supabaseAdmin.from('sms_logs').insert({
        to_number: normalizePhoneNumber(to),
        from_number: TWILIO_PHONE_NUMBER,
        body: '',
        status: 'failed',
        error_message: error.message,
      })
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// F0541: SMS health check
export async function GET() {
  try {
    if (!twilioClient) {
      return NextResponse.json({
        status: 'error',
        message: 'Twilio not configured',
      })
    }

    // Verify Twilio credentials by fetching account info
    const account = await twilioClient.api.accounts(TWILIO_ACCOUNT_SID).fetch()

    return NextResponse.json({
      status: 'ok',
      accountStatus: account.status,
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
    })
  }
}
