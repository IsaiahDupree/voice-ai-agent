import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendSMS, validatePhoneNumber, formatE164 } from '@/lib/sms'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, message, businessId, campaignId, templateId } = body

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'phone and message are required' },
        { status: 400 }
      )
    }

    const formattedPhone = formatE164(phone)

    if (!validatePhoneNumber(formattedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Check suppression list before sending
    const { data: suppressed } = await supabaseAdmin
      .from('localreach_suppression_list')
      .select('id')
      .eq('phone', formattedPhone)
      .single()

    if (suppressed) {
      return NextResponse.json(
        { error: 'Phone number is on the suppression list' },
        { status: 403 }
      )
    }

    // Check DNC / opt-out list
    const { data: optedOut } = await supabaseAdmin
      .from('voice_agent_sms_opt_outs')
      .select('id')
      .eq('phone_number', formattedPhone)
      .single()

    if (optedOut) {
      return NextResponse.json(
        { error: 'Phone number has opted out of SMS' },
        { status: 403 }
      )
    }

    // Send via Twilio
    const result = await sendSMS({
      to: formattedPhone,
      body: message,
    })

    // Log the SMS
    await supabaseAdmin.from('localreach_sms_log').insert({
      business_id: businessId || null,
      campaign_id: campaignId || null,
      template_id: templateId || null,
      phone: formattedPhone,
      message,
      twilio_sid: result.sid,
      status: result.status,
      direction: 'outbound',
      sent_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      sms: {
        sid: result.sid,
        status: result.status,
        to: result.to,
        from: result.from,
      },
    })
  } catch (error: any) {
    console.error('[Send SMS API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    )
  }
}
