// F0522: SMS segment count - Calculate and log segment count
// F0526: MMS support - Send MMS with mediaUrl attachment
// F0527: SMS scheduling - Schedule SMS for future delivery
// F0528: Bulk SMS - Send SMS to list of numbers
// F0530: SMS cost tracking - Log Twilio SMS cost per message
// F0545: SMS char encoding - Handle Unicode characters in SMS body

import { supabaseAdmin } from './supabase'

/**
 * F0522: Calculate SMS segment count
 * GSM-7 encoding: 160 chars per segment
 * Unicode (UCS-2): 70 chars per segment
 */
export function calculateSMSSegments(message: string): {
  segments: number
  encoding: 'GSM-7' | 'UCS-2'
  charCount: number
  charLimit: number
} {
  // Check if message contains Unicode characters
  const hasUnicode = /[^\x00-\x7F]/.test(message)
  const encoding = hasUnicode ? 'UCS-2' : 'GSM-7'
  const charLimit = hasUnicode ? 70 : 160

  const charCount = message.length
  const segments = Math.ceil(charCount / charLimit)

  return { segments, encoding, charCount, charLimit }
}

/**
 * F0528: Bulk SMS - Send SMS to list of numbers
 */
export async function sendBulkSMS(params: {
  to_numbers: string[]
  message: string
  from_number?: string
  scheduled_for?: string
}): Promise<{
  success: boolean
  sent: number
  failed: number
  results: Array<{ to: string; success: boolean; message_sid?: string; error?: string }>
}> {
  try {
    const { to_numbers, message, from_number, scheduled_for } = params

    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const fromNumber = from_number || process.env.TWILIO_PHONE_NUMBER!

    const results: Array<{ to: string; success: boolean; message_sid?: string; error?: string }> = []
    let sent = 0
    let failed = 0

    for (const toNumber of to_numbers) {
      try {
        const result = await sendSingleSMS({
          to: toNumber,
          message,
          from_number: fromNumber,
          scheduled_for,
        })

        if (result.success) {
          sent++
          results.push({
            to: toNumber,
            success: true,
            message_sid: result.message_sid,
          })
        } else {
          failed++
          results.push({
            to: toNumber,
            success: false,
            error: result.error,
          })
        }
      } catch (error: any) {
        failed++
        results.push({
          to: toNumber,
          success: false,
          error: error.message,
        })
      }
    }

    return {
      success: failed === 0,
      sent,
      failed,
      results,
    }
  } catch (error: any) {
    console.error('Bulk SMS error:', error)
    throw error
  }
}

/**
 * F0526: MMS support + F0527: SMS scheduling + F0530: SMS cost tracking
 */
export async function sendSingleSMS(params: {
  to: string
  message: string
  from_number?: string
  media_url?: string // F0526: MMS support
  scheduled_for?: string // F0527: SMS scheduling
}): Promise<{
  success: boolean
  message_sid?: string
  cost?: number
  error?: string
  scheduled?: boolean
}> {
  try {
    const { to, message, from_number, media_url, scheduled_for } = params

    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const fromNumber = from_number || process.env.TWILIO_PHONE_NUMBER!

    // F0527: If scheduled_for is provided, store in database for later sending
    if (scheduled_for) {
      const { data, error } = await supabaseAdmin
        .from('voice_agent_scheduled_sms')
        .insert({
          to_number: to,
          from_number: fromNumber,
          body: message,
          media_url,
          scheduled_for,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        scheduled: true,
        message_sid: data.id,
      }
    }

    // F0522: Calculate SMS segments
    const segmentInfo = calculateSMSSegments(message)

    // Send SMS/MMS via Twilio
    const body = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: message,
    })

    // F0526: Add media URL for MMS
    if (media_url) {
      body.append('MediaUrl', media_url)
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    )

    const data = await response.json()

    if (data.error_code) {
      return {
        success: false,
        error: data.error_message || `Twilio error ${data.error_code}`,
      }
    }

    // F0530: SMS cost tracking - Twilio returns price in the response
    const cost = data.price ? Math.abs(parseFloat(data.price)) : undefined

    // Log SMS with segment count and cost
    await supabaseAdmin.from('voice_agent_sms_logs').insert({
      message_sid: data.sid,
      to_number: to,
      from_number: fromNumber,
      body: message,
      media_url,
      status: 'sent',
      segments: segmentInfo.segments,
      encoding: segmentInfo.encoding,
      cost, // F0530: Cost tracking
      created_at: new Date().toISOString(),
    })

    return {
      success: true,
      message_sid: data.sid,
      cost,
    }
  } catch (error: any) {
    console.error('Send SMS error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * F0527: Process scheduled SMS that are ready to send
 */
export async function processScheduledSMS() {
  try {
    const now = new Date().toISOString()

    // Get all pending SMS that should be sent now
    const { data: scheduled, error } = await supabaseAdmin
      .from('voice_agent_scheduled_sms')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)

    if (error) {
      console.error('Error fetching scheduled SMS:', error)
      return
    }

    if (!scheduled || scheduled.length === 0) {
      return
    }

    console.log(`Processing ${scheduled.length} scheduled SMS`)

    for (const sms of scheduled) {
      try {
        const result = await sendSingleSMS({
          to: sms.to_number,
          message: sms.body,
          from_number: sms.from_number,
          media_url: sms.media_url,
        })

        // Update status
        await supabaseAdmin
          .from('voice_agent_scheduled_sms')
          .update({
            status: result.success ? 'sent' : 'failed',
            sent_at: new Date().toISOString(),
            error: result.error,
            message_sid: result.message_sid,
          })
          .eq('id', sms.id)

        console.log(`Scheduled SMS ${sms.id}: ${result.success ? 'sent' : 'failed'}`)
      } catch (error: any) {
        console.error(`Error sending scheduled SMS ${sms.id}:`, error)
        await supabaseAdmin
          .from('voice_agent_scheduled_sms')
          .update({
            status: 'failed',
            error: error.message,
          })
          .eq('id', sms.id)
      }
    }
  } catch (error: any) {
    console.error('Process scheduled SMS error:', error)
  }
}

/**
 * F0540: SMS opt-out export - Export opt-out list to CSV
 */
export async function exportOptOutList(): Promise<string> {
  try {
    const { data: optOuts, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('phone, name, email, opt_out_sms_at, opt_out_reason')
      .eq('opt_out_sms', true)
      .order('opt_out_sms_at', { ascending: false })

    if (error) throw error

    const headers = ['Phone', 'Name', 'Email', 'Opted Out At', 'Reason']
    const rows = optOuts.map((contact) => [
      contact.phone || '',
      contact.name || '',
      contact.email || '',
      contact.opt_out_sms_at || '',
      contact.opt_out_reason || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return csv
  } catch (error: any) {
    console.error('Export opt-out list error:', error)
    throw error
  }
}
