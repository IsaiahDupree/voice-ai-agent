// F0513: Twilio SMS delivery status webhook
// Receives real-time status updates from Twilio when SMS status changes

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0513: Handle Twilio SMS status callback
 * Called by Twilio when message status changes:
 * - queued
 * - sending
 * - sent
 * - delivered
 * - undelivered
 * - failed
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const messageSid = formData.get('MessageSid') as string
    const messageStatus = formData.get('MessageStatus') as string
    const errorCode = formData.get('ErrorCode') as string | null
    const errorMessage = formData.get('ErrorMessage') as string | null
    const to = formData.get('To') as string
    const from = formData.get('From') as string

    if (!messageSid || !messageStatus) {
      return NextResponse.json(
        { error: 'MessageSid and MessageStatus are required' },
        { status: 400 }
      )
    }

    console.log(
      `[SMS Status Webhook] ${messageSid}: ${messageStatus}${
        errorCode ? ` (Error: ${errorCode})` : ''
      }`
    )

    // F0513: Update SMS log with delivery status
    await updateSMSStatus(messageSid, {
      status: messageStatus,
      errorCode: errorCode || undefined,
      errorMessage: errorMessage || undefined,
      to,
      from,
    })

    // If delivery failed, log for retry handling
    if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      await handleDeliveryFailure(messageSid, {
        errorCode,
        errorMessage,
        to,
      })
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[SMS Status Webhook] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process status update' },
      { status: 500 }
    )
  }
}

/**
 * F0513: Update SMS log in database with delivery status
 */
async function updateSMSStatus(
  messageSid: string,
  status: {
    status: string
    errorCode?: string
    errorMessage?: string
    to?: string
    from?: string
  }
) {
  try {
    const { data: existingLog } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('id')
      .eq('message_sid', messageSid)
      .single()

    if (existingLog) {
      // Update existing log
      await supabaseAdmin
        .from('voice_agent_sms_logs')
        .update({
          status: status.status,
          error_code: status.errorCode || null,
          error_message: status.errorMessage || null,
          delivered_at:
            status.status === 'delivered' ? new Date().toISOString() : null,
          failed_at:
            status.status === 'failed' || status.status === 'undelivered'
              ? new Date().toISOString()
              : null,
          updated_at: new Date().toISOString(),
        })
        .eq('message_sid', messageSid)

      console.log(`[SMS Status] Updated log for ${messageSid}: ${status.status}`)
    } else {
      // Create new log entry (in case webhook arrives before we logged the send)
      await supabaseAdmin.from('voice_agent_sms_logs').insert({
        message_sid: messageSid,
        to_number: status.to,
        from_number: status.from,
        status: status.status,
        error_code: status.errorCode || null,
        error_message: status.errorMessage || null,
        direction: 'outbound',
        delivered_at:
          status.status === 'delivered' ? new Date().toISOString() : null,
        failed_at:
          status.status === 'failed' || status.status === 'undelivered'
            ? new Date().toISOString()
            : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      console.log(`[SMS Status] Created new log for ${messageSid}: ${status.status}`)
    }
  } catch (error) {
    console.error('[SMS Status] Failed to update log:', error)
    // Fail-open: don't block on database failures
  }
}

/**
 * Handle SMS delivery failure
 * Log for potential retry or investigation
 */
async function handleDeliveryFailure(
  messageSid: string,
  failure: {
    errorCode: string | null
    errorMessage: string | null
    to: string
  }
) {
  try {
    console.error(
      `[SMS Delivery Failed] ${messageSid} to ${failure.to}: ${failure.errorCode} - ${failure.errorMessage}`
    )

    // Could implement retry logic here based on error code
    // For now, just log the failure
    await supabaseAdmin.from('voice_agent_sms_failures').insert({
      message_sid: messageSid,
      to_number: failure.to,
      error_code: failure.errorCode,
      error_message: failure.errorMessage,
      failed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[SMS Delivery Failure] Failed to log failure:', error)
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    webhook: 'twilio-sms-status',
    status: 'active',
    features: ['F0513'],
  })
}
