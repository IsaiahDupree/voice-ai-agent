/**
 * GET /api/memory/callers
 * List all callers sorted by relationship score
 */

import { NextRequest, NextResponse } from 'next/server';
import { listTopCallers } from '@/lib/caller-memory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const limit = parseInt(searchParams.get('limit') || '50');

    const callers = await listTopCallers(tenantId, limit);

    return NextResponse.json({
      success: true,
      callers,
      count: callers.length,
    });
  } catch (error: any) {
    console.error('[List Callers Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to list callers',
      },
      { status: 500 }
    );
  }
}
