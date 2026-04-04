// F0958 & F0418: POST /api/tools/bookAppointment - Executes bookAppointment tool with custom location support

import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'
import { supabaseAdmin } from '@/lib/supabase'
import { parseNaturalDate } from '@/lib/date-parser'
import { withTelemetry } from '@/lib/tool-telemetry'

export async function POST(request: NextRequest) {
  const body = await request.json()

  return withTelemetry('bookAppointment', body.callId, body, async () => {
    const {
      date,
      time,
      name,
      email,
      phone,
      eventTypeId,
      timezone = 'America/New_York',
      notes,
      location, // F0418: Custom location support
    } = body

    // Validate required fields
    if (!date || !time) {
      return NextResponse.json(
        { error: 'Date and time are required' },
        { status: 400 }
      )
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // Parse natural language date and time to ISO8601
    let startTime: string
    try {
      const dateStr = typeof date === 'string' ? date : date.toString()
      const timeStr = typeof time === 'string' ? time : time.toString()
      const dateTimeStr = `${dateStr} ${timeStr}`
      startTime = parseNaturalDate(dateTimeStr, timezone)
    } catch (parseError: any) {
      return NextResponse.json(
        { error: `Failed to parse date/time: ${parseError.message}` },
        { status: 400 }
      )
    }

    // Create booking via Cal.com
    let booking
    try {
      booking = await calcomClient.createBooking({
        eventTypeId: eventTypeId || 1,
        start: startTime,
        name,
        email,
        phone,
        notes: notes || '',
        timeZone: timezone,
        location: location || undefined, // F0418: Pass custom location to Cal.com
      })
    } catch (calcomError: any) {
      console.error('Cal.com booking error:', calcomError)
      return NextResponse.json(
        { error: `Failed to create booking: ${calcomError.message}` },
        { status: 500 }
      )
    }

    // Store booking in Supabase
    const { data: dbBooking, error: dbError } = await supabaseAdmin
      .from('voice_agent_bookings')
      .insert({
        call_id: body.call_id || null,
        contact_id: body.contact_id || null,
        calcom_booking_id: booking.id,
        name,
        email,
        phone_number: phone || null,
        scheduled_at: startTime,
        timezone,
        status: 'scheduled',
        confirmation_sent: false,
        notes,
        location: location || null, // F0418: Store custom location
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error storing booking:', dbError)
      // Don't fail the request - booking was created in Cal.com
    }

    const locationMessage = location ? ` The meeting will be at: ${location}.` : ''
    const response = {
      success: true,
      booking: {
        id: booking.id,
        dbId: dbBooking?.id,
        name,
        email,
        phone,
        start: startTime,
        startFormatted: new Date(startTime).toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: timezone,
        }),
        timezone,
        location: location || null, // F0418: Include location in response
        status: 'scheduled',
      },
      message: `Great! I've booked your appointment for ${new Date(startTime).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone,
      })}.${locationMessage} You'll receive a confirmation email at ${email}.`,
    }

    return NextResponse.json(response, { status: 201 })
  })
}
