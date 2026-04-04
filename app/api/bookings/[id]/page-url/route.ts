// F0321: Booking page URL - Get Cal.com booking page URL

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * F0321: Get Cal.com booking page URL for an event type
 * GET /api/bookings/:id/page-url
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const eventTypeId = searchParams.get('event_type_id');
    const username = searchParams.get('username') || process.env.CALCOM_USERNAME;

    if (!username) {
      return NextResponse.json(
        { error: 'Cal.com username is required' },
        { status: 400 }
      );
    }

    // Base Cal.com booking page URL
    const calcomDomain = process.env.CALCOM_DOMAIN || 'cal.com';

    // If event type ID is provided, generate specific booking URL
    if (eventTypeId) {
      const bookingUrl = `https://${calcomDomain}/${username}/${eventTypeId}`;

      // Add pre-fill parameters if available
      const prefillParams = new URLSearchParams();

      const name = searchParams.get('name');
      const email = searchParams.get('email');
      const notes = searchParams.get('notes');
      const date = searchParams.get('date'); // YYYY-MM-DD format

      if (name) prefillParams.append('name', name);
      if (email) prefillParams.append('email', email);
      if (notes) prefillParams.append('notes', notes);
      if (date) prefillParams.append('date', date);

      const queryString = prefillParams.toString();
      const fullUrl = queryString ? `${bookingUrl}?${queryString}` : bookingUrl;

      return NextResponse.json({
        success: true,
        booking_page_url: fullUrl,
        cal_user: username,
        event_type_id: eventTypeId,
        prefill_params: Object.fromEntries(prefillParams),
      });
    }

    // If no event type specified, return user's main booking page
    const mainBookingUrl = `https://${calcomDomain}/${username}`;

    return NextResponse.json({
      success: true,
      booking_page_url: mainBookingUrl,
      cal_user: username,
      message: 'Provide event_type_id for specific event booking page',
    });
  } catch (error: any) {
    console.error('Error generating booking page URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate booking page URL' },
      { status: 500 }
    );
  }
}

/**
 * F0321: Get booking page URL from existing booking
 * Retrieves the Cal.com booking page link for rescheduling
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch booking
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Get reschedule URL if Cal.com booking ID exists
    if (booking.calcom_booking_id) {
      const calcomDomain = process.env.CALCOM_DOMAIN || 'cal.com';
      const rescheduleUrl = `https://${calcomDomain}/reschedule/${booking.calcom_booking_id}`;

      return NextResponse.json({
        success: true,
        booking_id: booking.id,
        reschedule_url: rescheduleUrl,
        calcom_booking_id: booking.calcom_booking_id,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'No Cal.com booking ID found for this booking',
    }, { status: 404 });
  } catch (error: any) {
    console.error('Error getting reschedule URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get reschedule URL' },
      { status: 500 }
    );
  }
}
