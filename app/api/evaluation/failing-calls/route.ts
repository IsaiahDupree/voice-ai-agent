/**
 * GET /api/evaluation/failing-calls
 *
 * Get calls scoring below threshold (default 5.0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFailingCalls } from '@/lib/call-evaluator';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const threshold = parseFloat(searchParams.get('threshold') || '5.0');
    const tenantId = searchParams.get('tenant_id') || 'default';
    const limit = parseInt(searchParams.get('limit') || '50');

    const failingCalls = await getFailingCalls(threshold, tenantId, limit);

    return NextResponse.json({
      success: true,
      data: failingCalls,
      count: failingCalls.length,
      filters: {
        threshold,
        tenant_id: tenantId,
        limit,
      },
    });
  } catch (error: unknown) {
    console.error('[/api/evaluation/failing-calls] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch failing calls',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
