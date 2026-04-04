import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0150: Queue abandonment rate analytics
 * GET /api/analytics/abandonment-rate
 *
 * Tracks percentage of callers who hang up while waiting in queue
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const threshold = parseInt(searchParams.get('threshold') || '30'); // seconds before abandonment

    // Get all calls in date range
    const { data: calls, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, started_at, ended_at, end_reason, duration_seconds, metadata')
      .eq('direction', 'inbound')
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    if (error) throw error;

    if (!calls || calls.length === 0) {
      return NextResponse.json({
        abandonment_rate: 0,
        total_calls: 0,
        abandoned_calls: 0,
        completed_calls: 0,
        avg_abandonment_time: 0,
        date_range: { start: startDate, end: endDate },
      });
    }

    // Identify abandoned calls
    const abandonedCalls = calls.filter((call) => {
      // Call is abandoned if:
      // 1. Ended with 'abandoned' or 'hung-up' reason
      // 2. Duration is below threshold (caller didn't wait)
      // 3. No transcript or minimal conversation

      const isAbandonedReason = [
        'abandoned',
        'hung-up',
        'no-answer',
        'customer-hangup',
      ].includes(call.end_reason);

      const isBelowThreshold =
        call.duration_seconds && call.duration_seconds < threshold;

      const wasMarkedAbandoned = call.metadata?.is_abandoned === true;

      return isAbandonedReason || isBelowThreshold || wasMarkedAbandoned;
    });

    // Calculate average abandonment time
    const abandonmentTimes = abandonedCalls
      .filter((c) => c.duration_seconds)
      .map((c) => c.duration_seconds);

    const avgAbandonmentTime =
      abandonmentTimes.length > 0
        ? abandonmentTimes.reduce((sum, t) => sum + t, 0) / abandonmentTimes.length
        : 0;

    const abandonmentRate = (abandonedCalls.length / calls.length) * 100;

    // Group by hour for trend analysis
    const hourlyStats: Record<string, { total: number; abandoned: number }> = {};

    for (const call of calls) {
      const hour = new Date(call.started_at).toISOString().substring(0, 13); // YYYY-MM-DDTHH
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { total: 0, abandoned: 0 };
      }
      hourlyStats[hour].total++;
      if (abandonedCalls.includes(call)) {
        hourlyStats[hour].abandoned++;
      }
    }

    const hourlyTrends = Object.entries(hourlyStats).map(([hour, stats]) => ({
      hour,
      total: stats.total,
      abandoned: stats.abandoned,
      rate: (stats.abandoned / stats.total) * 100,
    }));

    return NextResponse.json({
      abandonment_rate: parseFloat(abandonmentRate.toFixed(2)),
      total_calls: calls.length,
      abandoned_calls: abandonedCalls.length,
      completed_calls: calls.length - abandonedCalls.length,
      avg_abandonment_time: parseFloat(avgAbandonmentTime.toFixed(2)),
      threshold_seconds: threshold,
      date_range: { start: startDate, end: endDate },
      hourly_trends: hourlyTrends.slice(-24), // Last 24 hours
    });
  } catch (error: any) {
    console.error('Error calculating abandonment rate:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate abandonment rate' },
      { status: 500 }
    );
  }
}
