/**
 * POST /api/evaluation/batch
 *
 * Evaluate last N calls in bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateCallBatch } from '@/lib/call-evaluator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit = 10, tenant_id = 'default', goal } = body;

    if (limit > 50) {
      return NextResponse.json(
        { error: 'Maximum batch size is 50 calls' },
        { status: 400 }
      );
    }

    // Fetch last N calls that don't have evaluations yet
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('id, transcript, duration, outcome, metadata')
      .eq('metadata->>tenant_id', tenant_id)
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (callsError || !calls) {
      return NextResponse.json(
        { error: 'Failed to fetch calls', details: callsError?.message },
        { status: 500 }
      );
    }

    // Filter out calls that already have evaluations
    const { data: existingEvals } = await supabase
      .from('call_evaluations')
      .select('call_id')
      .in(
        'call_id',
        calls.map((c) => c.id)
      );

    const existingCallIds = new Set(existingEvals?.map((e) => e.call_id) || []);
    const callsToEvaluate = calls.filter((c) => !existingCallIds.has(c.id) && c.transcript);

    if (callsToEvaluate.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No unevaluated calls found',
        skipped: calls.length,
      });
    }

    // Prepare contexts
    const contexts = callsToEvaluate.map((call) => ({
      call_id: call.id,
      transcript: call.transcript,
      goal:
        goal ||
        call.metadata?.goal ||
        'Have a natural conversation and help the caller with their request',
      call_duration_seconds: call.duration,
      outcome: call.outcome,
      customer_sentiment: call.metadata?.sentiment,
      tenant_id,
    }));

    // Evaluate in batch
    const evaluations = await evaluateCallBatch(contexts);

    return NextResponse.json({
      success: true,
      data: evaluations,
      evaluated: evaluations.length,
      skipped: calls.length - callsToEvaluate.length,
      message: `Evaluated ${evaluations.length} calls`,
    });
  } catch (error: unknown) {
    console.error('[/api/evaluation/batch] Error:', error);
    return NextResponse.json(
      {
        error: 'Batch evaluation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
