import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0847: Repeat caller rate
 * F0849: Avg bookings per contact
 *
 * GET /api/analytics/repeat-callers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();

    // Get calls
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, contact_id')
      .gte('started_at', startDate)
      .lte('started_at', endDate)
      .not('contact_id', 'is', null);

    if (callsError) throw callsError;

    // Get bookings
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, contact_id')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('contact_id', 'is', null);

    if (bookingsError) throw bookingsError;

    // Count calls per contact
    const callsPerContact: Record<string, number> = {};
    for (const call of calls || []) {
      callsPerContact[call.contact_id] = (callsPerContact[call.contact_id] || 0) + 1;
    }

    // Count bookings per contact
    const bookingsPerContact: Record<string, number> = {};
    for (const booking of bookings || []) {
      bookingsPerContact[booking.contact_id] = (bookingsPerContact[booking.contact_id] || 0) + 1;
    }

    const uniqueContacts = Object.keys(callsPerContact).length;
    const repeatCallers = Object.values(callsPerContact).filter((count) => count > 1).length;
    const repeatCallerRate = uniqueContacts > 0 ? (repeatCallers / uniqueContacts) * 100 : 0;

    const totalBookings = Object.values(bookingsPerContact).reduce((sum, count) => sum + count, 0);
    const avgBookingsPerContact = uniqueContacts > 0 ? totalBookings / uniqueContacts : 0;

    // Get top repeat callers
    const topCallers = Object.entries(callsPerContact)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([contactId, callCount]) => ({
        contact_id: contactId,
        call_count: callCount,
        booking_count: bookingsPerContact[contactId] || 0,
      }));

    return NextResponse.json({
      unique_contacts: uniqueContacts,
      repeat_callers: repeatCallers,
      repeat_caller_rate: parseFloat(repeatCallerRate.toFixed(2)),
      avg_calls_per_contact: parseFloat((calls?.length || 0 / uniqueContacts).toFixed(2)),
      avg_bookings_per_contact: parseFloat(avgBookingsPerContact.toFixed(2)),
      top_repeat_callers: topCallers,
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error calculating repeat callers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate repeat callers' },
      { status: 500 }
    );
  }
}
