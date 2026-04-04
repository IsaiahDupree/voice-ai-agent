/**
 * GET /api/calls/active
 * List currently active calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';

    // Query for calls that are in progress (status = 'in-progress' or similar)
    // Assuming voice_agent_calls table has a status field
    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select(
        'call_id, from_number, to_number, started_at, assistant_id, metadata'
      )
      .in('status', ['in-progress', 'ringing', 'active'])
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Active Calls Query Error]:', error);
      return NextResponse.json(
        { error: 'Failed to fetch active calls' },
        { status: 500 }
      );
    }

    const activeCalls = (data || []).map((call) => ({
      callId: call.call_id,
      fromNumber: call.from_number,
      toNumber: call.to_number,
      startedAt: call.started_at,
      assistantId: call.assistant_id,
      duration: call.started_at
        ? Math.floor(
            (new Date().getTime() - new Date(call.started_at).getTime()) / 1000
          )
        : 0,
      metadata: call.metadata || {},
    }));

    return NextResponse.json({
      success: true,
      calls: activeCalls,
      count: activeCalls.length,
    });
  } catch (error: any) {
    console.error('[Active Calls Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch active calls',
      },
      { status: 500 }
    );
  }
}
