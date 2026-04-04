// F0856: Analytics by tag - filter analytics by call tags/labels

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { cachedAnalyticsQuery, analyticsCache } from '@/lib/analytics-cache'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = supabaseAdmin

    const tag = searchParams.get('tag')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!tag) {
      return apiError(ErrorCodes.BAD_REQUEST, 'Missing required param: tag', 400)
    }

    // Build cache key
    const cacheKey = analyticsCache.buildKey('analytics:by-tag', {
      tag,
      start_date: startDate || 'all',
      end_date: endDate || 'all',
    })

    // Cached query function
    const queryFn = async () => {
      // Get calls with this tag
      let query = supabase
        .from('call_tags')
        .select('call_id, calls!inner(*)')
        .eq('tag', tag)

      if (startDate) {
        query = query.gte('calls.created_at', startDate)
      }
      if (endDate) {
        query = query.lte('calls.created_at', endDate)
      }

      const { data: taggedCalls, error } = await query

      if (error) throw error

      const calls = taggedCalls?.map((tc: any) => tc.calls) || []

      // Calculate metrics
      const totalCalls = calls.length
      const completedCalls = calls.filter((c: any) => c.status === 'completed').length
      const bookingsMade = calls.filter((c: any) => c.booking_made).length
      const transferredCalls = calls.filter((c: any) => c.transferred).length

      const totalDuration = calls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0)
      const avgDuration = completedCalls > 0 ? totalDuration / completedCalls : 0

      const answerRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0
      const bookingRate = completedCalls > 0 ? (bookingsMade / completedCalls) * 100 : 0
      const transferRate = completedCalls > 0 ? (transferredCalls / completedCalls) * 100 : 0

      const sentimentBreakdown = {
        positive: calls.filter((c: any) => c.sentiment === 'positive').length,
        neutral: calls.filter((c: any) => c.sentiment === 'neutral').length,
        negative: calls.filter((c: any) => c.sentiment === 'negative').length,
      }

      return {
        tag,
        total_calls: totalCalls,
        completed_calls: completedCalls,
        answer_rate: answerRate,
        avg_duration: avgDuration,
        bookings_made: bookingsMade,
        booking_rate: bookingRate,
        transfer_rate: transferRate,
        sentiment_breakdown: sentimentBreakdown,
      }
    }

    // Execute with caching (5 min TTL)
    const analytics = await cachedAnalyticsQuery(cacheKey, queryFn, 300000)

    return apiSuccess(analytics)
  } catch (error: any) {
    console.error('Analytics by tag error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get analytics by tag: ${error.message}`,
      500
    )
  }
}
