import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0149: First Call Resolution (FCR) Analytics
 * GET /api/analytics/fcr
 *
 * Tracks percentage of calls where issue was resolved without requiring a callback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const direction = searchParams.get('direction') || 'inbound';

    // Get all completed calls in date range
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, outcome, metadata, contact_id, ended_at')
      .eq('direction', direction)
      .gte('ended_at', startDate)
      .lte('ended_at', endDate)
      .not('outcome', 'is', null);

    if (callsError) throw callsError;

    if (!calls || calls.length === 0) {
      return NextResponse.json({
        fcr_rate: 0,
        total_calls: 0,
        resolved_calls: 0,
        unresolved_calls: 0,
        date_range: { start: startDate, end: endDate },
      });
    }

    // Check each call for subsequent callbacks
    let resolvedCount = 0;
    const callDetails: Array<{
      call_id: string;
      resolved: boolean;
      had_callback: boolean;
    }> = [];

    for (const call of calls) {
      // Check if contact called back within 48 hours
      const cutoffTime = new Date(call.ended_at).getTime() + 48 * 60 * 60 * 1000;

      const { data: followupCalls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('call_id')
        .eq('contact_id', call.contact_id)
        .gt('started_at', call.ended_at)
        .lt('started_at', new Date(cutoffTime).toISOString())
        .limit(1);

      const hadCallback = (followupCalls?.length || 0) > 0;

      // Call is resolved if outcome is positive AND no callback
      const isResolved =
        (call.outcome === 'resolved' ||
          call.outcome === 'success' ||
          call.outcome === 'completed' ||
          call.metadata?.first_call_resolution === true) &&
        !hadCallback;

      if (isResolved) {
        resolvedCount++;
      }

      callDetails.push({
        call_id: call.call_id,
        resolved: isResolved,
        had_callback: hadCallback,
      });
    }

    const fcrRate = (resolvedCount / calls.length) * 100;

    return NextResponse.json({
      fcr_rate: parseFloat(fcrRate.toFixed(2)),
      total_calls: calls.length,
      resolved_calls: resolvedCount,
      unresolved_calls: calls.length - resolvedCount,
      date_range: { start: startDate, end: endDate },
      direction,
      call_details: callDetails.slice(0, 100), // Return first 100 for debugging
    });
  } catch (error: any) {
    console.error('Error calculating FCR:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate FCR' },
      { status: 500 }
    );
  }
}
