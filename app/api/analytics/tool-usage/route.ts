import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0865: Tool usage analytics
 * F0866: Avg tool latency
 *
 * GET /api/analytics/tool-usage
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();

    const { data: functionCalls, error } = await supabaseAdmin
      .from('voice_agent_function_calls')
      .select('function_name, timestamp, result')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);

    if (error) throw error;

    // Aggregate by function
    const toolStats: Record<
      string,
      { count: number; totalLatency: number; latencies: number[] }
    > = {};

    for (const call of functionCalls || []) {
      if (!toolStats[call.function_name]) {
        toolStats[call.function_name] = { count: 0, totalLatency: 0, latencies: [] };
      }

      const stats = toolStats[call.function_name];
      stats.count++;

      // Extract latency if available in result
      const latency = call.result?.latency_ms || call.result?.duration_ms || 0;
      if (latency > 0) {
        stats.totalLatency += latency;
        stats.latencies.push(latency);
      }
    }

    // Build summary
    const toolUsageSummary = Object.entries(toolStats).map(([name, stats]) => ({
      tool_name: name,
      usage_count: stats.count,
      avg_latency_ms: stats.latencies.length > 0
        ? parseFloat((stats.totalLatency / stats.latencies.length).toFixed(2))
        : 0,
      p95_latency_ms: stats.latencies.length > 0
        ? stats.latencies.sort((a, b) => a - b)[Math.floor(stats.latencies.length * 0.95)]
        : 0,
    })).sort((a, b) => b.usage_count - a.usage_count);

    const totalCalls = functionCalls?.length || 0;

    return NextResponse.json({
      tool_usage: toolUsageSummary,
      total_tool_calls: totalCalls,
      unique_tools: Object.keys(toolStats).length,
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error calculating tool usage:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate tool usage' },
      { status: 500 }
    );
  }
}
