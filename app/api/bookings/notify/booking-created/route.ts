// F0323: Booking created notification - Send notification when booking is created

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';

export const dynamic = 'force-dynamic';

/**
 * F0323: Send booking created notification to contact
 * POST /api/bookings/notify/booking-created
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking_id, channel = 'sms' } = body;

    if (!booking_id) {
      return NextResponse.json(
        { error: 'booking_id is required' },
        { status: 400 }
      );
    }

    // Fetch booking details with contact info
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        contact:voice_agent_contacts(
          id,
          full_name,
          phone_number,
          email,
          timezone
        ),
        call:voice_agent_calls(
          id,
          persona:voice_agent_personas(
            name
          )
        )
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const contact = booking.contact;
    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found for booking' },
        { status: 404 }
      );
    }

    // Format booking time in contact's timezone
    const startTime = new Date(booking.start_time);
    const formattedTime = startTime.toLocaleString('en-US', {
      timeZone: contact.timezone || 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Prepare notification message
    const agentName = booking.call?.persona?.name || 'Voice Agent';
    const message = `Hi ${contact.full_name || 'there'}! Your appointment has been confirmed for ${formattedTime}. ${booking.title ? `Meeting: ${booking.title}. ` : ''}${booking.location ? `Location: ${booking.location}. ` : ''}We look forward to meeting with you!`;

    let notificationResult: any = {};

    // Send via requested channel
    if (channel === 'sms' && contact.phone_number) {
      const smsResult = await sendSMS({
        to: contact.phone_number,
        body: message,
      });
      notificationResult.sms = smsResult;
    }

    // Could add email channel here
    if (channel === 'email' && contact.email) {
      // Placeholder for email notification
      notificationResult.email = {
        success: false,
        message: 'Email notifications not yet implemented',
      };
    }

    // Log notification
    await supabaseAdmin.from('booking_notifications').insert({
      booking_id,
      contact_id: contact.id,
      notification_type: 'booking_created',
      channel,
      message,
      sent_at: new Date().toISOString(),
      status: notificationResult.sms?.success ? 'sent' : 'failed',
    });

    return NextResponse.json({
      success: true,
      booking_id,
      notification_sent: notificationResult,
      message: 'Booking created notification sent',
    });
  } catch (error: any) {
    console.error('Error sending booking created notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
