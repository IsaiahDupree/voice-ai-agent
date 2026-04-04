// F0409: Tool telemetry API - Get tool execution stats

import { NextRequest, NextResponse } from 'next/server';
import { getToolTelemetryStats } from '@/lib/tool-telemetry';

export const dynamic = 'force-dynamic';

/**
 * F0409: Get tool telemetry statistics
 * GET /api/tools/telemetry?tool_name=X&start_date=Y&end_date=Z
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const toolName = searchParams.get('tool_name') || undefined;
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;

    const stats = await getToolTelemetryStats(toolName, startDate, endDate);

    // Calculate aggregate stats
    const totalCalls = stats.reduce((sum, s) => sum + s.total_calls, 0);
    const totalErrors = stats.reduce((sum, s) => sum + s.error_count, 0);
    const overallSuccessRate = totalCalls > 0
      ? ((totalCalls - totalErrors) / totalCalls) * 100
      : 0;

    // Find slowest and fastest tools
    const slowestTool = stats.length > 0
      ? stats.reduce((max, s) => s.avg_execution_time_ms > max.avg_execution_time_ms ? s : max, stats[0])
      : null;

    const fastestTool = stats.length > 0
      ? stats.reduce((min, s) => s.avg_execution_time_ms < min.avg_execution_time_ms ? s : min, stats[0])
      : null;

    return NextResponse.json({
      success: true,
      filters: {
        tool_name: toolName,
        start_date: startDate,
        end_date: endDate,
      },
      summary: {
        total_calls: totalCalls,
        total_tools: stats.length,
        overall_success_rate: parseFloat(overallSuccessRate.toFixed(2)),
        slowest_tool: slowestTool ? {
          name: slowestTool.tool_name,
          avg_ms: slowestTool.avg_execution_time_ms,
        } : null,
        fastest_tool: fastestTool ? {
          name: fastestTool.tool_name,
          avg_ms: fastestTool.avg_execution_time_ms,
        } : null,
      },
      tools: stats,
    });
  } catch (error: any) {
    console.error('Error fetching tool telemetry:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch telemetry',
    }, { status: 500 });
  }
}
