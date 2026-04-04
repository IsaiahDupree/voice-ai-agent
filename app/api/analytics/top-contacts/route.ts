import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0864: Top performing contacts
 *
 * GET /api/analytics/top-contacts - Contacts generating most bookings/revenue
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get bookings with contact info
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, contact_id, revenue_usd')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('contact_id', 'is', null);

    if (bookingsError) throw bookingsError;

    // Aggregate by contact
    const contactStats: Record<string, { bookings: number; revenue: number }> = {};

    for (const booking of bookings || []) {
      if (!contactStats[booking.contact_id]) {
        contactStats[booking.contact_id] = { bookings: 0, revenue: 0 };
      }
      contactStats[booking.contact_id].bookings++;
      contactStats[booking.contact_id].revenue += Number(booking.revenue_usd) || 0;
    }

    // Get contact details
    const contactIds = Object.keys(contactStats);
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, name, email, phone, company')
      .in('id', contactIds);

    if (contactsError) throw contactsError;

    // Build top contacts list
    const topContacts = contactIds
      .map((id) => {
        const contact = contacts?.find((c) => c.id === id);
        const stats = contactStats[id];

        return {
          contact_id: id,
          name: contact?.name || 'Unknown',
          email: contact?.email,
          phone: contact?.phone,
          company: contact?.company,
          total_bookings: stats.bookings,
          total_revenue_usd: parseFloat(stats.revenue.toFixed(2)),
        };
      })
      .sort((a, b) => b.total_revenue_usd - a.total_revenue_usd)
      .slice(0, limit);

    return NextResponse.json({
      top_contacts: topContacts,
      total_contacts: contactIds.length,
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error fetching top contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch top contacts' },
      { status: 500 }
    );
  }
}
