// F0817: Total calls metric
// F0818: Total bookings metric
// F0819: Booking conversion rate
// F0850: Analytics date range

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // F0850: Analytics date range - default to last 30 days
    const defaultDateFrom = new Date()
    defaultDateFrom.setDate(defaultDateFrom.getDate() - 30)

    const startDate = dateFrom ? new Date(dateFrom) : defaultDateFrom
    const endDate = dateTo ? new Date(dateTo) : new Date()

    // F0817: Total calls metric
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('id, outcome, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (callsError) {
      console.error('Error fetching calls:', callsError)
      return NextResponse.json({ error: callsError.message }, { status: 500 })
    }

    const totalCalls = calls.length
    const activeCalls = calls.filter(
      (c) => c.status === 'in-progress' || c.status === 'ringing'
    ).length

    // F0818: Total bookings metric
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (bookingsError && bookingsError.code !== 'PGRST116') {
      console.error('Error fetching bookings:', bookingsError)
    }

    const totalBookings = bookings?.length || 0

    // F0819: Booking conversion rate (bookings/calls * 100)
    const conversionRate = totalCalls > 0 ? (totalBookings / totalCalls) * 100 : 0

    // SMS sent count
    const { data: smsLogs, error: smsError } = await supabaseAdmin
      .from('sms_logs')
      .select('id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .neq('status', 'failed')

    if (smsError && smsError.code !== 'PGRST116') {
      console.error('Error fetching SMS logs:', smsError)
    }

    const smsSent = smsLogs?.length || 0

    return NextResponse.json({
      totalCalls,
      activeCalls,
      totalBookings,
      conversionRate,
      smsSent,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/analytics/stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
