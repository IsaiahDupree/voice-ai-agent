import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0824: Duration p50/p95
 * GET /api/analytics/duration-percentiles
 *
 * Calculate 50th and 95th percentile call durations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const direction = searchParams.get('direction'); // optional filter

    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('duration_seconds')
      .gte('started_at', startDate)
      .lte('started_at', endDate)
      .not('duration_seconds', 'is', null)
      .order('duration_seconds', { ascending: true });

    if (direction) {
      query = query.eq('direction', direction);
    }

    const { data: calls, error } = await query;

    if (error) throw error;

    if (!calls || calls.length === 0) {
      return NextResponse.json({
        p50: 0,
        p95: 0,
        count: 0,
        date_range: { start: startDate, end: endDate },
      });
    }

    const durations = calls.map((c) => c.duration_seconds).filter((d) => d > 0);

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);

    return NextResponse.json({
      p50: durations[p50Index],
      p95: durations[p95Index],
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      count: durations.length,
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error calculating duration percentiles:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate percentiles' },
      { status: 500 }
    );
  }
}
