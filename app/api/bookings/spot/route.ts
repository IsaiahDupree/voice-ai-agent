// F0340: Spot booking - Book immediately available slot without prompting

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { calcomClient } from '@/lib/calcom';

export const dynamic = 'force-dynamic';

/**
 * F0340: Create a spot booking (immediate next available slot)
 * POST /api/bookings/spot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contact_id,
      event_type_id,
      duration_minutes = 30,
      title,
      notes,
      max_hours_ahead = 24, // Look only within next 24 hours for "spot"
    } = body;

    if (!contact_id || !event_type_id) {
      return NextResponse.json(
        { error: 'contact_id and event_type_id are required' },
        { status: 400 }
      );
    }

    // Fetch contact info
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Get next available slot from Cal.com
    const now = new Date();
    const maxTime = new Date(now.getTime() + max_hours_ahead * 60 * 60 * 1000);

    const calcomApiKey = process.env.CALCOM_API_KEY;
    const calcomDomain = process.env.CALCOM_DOMAIN || 'api.cal.com';

    if (!calcomApiKey) {
      return NextResponse.json(
        { error: 'Cal.com API not configured' },
        { status: 500 }
      );
    }

    // Fetch available slots
    const slotsResponse = await fetch(
      `https://${calcomDomain}/v1/slots?eventTypeId=${event_type_id}&startTime=${now.toISOString()}&endTime=${maxTime.toISOString()}`,
      {
        headers: {
          'Authorization': `Bearer ${calcomApiKey}`,
        },
      }
    );

    if (!slotsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch available slots from Cal.com' },
        { status: 500 }
      );
    }

    const slotsData = await slotsResponse.json();
    const slots = slotsData.slots || [];

    if (slots.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No available spots in the next ${max_hours_ahead} hours',
        message: 'Would you like to schedule for a later time?',
      }, { status: 404 });
    }

    // Take the first available slot
    const firstSlot = slots[0];
    const startTime = firstSlot.time;
    const endTime = new Date(new Date(startTime).getTime() + duration_minutes * 60 * 1000).toISOString();

    // Book the appointment via Cal.com
    const calcomBooking = await calcomClient.createBooking({
      eventTypeId: event_type_id,
      start: startTime,
      name: contact.full_name || contact.name,
      email: contact.email,
      phone: contact.phone_number,
      timeZone: contact.timezone || 'America/New_York',
      notes: notes || `Spot booking for ${contact.full_name}`,
    });

    // Store booking in database
    const { data: booking, error: dbError } = await supabaseAdmin
      .from('bookings')
      .insert({
        contact_id,
        title: title || `Spot Booking - ${contact.full_name}`,
        start_time: startTime,
        end_time: endTime,
        duration_minutes,
        status: 'confirmed',
        booking_type: 'spot',
        calcom_booking_id: calcomBooking.id,
        notes,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Format time for response
    const formattedTime = new Date(startTime).toLocaleString('en-US', {
      timeZone: contact.timezone || 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      calcom_booking_id: booking.id,
      start_time: startTime,
      end_time: endTime,
      formatted_time: formattedTime,
      slot_found_in_minutes: Math.round((new Date(startTime).getTime() - now.getTime()) / 60000),
      message: `Spot booking confirmed for ${formattedTime}`,
    });
  } catch (error: any) {
    console.error('Error creating spot booking:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create spot booking',
    }, { status: 500 });
  }
}
