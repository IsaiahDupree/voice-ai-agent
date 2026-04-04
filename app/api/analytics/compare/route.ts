// F0851: Analytics comparison API - compare metrics between time periods

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import {
  compareAnalyticsPeriods,
  type AnalyticsMetrics,
} from '@/lib/analytics-comparison'

export const dynamic = 'force-dynamic';

async function getMetricsForPeriod(
  supabase: any,
  startDate: string,
  endDate: string,
  filters?: { persona_id?: string; tag?: string }
): Promise<AnalyticsMetrics> {
  let query = supabase
    .from('calls')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (filters?.persona_id) {
    query = query.eq('persona_id', filters.persona_id)
  }

  const { data: calls, error } = await query

  if (error) throw error

  const totalCalls = calls?.length || 0
  const completedCalls = calls?.filter((c: any) => c.status === 'completed').length || 0
  const bookingsMade = calls?.filter((c: any) => c.booking_made).length || 0
  const transferredCalls = calls?.filter((c: any) => c.transferred).length || 0

  const totalDuration = calls?.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) || 0
  const avgDuration = completedCalls > 0 ? totalDuration / completedCalls : 0

  const answerRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0
  const bookingRate = completedCalls > 0 ? (bookingsMade / completedCalls) * 100 : 0
  const transferRate = completedCalls > 0 ? (transferredCalls / completedCalls) * 100 : 0

  // Get sentiment breakdown
  const sentimentBreakdown = {
    positive: calls?.filter((c: any) => c.sentiment === 'positive').length || 0,
    neutral: calls?.filter((c: any) => c.sentiment === 'neutral').length || 0,
    negative: calls?.filter((c: any) => c.sentiment === 'negative').length || 0,
  }

  // Get avg quality score from transcripts
  const callIds = calls?.map((c: any) => c.id) || []
  const { data: transcripts } = await supabase
    .from('transcripts')
    .select('quality_score')
    .in('call_id', callIds)

  const totalQuality = transcripts?.reduce((sum: number, t: any) => sum + (t.quality_score || 0), 0) || 0
  const avgQualityScore = transcripts?.length > 0 ? totalQuality / transcripts.length : 0

  return {
    total_calls: totalCalls,
    completed_calls: completedCalls,
    answer_rate: answerRate,
    avg_duration: avgDuration,
    bookings_made: bookingsMade,
    booking_rate: bookingRate,
    sentiment_breakdown: sentimentBreakdown,
    transfer_rate: transferRate,
    avg_quality_score: avgQualityScore,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = supabaseAdmin

    // Required params
    const currentStart = searchParams.get('current_start')
    const currentEnd = searchParams.get('current_end')
    const previousStart = searchParams.get('previous_start')
    const previousEnd = searchParams.get('previous_end')

    if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
      return apiError(
        ErrorCodes.BAD_REQUEST,
        'Missing required params: current_start, current_end, previous_start, previous_end',
        400
      )
    }

    // Optional filters
    const personaId = searchParams.get('persona_id') || undefined
    const tag = searchParams.get('tag') || undefined

    // Get metrics for both periods
    const [currentMetrics, previousMetrics] = await Promise.all([
      getMetricsForPeriod(supabase, currentStart, currentEnd, { persona_id: personaId, tag }),
      getMetricsForPeriod(supabase, previousStart, previousEnd, { persona_id: personaId, tag }),
    ])

    // Compare periods
    const comparison = compareAnalyticsPeriods(currentMetrics, previousMetrics)

    return apiSuccess({
      comparison,
      periods: {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd },
      },
      filters: { persona_id: personaId, tag },
    })
  } catch (error: any) {
    console.error('Analytics comparison error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to compare analytics: ${error.message}`,
      500
    )
  }
}
