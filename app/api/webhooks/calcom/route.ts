// F0296: Cal.com webhook handler
// F0298: Booking cancelled event
// F0299: Booking rescheduled event
// F0901: Cal.com webhook signature validation
// F1323: Use edge runtime for low latency
// Handle booking lifecycle events from Cal.com

// Changed to nodejs runtime due to crypto module requirement
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateCalcomWebhookSignature } from '@/lib/calcom-webhook-auth'

/**
 * POST /api/webhooks/calcom
 * F0296: Cal.com webhook endpoint
 * F0901: Signature validation for security
 *
 * Cal.com sends webhooks for events:
 * - BOOKING_CREATED
 * - BOOKING_RESCHEDULED (F0299)
 * - BOOKING_CANCELLED (F0298)
 */
export async function POST(request: NextRequest) {
  try {
    // F0901: Validate webhook signature
    const signature = request.headers.get('x-cal-signature') || request.headers.get('x-cal-signature-256')
    const rawBody = await request.text()

    const webhookSecret = process.env.CALCOM_WEBHOOK_SECRET

    // Only enforce signature validation if webhook secret is configured
    if (webhookSecret) {
      const isValid = validateCalcomWebhookSignature(rawBody, signature, webhookSecret)

      if (!isValid) {
        console.error('[Cal.com Webhook] Invalid signature')
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 403 }
        )
      }
    } else {
      console.warn('[Cal.com Webhook] Signature validation skipped - CALCOM_WEBHOOK_SECRET not set')
    }

    // Parse webhook payload
    const payload = JSON.parse(rawBody)

    const {
      triggerEvent,
      payload: eventData,
    } = payload

    console.log(`[Cal.com Webhook] Received: ${triggerEvent}`)

    // F0298: Handle BOOKING_CANCELLED event
    if (triggerEvent === 'BOOKING_CANCELLED') {
      await handleBookingCancelled(eventData)
      return NextResponse.json({ success: true, event: 'booking_cancelled' })
    }

    // F0299: Handle BOOKING_RESCHEDULED event
    if (triggerEvent === 'BOOKING_RESCHEDULED') {
      await handleBookingRescheduled(eventData)
      return NextResponse.json({ success: true, event: 'booking_rescheduled' })
    }

    // Handle BOOKING_CREATED event
    if (triggerEvent === 'BOOKING_CREATED') {
      await handleBookingCreated(eventData)
      return NextResponse.json({ success: true, event: 'booking_created' })
    }

    // Unknown event type - log but don't fail
    console.log(`[Cal.com Webhook] Unknown event: ${triggerEvent}`)
    return NextResponse.json({ success: true, event: 'unknown' })
  } catch (error: any) {
    console.error('[Cal.com Webhook] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * F0298: Handle booking cancelled
 * Mark booking as cancelled in Supabase
 */
async function handleBookingCancelled(eventData: any) {
  const bookingId = eventData.uid || String(eventData.id)

  console.log(`[Cal.com] Booking cancelled: ${bookingId}`)

  // Fetch current booking to get metadata
  const { data: currentBooking } = await supabaseAdmin
    .from('voice_agent_bookings')
    .select('metadata')
    .eq('booking_id', bookingId)
    .single();

  // Merge cancellation info into metadata
  const updatedMetadata = {
    ...(currentBooking?.metadata || {}),
    cancelled_at: new Date().toISOString(),
    cancelled_via: 'webhook',
    cancellation_reason: eventData.cancellationReason || 'Not specified'
  };

  // Update booking status in database
  const { error } = await supabaseAdmin
    .from('voice_agent_bookings')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
      metadata: updatedMetadata
    })
    .eq('booking_id', bookingId)

  if (error) {
    console.error('[Cal.com] Error updating cancelled booking:', error)
    throw error
  }

  console.log(`[Cal.com] Booking ${bookingId} marked as cancelled`)
}

/**
 * F0299: Handle booking rescheduled
 * Update booking start/end time in Supabase
 */
async function handleBookingRescheduled(eventData: any) {
  const bookingId = eventData.uid || String(eventData.id)
  const newStartTime = eventData.startTime
  const newEndTime = eventData.endTime

  console.log(`[Cal.com] Booking rescheduled: ${bookingId}`)
  console.log(`[Cal.com] New time: ${newStartTime}`)

  // Get current booking to preserve old time
  const { data: currentBooking } = await supabaseAdmin
    .from('voice_agent_bookings')
    .select('start_time, end_time, metadata')
    .eq('booking_id', bookingId)
    .single()

  // Merge reschedule info into metadata
  const updatedMetadata = {
    ...(currentBooking?.metadata || {}),
    rescheduled_at: new Date().toISOString(),
    rescheduled_via: 'webhook',
    previous_start_time: currentBooking?.start_time || '',
    previous_end_time: currentBooking?.end_time || ''
  };

  // Update booking with new time
  const { error } = await supabaseAdmin
    .from('voice_agent_bookings')
    .update({
      start_time: newStartTime,
      end_time: newEndTime,
      updated_at: new Date().toISOString(),
      metadata: updatedMetadata
    })
    .eq('booking_id', bookingId)

  if (error) {
    console.error('[Cal.com] Error updating rescheduled booking:', error)
    throw error
  }

  console.log(`[Cal.com] Booking ${bookingId} updated with new time`)
}

/**
 * Handle booking created (confirmations)
 */
async function handleBookingCreated(eventData: any) {
  const bookingId = eventData.uid || String(eventData.id)

  console.log(`[Cal.com] Booking created: ${bookingId}`)

  // Check if booking already exists in our database
  const { data: existing } = await supabaseAdmin
    .from('voice_agent_bookings')
    .select('id')
    .eq('booking_id', bookingId)
    .single()

  if (existing) {
    console.log(`[Cal.com] Booking ${bookingId} already exists, skipping`)
    return
  }

  // Extract attendee info
  const attendee = eventData.attendees?.[0] || {}

  // Insert booking record
  const { error } = await supabaseAdmin
    .from('voice_agent_bookings')
    .insert({
      booking_id: bookingId,
      event_type_id: String(eventData.eventTypeId),
      start_time: eventData.startTime,
      end_time: eventData.endTime,
      attendee_name: attendee.name,
      attendee_email: attendee.email,
      attendee_phone: eventData.responses?.phone || null,
      status: 'confirmed',
      metadata: {
        created_via: 'webhook',
        cal_booking_id: eventData.id,
      },
    })

  if (error) {
    console.error('[Cal.com] Error inserting booking:', error)
    // Don't throw - this is a non-critical operation
  }
}

// GET handler for webhook verification (if Cal.com requires it)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('challenge')

  if (challenge) {
    // Return challenge for verification
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({
    service: 'Cal.com webhook handler',
    status: 'active',
  })
}
