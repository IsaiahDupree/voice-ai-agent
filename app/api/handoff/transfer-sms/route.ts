// F0654: Transfer SMS to rep - notify rep about SMS conversation needing attention

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { sendSMS } from '@/lib/sms'
import { addToQueue } from '@/lib/rep-queue'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { thread_id, rep_id, reason, send_sms_notification } = body

    if (!thread_id) {
      return apiError(ErrorCodes.BAD_REQUEST, 'Missing required field: thread_id', 400)
    }

    const supabase = supabaseAdmin

    // Get thread details
    const { data: thread, error: threadError } = await supabase
      .from('sms_threads')
      .select('*, contacts!inner(*)')
      .eq('id', thread_id)
      .single()

    if (threadError || !thread) {
      return apiError(ErrorCodes.NOT_FOUND, `Thread ${thread_id} not found`, 404)
    }

    const contact = thread.contacts

    // Get rep details
    let repPhone: string | undefined
    if (rep_id) {
      const { data: rep } = await supabase
        .from('users')
        .select('phone, name')
        .eq('id', rep_id)
        .single()

      repPhone = rep?.phone
    }

    // Create handoff record
    const { data: handoff, error: handoffError } = await supabase
      .from('sms_handoffs')
      .insert({
        thread_id,
        contact_id: contact.id,
        assigned_to: rep_id,
        reason: reason || 'Manual transfer',
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (handoffError) {
      return apiError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to create handoff: ${handoffError.message}`,
        500
      )
    }

    // Update thread status
    await supabase
      .from('sms_threads')
      .update({ status: 'handed_off', assigned_to: rep_id })
      .eq('id', thread_id)

    // Send SMS notification to rep if requested
    if (send_sms_notification && repPhone) {
      const message = `[Handoff] New SMS conversation assigned to you from ${contact.phone || 'Unknown'}. Reason: ${reason || 'N/A'}. Check dashboard for details.`

      try {
        await sendSMS({
          to: repPhone,
          body: message,
          from: thread.from_number,
        })
      } catch (smsError) {
        console.error('Failed to send SMS notification to rep:', smsError)
        // Continue even if SMS fails
      }
    }

    // Add to rep queue (F0657)
    if (contact.last_call_id) {
      try {
        await addToQueue({
          call_id: contact.last_call_id,
          contact_id: contact.id,
          escalation_level: 'medium',
          priority: 7,
        })
      } catch (queueError) {
        console.error('Failed to add to queue:', queueError)
      }
    }

    return apiSuccess({
      handoff,
      thread_id,
      assigned_to: rep_id,
      notification_sent: send_sms_notification && repPhone ? true : false,
    })
  } catch (error: any) {
    console.error('Transfer SMS error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to transfer SMS: ${error.message}`,
      500
    )
  }
}
