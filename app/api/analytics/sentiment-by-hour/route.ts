// F0870: Sentiment by time of day - analyze sentiment patterns across hours

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface HourlySentiment {
  hour: number // 0-23
  positive: number
  neutral: number
  negative: number
  total: number
  avgScore: number // 1 = positive, 0 = neutral, -1 = negative
  bestTimeWindow: boolean
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const personaId = searchParams.get('persona_id')
    const timezone = searchParams.get('timezone') || 'UTC'

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('sentiment, started_at, status')
      .not('sentiment', 'is', null)

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

    // Group by hour of day
    const hourlyData = new Array(24).fill(null).map((_, hour) => ({
      hour,
      positive: 0,
      neutral: 0,
      negative: 0,
    }))

    calls?.forEach((call: any) => {
      const date = new Date(call.started_at)
      // Convert to specified timezone (simplified - just use UTC for now)
      const hour = date.getUTCHours()

      if (call.sentiment === 'positive') hourlyData[hour].positive++
      else if (call.sentiment === 'neutral') hourlyData[hour].neutral++
      else if (call.sentiment === 'negative') hourlyData[hour].negative++
    })

    // Calculate scores and find best time window
    let bestAvgScore = -2
    let bestHour = 0

    const sentimentByHour: HourlySentiment[] = hourlyData.map((data, hour) => {
      const total = data.positive + data.neutral + data.negative
      const avgScore =
        total > 0
          ? (data.positive * 1 + data.neutral * 0 + data.negative * -1) / total
          : 0

      if (total > 0 && avgScore > bestAvgScore) {
        bestAvgScore = avgScore
        bestHour = hour
      }

      return {
        hour,
        positive: data.positive,
        neutral: data.neutral,
        negative: data.negative,
        total,
        avgScore: Math.round(avgScore * 100) / 100,
        bestTimeWindow: false, // Will mark below
      }
    })

    // Mark best 3-hour window
    if (bestAvgScore > -2) {
      for (let i = -1; i <= 1; i++) {
        const idx = (bestHour + i + 24) % 24
        sentimentByHour[idx].bestTimeWindow = true
      }
    }

    // Calculate summary stats
    const totalCalls = calls?.length || 0
    const positiveHours = sentimentByHour.filter(h => h.avgScore > 0.3).map(h => h.hour)
    const negativeHours = sentimentByHour.filter(h => h.avgScore < -0.3).map(h => h.hour)

    return apiSuccess({
      sentimentByHour,
      summary: {
        totalCalls,
        bestHour,
        bestHourScore: bestAvgScore,
        bestTimeWindow: `${bestHour - 1}:00 - ${(bestHour + 2) % 24}:00`,
        positiveHours,
        negativeHours,
        timezone,
      },
      filters: {
        start_date: startDate,
        end_date: endDate,
        persona_id: personaId,
        timezone,
      },
    })
  } catch (error: any) {
    console.error('Sentiment by hour error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get sentiment by hour: ${error.message}`,
      500
    )
  }
}
