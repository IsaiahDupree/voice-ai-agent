/**
 * GET /api/evaluation/aggregate
 *
 * Get aggregate evaluation statistics over a time period
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAggregateStats } from '@/lib/call-evaluator';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || 'default';
    const startDateStr = searchParams.get('start_date');
    const endDateStr = searchParams.get('end_date');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const stats = await getAggregateStats(tenantId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: stats,
      filters: {
        tenant_id: tenantId,
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('[/api/evaluation/aggregate] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch aggregate stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
