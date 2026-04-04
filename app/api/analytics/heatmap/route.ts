import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0825: Calls per hour heatmap
 * GET /api/analytics/heatmap
 *
 * Returns call volume by hour of day and day of week
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();

    const { data: calls, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('started_at')
      .gte('started_at', startDate)
      .lte('started_at', endDate)
      .not('started_at', 'is', null);

    if (error) throw error;

    // Build heatmap: [day_of_week][hour] = count
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const call of calls || []) {
      const date = new Date(call.started_at);
      const dayOfWeek = date.getDay(); // 0 = Sunday
      const hour = date.getHours();
      heatmap[dayOfWeek][hour]++;
    }

    // Find peak hour
    let peakHour = { day: 0, hour: 0, count: 0 };

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if (heatmap[day][hour] > peakHour.count) {
          peakHour = { day, hour, count: heatmap[day][hour] };
        }
      }
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return NextResponse.json({
      heatmap,
      peak_hour: {
        day: dayNames[peakHour.day],
        hour: `${peakHour.hour}:00`,
        count: peakHour.count,
      },
      total_calls: calls?.length || 0,
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error generating heatmap:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate heatmap' },
      { status: 500 }
    );
  }
}
