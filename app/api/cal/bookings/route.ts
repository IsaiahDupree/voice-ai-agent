import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'
import { supabaseAdmin } from '@/lib/supabase'
import { validateBookingTime, isPastBooking } from '@/lib/booking-validation'
import { validateNotHoliday } from '@/lib/holiday-exclusions'

// F0278: Book appointment
// F0279: Booking required fields - name, email, startTime, eventTypeId
// F0283: Booking confirmation SMS - Trigger Twilio SMS after booking
// F0290: Conflict check
// F0291: Conflict error message

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      eventTypeId,
      start,
      name,
      email,
      phone,
      notes,
      timeZone,
      metadata,
      callId, // Optional: link booking to a call
    } = body

    // F0279: Validate required fields
    if (!eventTypeId || !start || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: eventTypeId, start, name, email' },
        { status: 400 }
      )
    }

    // Check if booking is in the past
    if (isPastBooking(start)) {
      return NextResponse.json(
        { error: 'Cannot book appointments in the past' },
        { status: 400 }
      )
    }

    // F0294/F0295: Validate minimum and maximum notice requirements
    const validationResult = validateBookingTime(start, {
      minimumNoticeHours: 2, // F0294: 2 hour minimum
      maximumNoticeDays: 90 // F0295: 90 day maximum
    })

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: 'Booking time validation failed',
          errors: validationResult.errors
        },
        { status: 400 }
      )
    }

    // F0326: Validate booking is not on a holiday
    const holidayValidation = validateNotHoliday(start)
    if (!holidayValidation.valid) {
      return NextResponse.json(
        { error: holidayValidation.error },
        { status: 400 }
      )
    }

    // F0301: Booking in call - must complete in < 5s
    const bookingStartTime = Date.now()

    try {
      // F0290: Conflict check - handled by Cal.com API
      // F0343: Pass contactId and callId to Cal.com metadata
      const booking = await calcomClient.createBooking({
        eventTypeId: parseInt(eventTypeId),
        start,
        name,
        email,
        phone,
        notes,
        timeZone,
        metadata,
        contactId: callId, // Link to contact if available
        callId, // F0343: Store call_id in Cal.com metadata
      })

      const bookingDuration = Date.now() - bookingStartTime
      console.log(`Booking created in ${bookingDuration}ms`) // F0301: Check < 5000ms

      // F0338: Calculate meeting duration from Cal.com booking times
      const meetingDuration = booking.endTime && booking.startTime
        ? new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()
        : null

      // Save booking to our database - F0297: Booking created event
      const { data: bookingRecord, error: dbError } = await supabaseAdmin
        .from('voice_agent_bookings')
        .insert({
          booking_id: booking.uid || String(booking.id),
          call_id: callId || null,
          event_type_id: String(eventTypeId),
          start_time: start,
          end_time: booking.endTime,
          attendee_name: name,
          attendee_email: email,
          attendee_phone: phone,
          status: 'confirmed',
          metadata: {
            ...metadata,
            booking_duration_ms: bookingDuration,
            meeting_duration_ms: meetingDuration, // F0338: Meeting duration in transcript
            meeting_duration_minutes: meetingDuration ? Math.round(meetingDuration / 60000) : null,
            cal_booking_id: booking.id,
          },
        })
        .select()
        .single()

      if (dbError) {
        console.error('Error saving booking to database:', dbError)
      }

      // F0283: Trigger SMS confirmation (handled separately by webhook/function)
      // F0282: Email confirmation is sent automatically by Cal.com

      // F0318: Send booking confirmation SMS with link
      // F0341: Include booking ID in SMS
      if (phone) {
        try {
          const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/${booking.uid}`

          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sms/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: phone,
              template: 'booking_confirmation',
              templateVars: {
                name: name.split(' ')[0], // First name
                time: new Date(start).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: timeZone || 'America/New_York'
                }),
                date: new Date(start).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  timeZone: timeZone || 'America/New_York'
                }),
                booking_url: bookingUrl,
                booking_id: booking.uid || String(booking.id) // F0341
              }
            })
          })

          console.log(`Booking confirmation SMS sent to ${phone}`)
        } catch (smsError) {
          console.error('Failed to send booking confirmation SMS:', smsError)
          // Don't fail the booking if SMS fails
        }
      }

      // F0302: Return booking details for agent to read back
      return NextResponse.json(
        {
          success: true,
          booking: {
            id: booking.id,
            uid: booking.uid,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: booking.status,
          },
          bookingDurationMs: bookingDuration,
          message: 'Booking confirmed successfully',
        },
        { status: 201 }
      )
    } catch (bookingError: any) {
      // F0291: Conflict error message - provide alternative slots
      if (bookingError.message?.includes('BOOKING_CONFLICT')) {
        // Fetch alternative slots
        const dateStr = new Date(start).toISOString().split('T')[0]
        let alternativeSlots: any[] = []

        try {
          alternativeSlots = await calcomClient.getAvailability(parseInt(eventTypeId), dateStr)
          // Get next 2 available slots after the requested time
          alternativeSlots = alternativeSlots
            .filter((slot) => new Date(slot.time) > new Date(start))
            .slice(0, 2)
        } catch (e) {
          console.error('Error fetching alternative slots:', e)
        }

        return NextResponse.json(
          {
            error: 'The selected time slot is no longer available',
            errorCode: 'BOOKING_CONFLICT',
            alternativeSlots: alternativeSlots.map((s) => s.time),
          },
          { status: 409 }
        )
      }

      throw bookingError
    }
  } catch (error: any) {
    console.error('Error creating booking:', error)

    // F0335: Booking fallback - if Cal.com unavailable, offer email alternative
    const isCalcomUnavailable =
      error.message?.includes('Cal.com unreachable') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('timeout') ||
      error.code === 'ECONNREFUSED'

    if (isCalcomUnavailable) {
      // Suggest email fallback
      return NextResponse.json(
        {
          error: 'Booking system temporarily unavailable',
          fallback: {
            type: 'email',
            message:
              'Our booking system is currently offline. Please email us at bookings@example.com or call us to schedule your appointment.',
            contactEmail: process.env.FALLBACK_BOOKING_EMAIL || 'bookings@example.com',
            contactPhone: process.env.FALLBACK_BOOKING_PHONE || null,
          },
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}

// Get bookings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const callId = searchParams.get('callId')

    let query = supabaseAdmin
      .from('voice_agent_bookings')
      .select('*')
      .order('created_at', { ascending: false })

    if (callId) {
      query = query.eq('call_id', callId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      bookings: data || [],
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}
