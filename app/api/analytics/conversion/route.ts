import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0846: Contact conversion rate
 * F0848: First call conversion
 * F004: Graceful fallback for /api/analytics/conversion (missing contact_id column)
 *
 * GET /api/analytics/conversion - Conversion metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();

    // Get all calls
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, contact_id, started_at, outcome')
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    // F004: Graceful fallback for missing column
    if (callsError?.message?.includes('does not exist') || callsError?.message?.includes('contact_id')) {
      console.warn('[Analytics Conversion] Schema error detected, returning graceful fallback:', callsError);
      return NextResponse.json({
        overall: { total_calls: 0, total_bookings: 0, conversion_rate: 0 },
        contact_level: { unique_contacts: 0, contacts_who_booked: 0, conversion_rate: 0 },
        first_call: { first_calls: 0, first_call_bookings: 0, conversion_rate: 0 },
        date_range: { start: startDate, end: endDate }
      }, { status: 200 });
    }

    if (callsError) throw callsError;

    // Get bookings
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, call_id, contact_id')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (bookingsError) throw bookingsError;

    // Calculate overall conversion rate
    const totalCalls = calls?.length || 0;
    const totalBookings = bookings?.length || 0;
    const overallConversionRate = totalCalls > 0 ? (totalBookings / totalCalls) * 100 : 0;

    // Calculate contact-level conversion (unique contacts who booked)
    const uniqueContacts = new Set(calls?.map((c) => c.contact_id).filter(Boolean));
    const contactsWhoBooked = new Set(bookings?.map((b) => b.contact_id).filter(Boolean));
    const contactConversionRate = uniqueContacts.size > 0
      ? (contactsWhoBooked.size / uniqueContacts.size) * 100
      : 0;

    // Calculate first call conversion
    const firstCallsByContact: Record<string, string> = {};

    for (const call of calls || []) {
      if (!call.contact_id) continue;

      if (
        !firstCallsByContact[call.contact_id] ||
        call.started_at < firstCallsByContact[call.contact_id]
      ) {
        firstCallsByContact[call.contact_id] = call.call_id;
      }
    }

    const firstCallIds = new Set(Object.values(firstCallsByContact));
    const firstCallBookings = bookings?.filter((b) => firstCallIds.has(b.call_id));
    const firstCallConversionRate = firstCallIds.size > 0
      ? ((firstCallBookings?.length || 0) / firstCallIds.size) * 100
      : 0;

    return NextResponse.json({
      overall: {
        total_calls: totalCalls,
        total_bookings: totalBookings,
        conversion_rate: parseFloat(overallConversionRate.toFixed(2)),
      },
      contact_level: {
        unique_contacts: uniqueContacts.size,
        contacts_who_booked: contactsWhoBooked.size,
        conversion_rate: parseFloat(contactConversionRate.toFixed(2)),
      },
      first_call: {
        first_calls: firstCallIds.size,
        first_call_bookings: firstCallBookings?.length || 0,
        conversion_rate: parseFloat(firstCallConversionRate.toFixed(2)),
      },
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    // F004: Graceful fallback for schema-related errors
    if (error?.message?.includes('does not exist') || error?.message?.includes('column')) {
      const startDate = new URL(error?.request?.url || '').searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new URL(error?.request?.url || '').searchParams.get('end_date') || new Date().toISOString();
      console.warn('[Analytics Conversion] Schema error caught in try/catch:', error);
      return NextResponse.json({
        overall: { total_calls: 0, total_bookings: 0, conversion_rate: 0 },
        contact_level: { unique_contacts: 0, contacts_who_booked: 0, conversion_rate: 0 },
        first_call: { first_calls: 0, first_call_bookings: 0, conversion_rate: 0 },
        date_range: { start: startDate, end: endDate }
      }, { status: 200 });
    }

    console.error('Error calculating conversion:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate conversion' },
      { status: 500 }
    );
  }
}
