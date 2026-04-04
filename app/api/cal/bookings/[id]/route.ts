// F0284: Get booking by ID
// F0286: Cancel booking
// Booking detail and cancellation API

import { NextRequest, NextResponse } from 'next/server';
import { calcomClient } from '@/lib/calcom';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/cal/bookings/:id
 * F0284: Get booking by ID - returns booking detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Try to fetch from Cal.com
    const booking = await calcomClient.getBooking(params.id);

    // Also fetch from our database for additional metadata
    const { data: localBooking } = await supabaseAdmin
      .from('voice_agent_bookings')
      .select('*')
      .eq('booking_id', params.id)
      .single();

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        local_metadata: localBooking?.metadata || {}
      }
    });
  } catch (error: any) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch booking' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    );
  }
}

/**
 * DELETE /api/cal/bookings/:id
 * F0286: Cancel booking
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Fetch current booking to get metadata
    const { data: currentBooking } = await supabaseAdmin
      .from('voice_agent_bookings')
      .select('metadata')
      .eq('booking_id', params.id)
      .single();

    // Cancel in Cal.com
    await calcomClient.cancelBooking(params.id, reason);

    // Merge cancellation info into metadata
    const updatedMetadata = {
      ...(currentBooking?.metadata || {}),
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason || 'Customer requested'
    };

    // Update in our database
    const { error: dbError } = await supabaseAdmin
      .from('voice_agent_bookings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        metadata: updatedMetadata
      })
      .eq('booking_id', params.id);

    if (dbError) {
      console.error('Error updating booking status:', dbError);
    }

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking_id: params.id
    });
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}
