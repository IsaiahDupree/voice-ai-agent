/**
 * GET /api/evaluation/:call_id
 *
 * Fetch evaluation for a specific call
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEvaluation } from '@/lib/call-evaluator';

export async function GET(
  request: NextRequest,
  { params }: { params: { call_id: string } }
) {
  try {
    const { call_id } = params;

    const evaluation = await getEvaluation(call_id);

    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found for this call' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: evaluation,
    });
  } catch (error: unknown) {
    console.error('[/api/evaluation/:call_id] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch evaluation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
