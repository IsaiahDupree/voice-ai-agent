/**
 * POST /api/evaluation/trigger
 *
 * Manually trigger LLM evaluation for a specific call
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateCall } from '@/lib/call-evaluator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { call_id, goal, tenant_id = 'default' } = body;

    if (!call_id) {
      return NextResponse.json(
        { error: 'Missing required field: call_id' },
        { status: 400 }
      );
    }

    // Fetch call transcript from database
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, transcript, duration, outcome, metadata')
      .eq('id', call_id)
      .maybeSingle();

    if (callError || !call) {
      return NextResponse.json(
        { error: 'Call not found', details: callError?.message },
        { status: 404 }
      );
    }

    if (!call.transcript || call.transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'Call has no transcript to evaluate' },
        { status: 400 }
      );
    }

    // Determine goal (from params or metadata or default)
    const callGoal =
      goal ||
      call.metadata?.goal ||
      'Have a natural conversation and help the caller with their request';

    // Trigger evaluation
    const evaluation = await evaluateCall({
      call_id: call.id,
      transcript: call.transcript,
      goal: callGoal,
      call_duration_seconds: call.duration,
      outcome: call.outcome,
      customer_sentiment: call.metadata?.sentiment,
      tenant_id,
    });

    return NextResponse.json({
      success: true,
      data: evaluation,
      message: 'Call evaluation completed',
    });
  } catch (error: unknown) {
    console.error('[/api/evaluation/trigger] Error:', error);
    return NextResponse.json(
      {
        error: 'Evaluation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
