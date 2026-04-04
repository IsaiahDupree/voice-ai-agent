// F0857: Analytics by persona - filter analytics by AI persona/assistant

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { cachedAnalyticsQuery, analyticsCache } from '@/lib/analytics-cache'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = supabaseAdmin

    const personaId = searchParams.get('persona_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!personaId) {
      return apiError(ErrorCodes.BAD_REQUEST, 'Missing required param: persona_id', 400)
    }

    // Build cache key
    const cacheKey = analyticsCache.buildKey('analytics:by-persona', {
      persona_id: personaId,
      start_date: startDate || 'all',
      end_date: endDate || 'all',
    })

    // Cached query function
    const queryFn = async () => {
      // Get persona details
      const { data: persona, error: personaError } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single()

      if (personaError || !persona) {
        throw new Error(`Persona ${personaId} not found`)
      }

      // Get calls for this persona
      let query = supabase
        .from('calls')
        .select('*')
        .eq('vapi_assistant_id', persona.vapi_assistant_id)

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data: calls, error } = await query

      if (error) throw error

      // Calculate metrics
      const totalCalls = calls?.length || 0
      const completedCalls = calls?.filter((c: any) => c.status === 'completed').length || 0
      const bookingsMade = calls?.filter((c: any) => c.booking_made).length || 0
      const transferredCalls = calls?.filter((c: any) => c.transferred).length || 0

      const totalDuration = calls?.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) || 0
      const avgDuration = completedCalls > 0 ? totalDuration / completedCalls : 0

      const answerRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0
      const bookingRate = completedCalls > 0 ? (bookingsMade / completedCalls) * 100 : 0
      const transferRate = completedCalls > 0 ? (transferredCalls / completedCalls) * 100 : 0

      const sentimentBreakdown = {
        positive: calls?.filter((c: any) => c.sentiment === 'positive').length || 0,
        neutral: calls?.filter((c: any) => c.sentiment === 'neutral').length || 0,
        negative: calls?.filter((c: any) => c.sentiment === 'negative').length || 0,
      }

      // Calculate cost estimate ($0.32/call average)
      const estimatedCost = totalCalls * 0.32

      return {
        persona: {
          id: persona.id,
          name: persona.name,
          vapi_assistant_id: persona.vapi_assistant_id,
          voice_id: persona.voice_id,
        },
        total_calls: totalCalls,
        completed_calls: completedCalls,
        answer_rate: answerRate,
        avg_duration: avgDuration,
        bookings_made: bookingsMade,
        booking_rate: bookingRate,
        transfer_rate: transferRate,
        sentiment_breakdown: sentimentBreakdown,
        estimated_cost: estimatedCost,
      }
    }

    // Execute with caching (5 min TTL)
    const analytics = await cachedAnalyticsQuery(cacheKey, queryFn, 300000)

    return apiSuccess(analytics)
  } catch (error: any) {
    console.error('Analytics by persona error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get analytics by persona: ${error.message}`,
      500
    )
  }
}
