import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0784: Persona performance metrics
// F1009: GET /api/personas/:id/metrics - Returns performance metrics for persona
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('end_date') || new Date().toISOString()

    // Verify persona exists
    let personaQuery = supabaseAdmin
      .from('personas')
      .select('id, name, vapi_assistant_id')
      .eq('id', params.id)

    if (orgId) {
      personaQuery = personaQuery.eq('org_id', orgId)
    }

    const { data: persona, error: personaError } = await personaQuery.single()

    if (personaError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Get call metrics for this persona
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('*')
      .eq('assistant_id', persona.vapi_assistant_id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (callsError) {
      console.error('Error fetching calls:', callsError)
      return NextResponse.json({ error: callsError.message }, { status: 500 })
    }

    const callsList = calls || []

    // Calculate metrics
    const totalCalls = callsList.length
    const answeredCalls = callsList.filter(c => c.status === 'completed' || c.status === 'answered').length
    const failedCalls = callsList.filter(c => c.status === 'failed' || c.status === 'no-answer').length
    const totalDuration = callsList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0

    // Booking metrics
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('calendar_bookings')
      .select('*')
      .in('call_id', callsList.map(c => c.call_id))

    const bookingsCount = bookings?.length || 0
    const bookingRate = answeredCalls > 0 ? (bookingsCount / answeredCalls) * 100 : 0

    // Transfer metrics
    const transferredCalls = callsList.filter(c => c.transferred_to).length
    const transferRate = answeredCalls > 0 ? (transferredCalls / answeredCalls) * 100 : 0

    // Sentiment metrics
    const sentimentCounts = {
      positive: callsList.filter(c => c.sentiment === 'positive').length,
      neutral: callsList.filter(c => c.sentiment === 'neutral').length,
      negative: callsList.filter(c => c.sentiment === 'negative').length,
    }

    // Cost metrics (estimated)
    const avgCostPerCall = 0.32 // Approximate cost
    const totalCost = totalCalls * avgCostPerCall
    const costPerBooking = bookingsCount > 0 ? totalCost / bookingsCount : 0

    return NextResponse.json({
      persona: {
        id: persona.id,
        name: persona.name,
      },
      period: {
        start: startDate,
        end: endDate,
      },
      metrics: {
        calls: {
          total: totalCalls,
          answered: answeredCalls,
          failed: failedCalls,
          answer_rate: totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0,
        },
        duration: {
          total_seconds: totalDuration,
          avg_seconds: Math.round(avgDuration),
        },
        bookings: {
          count: bookingsCount,
          rate: Math.round(bookingRate * 10) / 10, // Round to 1 decimal
        },
        transfers: {
          count: transferredCalls,
          rate: Math.round(transferRate * 10) / 10,
        },
        sentiment: {
          positive: sentimentCounts.positive,
          neutral: sentimentCounts.neutral,
          negative: sentimentCounts.negative,
          positive_rate: totalCalls > 0 ? (sentimentCounts.positive / totalCalls) * 100 : 0,
        },
        cost: {
          total: Math.round(totalCost * 100) / 100,
          per_call: avgCostPerCall,
          per_booking: Math.round(costPerBooking * 100) / 100,
        },
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/personas/:id/metrics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch persona metrics' },
      { status: 500 }
    )
  }
}
