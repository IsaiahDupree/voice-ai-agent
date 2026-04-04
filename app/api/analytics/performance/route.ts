import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0830: Agent performance
 * F0834: Transfer success rate
 *
 * GET /api/analytics/performance - Agent/assistant performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();

    // Get calls with assistant/persona info
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, persona_id, outcome, transfer_status, sentiment, duration_seconds')
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    if (callsError) throw callsError;

    // Get personas
    const { data: personas, error: personasError } = await supabaseAdmin
      .from('personas')
      .select('id, name');

    if (personasError) throw personasError;

    // Calculate per-agent metrics
    const agentStats: Record<string, any> = {};

    for (const call of calls || []) {
      const personaId = call.persona_id || 'unknown';

      if (!agentStats[personaId]) {
        agentStats[personaId] = {
          total_calls: 0,
          successful_calls: 0,
          transferred_calls: 0,
          transfer_success: 0,
          positive_sentiment: 0,
          total_duration: 0,
        };
      }

      const stats = agentStats[personaId];
      stats.total_calls++;

      if (['success', 'completed', 'resolved'].includes(call.outcome)) {
        stats.successful_calls++;
      }

      if (call.transfer_status) {
        stats.transferred_calls++;
        if (call.transfer_status === 'transferred') {
          stats.transfer_success++;
        }
      }

      if (call.sentiment === 'positive') {
        stats.positive_sentiment++;
      }

      if (call.duration_seconds) {
        stats.total_duration += call.duration_seconds;
      }
    }

    // Calculate rates
    const agentPerformance = Object.entries(agentStats).map(([personaId, stats]: [string, any]) => {
      const persona = personas?.find((p) => p.id === personaId);

      return {
        persona_id: personaId,
        persona_name: persona?.name || 'Unknown',
        total_calls: stats.total_calls,
        success_rate: parseFloat(((stats.successful_calls / stats.total_calls) * 100).toFixed(2)),
        transfer_rate: parseFloat(((stats.transferred_calls / stats.total_calls) * 100).toFixed(2)),
        transfer_success_rate:
          stats.transferred_calls > 0
            ? parseFloat(((stats.transfer_success / stats.transferred_calls) * 100).toFixed(2))
            : 0,
        positive_sentiment_rate: parseFloat(((stats.positive_sentiment / stats.total_calls) * 100).toFixed(2)),
        avg_call_duration: parseFloat((stats.total_duration / stats.total_calls).toFixed(2)),
      };
    });

    // Sort by total calls
    agentPerformance.sort((a, b) => b.total_calls - a.total_calls);

    return NextResponse.json({
      agent_performance: agentPerformance,
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error calculating performance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate performance' },
      { status: 500 }
    );
  }
}
