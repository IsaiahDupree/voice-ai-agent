// F0716: Sentiment trend - line chart of average sentiment over time

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface SentimentDataPoint {
  date: string
  positive: number
  neutral: number
  negative: number
  avgScore: number // 1 = positive, 0 = neutral, -1 = negative
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const personaId = searchParams.get('persona_id')

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('sentiment, started_at, status')
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString())
      .not('sentiment', 'is', null)

    if (personaId) {
      query = query.eq('vapi_assistant_id', personaId)
    }

    const { data: calls, error } = await query

    if (error) {
      throw error
    }

    // Group by date
    const dateMap = new Map<string, { positive: number; neutral: number; negative: number }>()

    calls?.forEach((call: any) => {
      const date = new Date(call.started_at).toISOString().split('T')[0]

      if (!dateMap.has(date)) {
        dateMap.set(date, { positive: 0, neutral: 0, negative: 0 })
      }

      const counts = dateMap.get(date)!
      if (call.sentiment === 'positive') counts.positive++
      else if (call.sentiment === 'neutral') counts.neutral++
      else if (call.sentiment === 'negative') counts.negative++
    })

    // Build trend data
    const trend: SentimentDataPoint[] = []

    // Fill in all dates in range (even if no calls)
    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const counts = dateMap.get(dateStr) || { positive: 0, neutral: 0, negative: 0 }

      const total = counts.positive + counts.neutral + counts.negative
      const avgScore =
        total > 0
          ? (counts.positive * 1 + counts.neutral * 0 + counts.negative * -1) / total
          : 0

      trend.push({
        date: dateStr,
        positive: counts.positive,
        neutral: counts.neutral,
        negative: counts.negative,
        avgScore: Math.round(avgScore * 100) / 100, // Round to 2 decimals
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate overall stats
    const totalPositive = trend.reduce((sum, d) => sum + d.positive, 0)
    const totalNeutral = trend.reduce((sum, d) => sum + d.neutral, 0)
    const totalNegative = trend.reduce((sum, d) => sum + d.negative, 0)
    const totalCalls = totalPositive + totalNeutral + totalNegative

    const overallAvgScore =
      totalCalls > 0
        ? (totalPositive * 1 + totalNeutral * 0 + totalNegative * -1) / totalCalls
        : 0

    return apiSuccess({
      trend,
      summary: {
        totalCalls,
        totalPositive,
        totalNeutral,
        totalNegative,
        overallAvgScore: Math.round(overallAvgScore * 100) / 100,
        positiveRate: totalCalls > 0 ? (totalPositive / totalCalls) * 100 : 0,
        negativeRate: totalCalls > 0 ? (totalNegative / totalCalls) * 100 : 0,
      },
      filters: {
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        persona_id: personaId,
      },
    })
  } catch (error: any) {
    console.error('Sentiment trend error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get sentiment trend: ${error.message}`,
      500
    )
  }
}
