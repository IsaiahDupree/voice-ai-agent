// F0342: Pre-meeting reminder - Schedule reminder SMS before meeting

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';

export const dynamic = 'force-dynamic';

/**
 * F0342: Schedule a pre-meeting reminder
 * POST /api/bookings/:id/reminder
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      minutes_before = 60, // Default 1 hour before
      channel = 'sms',
      custom_message
    } = body;

    // Fetch booking with contact info
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
        )
      `)
      .eq('id', params.id)
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

    // Calculate reminder send time
    const startTime = new Date(booking.start_time);
    const reminderTime = new Date(startTime.getTime() - minutes_before * 60 * 1000);

    // Check if reminder time is in the future
    if (reminderTime <= new Date()) {
      return NextResponse.json(
        { error: 'Reminder time must be in the future' },
        { status: 400 }
      );
    }

    // Format booking time in contact's timezone
    const formattedTime = startTime.toLocaleString('en-US', {
      timeZone: contact.timezone || 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Prepare reminder message
    const defaultMessage = `Reminder: You have an appointment scheduled for ${formattedTime}. ${booking.title ? `Meeting: ${booking.title}. ` : ''}${booking.location ? `Location: ${booking.location}. ` : ''}See you soon!`;
    const message = custom_message || defaultMessage;

    // Store reminder in database
    const { data: reminder, error: reminderError } = await supabaseAdmin
      .from('booking_reminders')
      .insert({
        booking_id: booking.id,
        contact_id: contact.id,
        reminder_type: 'pre_meeting',
        channel,
        scheduled_for: reminderTime.toISOString(),
        minutes_before,
        message,
        status: 'scheduled',
      })
      .select()
      .single();

    if (reminderError) throw reminderError;

    // If reminder is within the next 5 minutes, send immediately
    const timeUntilReminder = reminderTime.getTime() - Date.now();
    if (timeUntilReminder < 5 * 60 * 1000 && channel === 'sms' && contact.phone_number) {
      // Send SMS now
      const smsResult = await sendSMS({
        to: contact.phone_number,
        body: message,
      });

      // Update reminder status
      await supabaseAdmin
        .from('booking_reminders')
        .update({
          status: smsResult.success ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
        })
        .eq('id', reminder.id);

      return NextResponse.json({
        success: true,
        reminder_id: reminder.id,
        sent_immediately: true,
        sms_result: smsResult,
        message: 'Reminder sent immediately (scheduled for <5 minutes)',
      });
    }

    // Otherwise, scheduled for later processing
    return NextResponse.json({
      success: true,
      reminder_id: reminder.id,
      scheduled_for: reminderTime.toISOString(),
      minutes_before,
      message: 'Reminder scheduled successfully',
      note: 'Reminder will be sent by background job at scheduled time',
    });
  } catch (error: any) {
    console.error('Error scheduling reminder:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule reminder' },
      { status: 500 }
    );
  }
}

/**
 * F0342: Get reminder status
 * GET /api/bookings/:id/reminder
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch all reminders for this booking
    const { data: reminders, error } = await supabaseAdmin
      .from('booking_reminders')
      .select('*')
      .eq('booking_id', params.id)
      .order('scheduled_for', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      booking_id: params.id,
      reminders: reminders || [],
      total_reminders: reminders?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reminders' },
      { status: 500 }
    );
  }
}

/**
 * F0342: Cancel a reminder
 * DELETE /api/bookings/:id/reminder
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const reminderId = searchParams.get('reminder_id');

    if (!reminderId) {
      return NextResponse.json(
        { error: 'reminder_id query parameter is required' },
        { status: 400 }
      );
    }

    // Update reminder status to canceled
    const { data, error } = await supabaseAdmin
      .from('booking_reminders')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      })
      .eq('id', reminderId)
      .eq('booking_id', params.id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Reminder not found or already canceled' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      reminder_id: data.id,
      message: 'Reminder canceled successfully',
    });
  } catch (error: any) {
    console.error('Error canceling reminder:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel reminder' },
      { status: 500 }
    );
  }
}
