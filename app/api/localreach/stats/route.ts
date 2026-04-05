import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    // Fetch today's call attempts
    const { data: callsData, error: callsError } = await supabaseAdmin
      .from('localreach_call_attempts')
      .select('status, outcome, duration_seconds, metadata', { count: 'exact', head: false })
      .gte('created_at', todayIso)

    if (callsError) throw callsError

    const calls = callsData || []
    const totalCalls = calls.length
    const answeredCalls = calls.filter(c => c.status === 'answered').length
    const bookedCalls = calls.filter(c => c.outcome === 'booked').length
    const paidCalls = calls.filter(c => c.outcome === 'paid').length

    // Fetch today's conversions for revenue
    const { data: conversionsData, error: conversionsError } = await supabaseAdmin
      .from('localreach_conversions')
      .select('stripe_amount_cents', { count: 'exact', head: false })
      .eq('type', 'payment')
      .gte('created_at', todayIso)

    if (conversionsError) throw conversionsError

    const conversions = conversionsData || []
    const revenueTodaycents = conversions.reduce((sum, c) => sum + (c.stripe_amount_cents || 0), 0)
    const revenueToday = revenueTodaycents / 100

    // Calculate rates
    const answeredRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0
    const bookingRate = totalCalls > 0 ? Math.round((bookedCalls / totalCalls) * 100) : 0

    return NextResponse.json({
      calls_today: totalCalls,
      answered_rate: answeredRate,
      booking_rate: bookingRate,
      revenue_today: revenueToday,
      details: {
        answered: answeredCalls,
        booked: bookedCalls,
        paid: paidCalls,
      },
    })
  } catch (error: any) {
    console.error('[LocalReach Stats API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
