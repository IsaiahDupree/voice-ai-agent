import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0843: Peak calling hours
 * F0844: Best performing day
 *
 * GET /api/analytics/peak-hours
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();

    const { data: calls, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('started_at, outcome')
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    if (error) throw error;

    const hourCounts: number[] = Array(24).fill(0);
    const hourSuccess: number[] = Array(24).fill(0);
    const dayCounts: number[] = Array(7).fill(0);
    const daySuccess: number[] = Array(7).fill(0);

    for (const call of calls || []) {
      const date = new Date(call.started_at);
      const hour = date.getHours();
      const day = date.getDay();

      hourCounts[hour]++;
      dayCounts[day]++;

      if (['success', 'completed', 'resolved'].includes(call.outcome)) {
        hourSuccess[hour]++;
        daySuccess[day]++;
      }
    }

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const bestDay = daySuccess.map((s, i) => ({
      day: i,
      successRate: dayCounts[i] > 0 ? (s / dayCounts[i]) * 100 : 0,
    })).sort((a, b) => b.successRate - a.successRate)[0];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return NextResponse.json({
      peak_hour: {
        hour: `${peakHour}:00`,
        call_count: hourCounts[peakHour],
      },
      best_day: {
        day: dayNames[bestDay.day],
        success_rate: parseFloat(bestDay.successRate.toFixed(2)),
      },
      hourly_breakdown: hourCounts.map((count, hour) => ({
        hour: `${hour}:00`,
        calls: count,
        success_rate: count > 0 ? parseFloat(((hourSuccess[hour] / count) * 100).toFixed(2)) : 0,
      })),
      daily_breakdown: dayCounts.map((count, day) => ({
        day: dayNames[day],
        calls: count,
        success_rate: count > 0 ? parseFloat(((daySuccess[day] / count) * 100).toFixed(2)) : 0,
      })),
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error calculating peak hours:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate peak hours' },
      { status: 500 }
    );
  }
}
