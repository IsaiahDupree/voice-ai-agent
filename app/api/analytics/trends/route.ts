import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0841: Call volume trend
 * F0842: Booking trend
 * F0832: Sentiment trend
 *
 * GET /api/analytics/trends - Time series trends
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const interval = searchParams.get('interval') || 'day'; // 'hour', 'day', 'week'

    // Get calls
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('started_at, sentiment, outcome')
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    if (callsError) throw callsError;

    // Get bookings
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (bookingsError) throw bookingsError;

    // Build time series
    const callVolume: Record<string, number> = {};
    const bookingVolume: Record<string, number> = {};
    const sentimentCounts: Record<string, { positive: number; neutral: number; negative: number }> = {};

    const formatDate = (date: Date): string => {
      if (interval === 'hour') {
        return date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      } else if (interval === 'day') {
        return date.toISOString().substring(0, 10); // YYYY-MM-DD
      } else {
        // week
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().substring(0, 10);
      }
    };

    // Process calls
    for (const call of calls || []) {
      const bucket = formatDate(new Date(call.started_at));

      callVolume[bucket] = (callVolume[bucket] || 0) + 1;

      if (!sentimentCounts[bucket]) {
        sentimentCounts[bucket] = { positive: 0, neutral: 0, negative: 0 };
      }

      if (call.sentiment === 'positive') sentimentCounts[bucket].positive++;
      else if (call.sentiment === 'negative') sentimentCounts[bucket].negative++;
      else sentimentCounts[bucket].neutral++;
    }

    // Process bookings
    for (const booking of bookings || []) {
      const bucket = formatDate(new Date(booking.created_at));
      bookingVolume[bucket] = (bookingVolume[bucket] || 0) + 1;
    }

    // Convert to sorted arrays
    const sortedDates = Array.from(
      new Set([...Object.keys(callVolume), ...Object.keys(bookingVolume)])
    ).sort();

    const callTrend = sortedDates.map((date) => ({
      date,
      count: callVolume[date] || 0,
    }));

    const bookingTrend = sortedDates.map((date) => ({
      date,
      count: bookingVolume[date] || 0,
    }));

    const sentimentTrend = sortedDates.map((date) => ({
      date,
      ...sentimentCounts[date] || { positive: 0, neutral: 0, negative: 0 },
    }));

    return NextResponse.json({
      call_volume_trend: callTrend,
      booking_trend: bookingTrend,
      sentiment_trend: sentimentTrend,
      interval,
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error calculating trends:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate trends' },
      { status: 500 }
    );
  }
}
