// F0654: Transfer SMS to rep - send SMS to rep with caller details before transfer

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { sendSingleSMS } from '@/lib/sms-helpers'

interface NotifyRepRequest {
  rep_phone: string
  call_id: string
  caller_name?: string
  caller_phone?: string
  reason?: string
  priority?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: NotifyRepRequest = await request.json()
    const { rep_phone, call_id, caller_name, caller_phone, reason, priority } = body

    if (!rep_phone || !call_id) {
      return apiError(ErrorCodes.BAD_REQUEST, 'rep_phone and call_id are required', 400)
    }

    // Get call details
    const { data: call, error: callError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('*, contacts:customer_phone(name, email, company)')
      .eq('id', call_id)
      .single()

    if (callError || !call) {
      return apiError(ErrorCodes.NOT_FOUND, 'Call not found', 404)
    }

    // Build SMS message
    const contactName = caller_name || call.contacts?.name || 'Unknown Caller'
    const contactPhone = caller_phone || call.customer_phone || 'N/A'
    const transferReason = reason || 'Customer requested transfer'
    const urgency = priority || 'normal'

    const message = `
🔔 Incoming Transfer ${urgency === 'high' ? '(URGENT)' : ''}

From: ${contactName}
Phone: ${contactPhone}
Reason: ${transferReason}
Call Duration: ${Math.floor((call.duration_seconds || 0) / 60)}m

Call ID: ${call_id}

Please stand by to receive the call.
    `.trim()

    // Send SMS to rep
    const smsResult = await sendSingleSMS({
      to: rep_phone,
      message,
    })

    if (!smsResult.success) {
      return apiError(
        ErrorCodes.EXTERNAL_API_ERROR,
        `Failed to send notification SMS: ${smsResult.error}`,
        500
      )
    }

    // Log the notification
    await supabaseAdmin.from('handoff_notifications').insert({
      call_id,
      rep_phone,
      message,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
      sms_sid: smsResult.message_sid,
    })

    return apiSuccess({
      message: 'Rep notified successfully',
      sms_sid: smsResult.message_sid,
      sent_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Rep notification error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to notify rep: ${error.message}`,
      500
    )
  }
}
