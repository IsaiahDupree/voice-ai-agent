// F0862: Drop-off analysis - where do prospects exit the funnel

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

export const dynamic = 'force-dynamic';

interface DropOffPoint {
  stage: string
  count: number
  percentage: number
  reasons: { reason: string; count: number }[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const personaId = searchParams.get('persona_id')

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('status, end_reason, outcome, booking_made, sentiment, transferred, duration_seconds')

    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }
    if (personaId) {
      query = query.eq('vapi_assistant_id', personaId)
    }

    const { data: calls, error } = await query

    if (error) {
      throw error
    }

    const totalCalls = calls?.length || 0

    // Categorize drop-off points
    const dropOffs = {
      noAnswer: [] as any[],
      earlyHangup: [] as any[], // < 30s
      disinterested: [] as any[], // negative sentiment, didn't book
      objection: [] as any[], // specific objection reasons
      almostBooked: [] as any[], // positive sentiment but didn't book
    }

    calls?.forEach((call: any) => {
      // No answer
      if (call.end_reason === 'no-answer' || call.status === 'no-answer') {
        dropOffs.noAnswer.push(call)
      }
      // Early hangup (< 30s)
      else if (call.duration_seconds && call.duration_seconds < 30 && !call.booking_made) {
        dropOffs.earlyHangup.push(call)
      }
      // Negative sentiment without booking
      else if (call.sentiment === 'negative' && !call.booking_made) {
        dropOffs.disinterested.push(call)
      }
      // Positive/neutral but didn't book
      else if (
        (call.sentiment === 'positive' || call.sentiment === 'neutral') &&
        !call.booking_made &&
        call.duration_seconds &&
        call.duration_seconds >= 30
      ) {
        dropOffs.almostBooked.push(call)
      }
    })

    // Analyze reasons for each stage
    const getReasonCounts = (callList: any[]) => {
      const reasonMap = new Map<string, number>()
      callList.forEach(call => {
        const reason = call.end_reason || call.outcome || 'unknown'
        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1)
      })
      return Array.from(reasonMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => ({ reason, count }))
    }

    // Build drop-off analysis
    const dropOffPoints: DropOffPoint[] = [
      {
        stage: 'No Answer',
        count: dropOffs.noAnswer.length,
        percentage: totalCalls > 0 ? (dropOffs.noAnswer.length / totalCalls) * 100 : 0,
        reasons: getReasonCounts(dropOffs.noAnswer),
      },
      {
        stage: 'Early Hangup (<30s)',
        count: dropOffs.earlyHangup.length,
        percentage: totalCalls > 0 ? (dropOffs.earlyHangup.length / totalCalls) * 100 : 0,
        reasons: getReasonCounts(dropOffs.earlyHangup),
      },
      {
        stage: 'Disinterested (Negative Sentiment)',
        count: dropOffs.disinterested.length,
        percentage: totalCalls > 0 ? (dropOffs.disinterested.length / totalCalls) * 100 : 0,
        reasons: getReasonCounts(dropOffs.disinterested),
      },
      {
        stage: 'Almost Booked (Positive but No Booking)',
        count: dropOffs.almostBooked.length,
        percentage: totalCalls > 0 ? (dropOffs.almostBooked.length / totalCalls) * 100 : 0,
        reasons: getReasonCounts(dropOffs.almostBooked),
      },
    ]

    // Calculate success rate
    const booked = calls?.filter((c: any) => c.booking_made).length || 0
    const successRate = totalCalls > 0 ? (booked / totalCalls) * 100 : 0

    // Identify biggest drop-off stage
    const biggestDropOff = dropOffPoints.reduce((max, point) =>
      point.count > max.count ? point : max
    )

    return apiSuccess({
      dropOffPoints,
      summary: {
        totalCalls,
        totalBooked: booked,
        successRate,
        biggestDropOffStage: biggestDropOff.stage,
        biggestDropOffCount: biggestDropOff.count,
        biggestDropOffPercentage: biggestDropOff.percentage,
      },
      filters: {
        start_date: startDate,
        end_date: endDate,
        persona_id: personaId,
      },
    })
  } catch (error: any) {
    console.error('Drop-off analysis error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get drop-off analysis: ${error.message}`,
      500
    )
  }
}
