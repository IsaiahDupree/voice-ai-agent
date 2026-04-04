// F0336: Max bookings per day - Enforce daily booking cap

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * F0336: Set max bookings per day for an assistant/event type
 * PUT /api/calendar/max-bookings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      assistant_id,
      event_type_id,
      max_bookings_per_day,
    } = body;

    if (!assistant_id && !event_type_id) {
      return NextResponse.json(
        { error: 'Either assistant_id or event_type_id is required' },
        { status: 400 }
      );
    }

    if (max_bookings_per_day === undefined || max_bookings_per_day < 0) {
      return NextResponse.json(
        { error: 'max_bookings_per_day must be >= 0' },
        { status: 400 }
      );
    }

    // Store or update max bookings setting
    const { data, error } = await supabaseAdmin
      .from('calendar_booking_limits')
      .upsert({
        assistant_id,
        event_type_id,
        max_bookings_per_day,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: assistant_id ? 'assistant_id' : 'event_type_id',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      limit: data,
      message: `Max bookings per day set to ${max_bookings_per_day}`,
    });
  } catch (error: any) {
    console.error('Error setting max bookings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set max bookings' },
      { status: 500 }
    );
  }
}

/**
 * F0336: Check if booking limit reached for a given day
 * GET /api/calendar/max-bookings?date=YYYY-MM-DD&assistant_id=X
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const assistantId = searchParams.get('assistant_id');
    const eventTypeId = searchParams.get('event_type_id');

    if (!assistantId && !eventTypeId) {
      return NextResponse.json(
        { error: 'Either assistant_id or event_type_id is required' },
        { status: 400 }
      );
    }

    // Get the booking limit
    let limitQuery = supabaseAdmin
      .from('calendar_booking_limits')
      .select('max_bookings_per_day');

    if (assistantId) {
      limitQuery = limitQuery.eq('assistant_id', assistantId);
    } else if (eventTypeId) {
      limitQuery = limitQuery.eq('event_type_id', eventTypeId);
    }

    const { data: limitData, error: limitError } = await limitQuery.single();

    if (limitError || !limitData) {
      // No limit set
      return NextResponse.json({
        success: true,
        date,
        has_limit: false,
        bookings_today: 0,
        limit_reached: false,
        message: 'No booking limit configured',
      });
    }

    const maxBookings = limitData.max_bookings_per_day;

    // Count bookings for this day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    let bookingsQuery = supabaseAdmin
      .from('bookings')
      .select('id')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .neq('status', 'canceled');

    // Filter by assistant or event type via call
    if (assistantId) {
      // Need to join through calls to get assistant_id
      const { data: calls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('id')
        .eq('vapi_assistant_id', assistantId);

      const callIds = calls?.map((c: any) => c.id) || [];

      if (callIds.length > 0) {
        bookingsQuery = bookingsQuery.in('call_id', callIds);
      } else {
        // No calls with this assistant, so 0 bookings
        return NextResponse.json({
          success: true,
          date,
          has_limit: true,
          max_bookings_per_day: maxBookings,
          bookings_today: 0,
          remaining: maxBookings,
          limit_reached: false,
        });
      }
    }

    const { count, error: countError } = await bookingsQuery;

    if (countError) throw countError;

    const bookingsToday = count || 0;
    const limitReached = bookingsToday >= maxBookings;
    const remaining = Math.max(0, maxBookings - bookingsToday);

    return NextResponse.json({
      success: true,
      date,
      has_limit: true,
      max_bookings_per_day: maxBookings,
      bookings_today: bookingsToday,
      remaining,
      limit_reached: limitReached,
      message: limitReached
        ? 'Booking limit reached for today'
        : `${remaining} booking slots remaining today`,
    });
  } catch (error: any) {
    console.error('Error checking booking limit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check booking limit' },
      { status: 500 }
    );
  }
}
