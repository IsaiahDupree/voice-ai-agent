// F0861: Funnel visualization API - Calls > Answered > Interested > Booked

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface FunnelStage {
  name: string
  count: number
  percentage: number
  dropOffRate?: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const personaId = searchParams.get('persona_id')

    // Build base query
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('status, end_reason, outcome, booking_made, sentiment, transferred')

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

    // Calculate funnel stages
    const totalCalls = calls?.length || 0

    // Stage 1: Total Calls Initiated
    const callsInitiated = totalCalls

    // Stage 2: Calls Answered (not no-answer or failed)
    const callsAnswered = calls?.filter(
      (c: any) =>
        c.status === 'completed' ||
        c.status === 'in-progress' ||
        (c.end_reason !== 'no-answer' && c.end_reason !== 'failed')
    ).length || 0

    // Stage 3: Interested (answered + positive/neutral sentiment, not transferred immediately)
    const interested = calls?.filter(
      (c: any) =>
        (c.status === 'completed' || c.status === 'in-progress') &&
        (c.sentiment === 'positive' || c.sentiment === 'neutral') &&
        c.end_reason !== 'no-answer'
    ).length || 0

    // Stage 4: Booked
    const booked = calls?.filter((c: any) => c.booking_made === true || c.outcome === 'booked').length || 0

    // Build funnel with percentages (relative to previous stage)
    const funnel: FunnelStage[] = [
      {
        name: 'Calls Initiated',
        count: callsInitiated,
        percentage: 100,
      },
      {
        name: 'Answered',
        count: callsAnswered,
        percentage: callsInitiated > 0 ? (callsAnswered / callsInitiated) * 100 : 0,
        dropOffRate: callsInitiated > 0 ? ((callsInitiated - callsAnswered) / callsInitiated) * 100 : 0,
      },
      {
        name: 'Interested',
        count: interested,
        percentage: callsAnswered > 0 ? (interested / callsAnswered) * 100 : 0,
        dropOffRate: callsAnswered > 0 ? ((callsAnswered - interested) / callsAnswered) * 100 : 0,
      },
      {
        name: 'Booked',
        count: booked,
        percentage: interested > 0 ? (booked / interested) * 100 : 0,
        dropOffRate: interested > 0 ? ((interested - booked) / interested) * 100 : 0,
      },
    ]

    // Calculate overall conversion rate
    const overallConversionRate = callsInitiated > 0 ? (booked / callsInitiated) * 100 : 0

    return apiSuccess({
      funnel,
      overallConversionRate,
      filters: {
        start_date: startDate,
        end_date: endDate,
        persona_id: personaId,
      },
    })
  } catch (error: any) {
    console.error('Funnel analytics error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get funnel analytics: ${error.message}`,
      500
    )
  }
}
