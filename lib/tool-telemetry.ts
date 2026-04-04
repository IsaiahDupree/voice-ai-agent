// F0409: Tool telemetry - Tool execution time tracked and logged

import { supabaseAdmin } from './supabase';

export interface ToolTelemetry {
  tool_name: string;
  call_id?: string;
  execution_time_ms: number;
  success: boolean;
  error_message?: string;
  parameters?: Record<string, any>;
  result?: any;
}

/**
 * F0409: Log tool execution telemetry
 */
export async function logToolTelemetry(telemetry: ToolTelemetry): Promise<void> {
  try {
    await supabaseAdmin.from('function_tool_telemetry').insert({
      tool_name: telemetry.tool_name,
      call_id: telemetry.call_id,
      execution_time_ms: telemetry.execution_time_ms,
      success: telemetry.success,
      error_message: telemetry.error_message,
      parameters: telemetry.parameters,
      result_summary: telemetry.result ? JSON.stringify(telemetry.result).substring(0, 500) : null,
      logged_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log tool telemetry:', error);
    // Don't throw - telemetry logging should not break tool execution
  }
}

/**
 * F0409: Wrapper to track tool execution time
 */
export async function withTelemetry<T>(
  toolName: string,
  callId: string | undefined,
  parameters: Record<string, any>,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  let result: any;

  try {
    result = await fn();
    success = true;
    return result;
  } catch (error: any) {
    success = false;
    errorMessage = error.message || 'Unknown error';
    throw error;
  } finally {
    const executionTimeMs = Date.now() - startTime;

    // Log telemetry asynchronously (don't await)
    logToolTelemetry({
      tool_name: toolName,
      call_id: callId,
      execution_time_ms: executionTimeMs,
      success,
      error_message: errorMessage,
      parameters,
      result: success ? result : undefined,
    }).catch((err) => {
      console.error('Failed to log telemetry:', err);
    });
  }
}

/**
 * F0409: Get tool telemetry stats
 */
export async function getToolTelemetryStats(
  toolName?: string,
  startDate?: string,
  endDate?: string
): Promise<{
  tool_name: string;
  total_calls: number;
  success_count: number;
  error_count: number;
  success_rate: number;
  avg_execution_time_ms: number;
  p50_execution_time_ms: number;
  p95_execution_time_ms: number;
  p99_execution_time_ms: number;
}[]> {
  try {
    let query = supabaseAdmin
      .from('function_tool_telemetry')
      .select('tool_name, execution_time_ms, success');

    if (toolName) {
      query = query.eq('tool_name', toolName);
    }

    if (startDate) {
      query = query.gte('logged_at', startDate);
    }

    if (endDate) {
      query = query.lte('logged_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Group by tool name and calculate stats
    const statsMap = new Map<string, any>();

    for (const row of data) {
      if (!statsMap.has(row.tool_name)) {
        statsMap.set(row.tool_name, {
          tool_name: row.tool_name,
          total_calls: 0,
          success_count: 0,
          error_count: 0,
          execution_times: [],
        });
      }

      const stats = statsMap.get(row.tool_name)!;
      stats.total_calls++;
      if (row.success) {
        stats.success_count++;
      } else {
        stats.error_count++;
      }
      stats.execution_times.push(row.execution_time_ms);
    }

    // Calculate percentiles
    const results = [];
    for (const [toolName, stats] of statsMap.entries()) {
      const executionTimes = stats.execution_times.sort((a: number, b: number) => a - b);
      const p50 = executionTimes[Math.floor(executionTimes.length * 0.5)] || 0;
      const p95 = executionTimes[Math.floor(executionTimes.length * 0.95)] || 0;
      const p99 = executionTimes[Math.floor(executionTimes.length * 0.99)] || 0;
      const avgExecution = executionTimes.reduce((sum: number, val: number) => sum + val, 0) / executionTimes.length;

      results.push({
        tool_name: toolName,
        total_calls: stats.total_calls,
        success_count: stats.success_count,
        error_count: stats.error_count,
        success_rate: (stats.success_count / stats.total_calls) * 100,
        avg_execution_time_ms: Math.round(avgExecution),
        p50_execution_time_ms: p50,
        p95_execution_time_ms: p95,
        p99_execution_time_ms: p99,
      });
    }

    return results;
  } catch (error) {
    console.error('Error fetching tool telemetry stats:', error);
    return [];
  }
}
