// F0288: Reschedule booking
// F0289: Reschedule email (Cal.com sends automatically)
// Booking reschedule API

import { NextRequest, NextResponse } from 'next/server';
import { calcomClient } from '@/lib/calcom';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * PATCH /api/cal/bookings/:id/reschedule
 * F0288: Reschedule booking with new startTime
 * F0289: Cal.com sends reschedule confirmation email automatically
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { newStart, startTime } = body;

    const newStartTime = newStart || startTime;

    if (!newStartTime) {
      return NextResponse.json(
        { error: 'newStart or startTime parameter is required' },
        { status: 400 }
      );
    }

    // Validate date format
    const startDate = new Date(newStartTime);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for newStart' },
        { status: 400 }
      );
    }

    // Fetch current booking to get metadata and start_time
    const { data: currentBooking } = await supabaseAdmin
      .from('voice_agent_bookings')
      .select('metadata, start_time')
      .eq('booking_id', params.id)
      .single();

    // Reschedule in Cal.com
    const updatedBooking = await calcomClient.rescheduleBooking(
      params.id,
      newStartTime
    );

    // Merge reschedule info into metadata
    const updatedMetadata = {
      ...(currentBooking?.metadata || {}),
      rescheduled_at: new Date().toISOString(),
      previous_start_time: currentBooking?.start_time
    };

    // Update in our database
    const { error: dbError } = await supabaseAdmin
      .from('voice_agent_bookings')
      .update({
        start_time: newStartTime,
        end_time: updatedBooking.endTime,
        updated_at: new Date().toISOString(),
        metadata: updatedMetadata
      })
      .eq('booking_id', params.id);

    if (dbError) {
      console.error('Error updating booking in database:', dbError);
    }

    // F0289: Cal.com automatically sends reschedule confirmation email
    return NextResponse.json({
      success: true,
      message: 'Booking rescheduled successfully. Confirmation email sent by Cal.com.',
      booking: {
        id: updatedBooking.id,
        uid: updatedBooking.uid,
        startTime: updatedBooking.startTime,
        endTime: updatedBooking.endTime,
        status: updatedBooking.status
      }
    });
  } catch (error: any) {
    console.error('Error rescheduling booking:', error);

    // Handle conflict errors
    if (error.message?.includes('BOOKING_CONFLICT') || error.message?.includes('conflict')) {
      return NextResponse.json(
        {
          error: 'The selected time slot is no longer available',
          errorCode: 'BOOKING_CONFLICT'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to reschedule booking' },
      { status: 500 }
    );
  }
}
