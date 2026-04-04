import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0148: Answer rate metric - calculates inbound call metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('end_date') || new Date().toISOString()

    // Get total inbound calls
    const { data: allCalls, error: allError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('id, status, is_missed, duration_seconds, direction')
      .eq('direction', 'inbound')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (allError) throw allError

    const totalCalls = allCalls?.length || 0

    // Calculate answered calls (not missed and has duration)
    const answeredCalls = allCalls?.filter(call =>
      !call.is_missed &&
      call.status === 'completed' &&
      (call.duration_seconds || 0) > 0
    ).length || 0

    // Calculate missed calls
    const missedCalls = allCalls?.filter(call => call.is_missed).length || 0

    // Calculate answer rate
    const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0

    // Get average call duration for answered calls
    const answeredCallsData = allCalls?.filter(call =>
      !call.is_missed &&
      call.status === 'completed' &&
      (call.duration_seconds || 0) > 0
    ) || []

    const avgDuration = answeredCallsData.length > 0
      ? answeredCallsData.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / answeredCallsData.length
      : 0

    return NextResponse.json({
      success: true,
      period: {
        start: startDate,
        end: endDate,
      },
      metrics: {
        total_calls: totalCalls,
        answered_calls: answeredCalls,
        missed_calls: missedCalls,
        answer_rate_percent: parseFloat(answerRate.toFixed(2)),
        avg_duration_seconds: Math.round(avgDuration),
      },
    })
  } catch (error: any) {
    console.error('Error calculating inbound metrics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to calculate metrics' },
      { status: 500 }
    )
  }
}
