import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0336: POST /api/cal/max-bookings - Enforce daily booking cap
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      eventTypeId,
      date,
      maxBookingsPerDay,
    } = body

    if (!eventTypeId || !date || maxBookingsPerDay === undefined) {
      return NextResponse.json(
        { error: 'eventTypeId, date, and maxBookingsPerDay are required' },
        { status: 400 }
      )
    }

    // Store the daily booking limit configuration
    const { data: config, error: configError } = await supabaseAdmin
      .from('calcom_booking_limits')
      .upsert({
        event_type_id: String(eventTypeId),
        date: date,
        max_bookings_per_day: maxBookingsPerDay,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'event_type_id,date'
      })
      .select()
      .single()

    if (configError) {
      throw configError
    }

    return NextResponse.json({
      success: true,
      message: `Daily booking limit set to ${maxBookingsPerDay} for ${date}`,
      config,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error setting booking limit:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to set booking limit' },
      { status: 500 }
    )
  }
}

// F0336: GET /api/cal/max-bookings - Check current bookings against daily limit
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventTypeId = searchParams.get('eventTypeId')
    const date = searchParams.get('date')

    if (!eventTypeId || !date) {
      return NextResponse.json(
        { error: 'eventTypeId and date are required' },
        { status: 400 }
      )
    }

    // Get the configured limit
    const { data: config, error: configError } = await supabaseAdmin
      .from('calcom_booking_limits')
      .select('*')
      .eq('event_type_id', String(eventTypeId))
      .eq('date', date)
      .single()

    if (configError && configError.code !== 'PGRST116') {
      throw configError
    }

    const maxBookingsPerDay = config?.max_bookings_per_day || 999 // Default no limit

    // Count existing bookings for this date and event type
    const { data: bookings, error: bookingsError, count } = await supabaseAdmin
      .from('voice_agent_bookings')
      .select('*', { count: 'exact', head: false })
      .eq('event_type_id', String(eventTypeId))
      .gte('start_time', `${date}T00:00:00`)
      .lt('start_time', `${date}T23:59:59`)

    if (bookingsError) {
      throw bookingsError
    }

    const currentBookingCount = count || 0
    const spotsRemaining = Math.max(0, maxBookingsPerDay - currentBookingCount)
    const isFull = currentBookingCount >= maxBookingsPerDay

    return NextResponse.json({
      success: true,
      eventTypeId: parseInt(eventTypeId),
      date,
      max_bookings_per_day: maxBookingsPerDay,
      current_bookings: currentBookingCount,
      spots_remaining: spotsRemaining,
      is_full: isFull,
    })
  } catch (error: any) {
    console.error('Error checking booking limit:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check booking limit' },
      { status: 500 }
    )
  }
}
