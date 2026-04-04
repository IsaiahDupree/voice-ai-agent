// F0854: GET /api/analytics - Returns general analytics JSON
// F0944: GET /api/analytics - Returns general analytics JSON
// F0712, F0714, F0715, F0717: Chart analytics with range parameter
// F0852: Export analytics as CSV with ?format=csv
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getComprehensiveAnalytics, exportAnalyticsToCSV } from '@/lib/unified-analytics'

/**
 * F0712, F0714, F0715, F0717: Get chart analytics for specified date range
 */
async function getChartAnalytics(range: string) {
  try {
    const daysAgo = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)

    // F0714: Calls per day
    const { data: callsData, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('started_at')
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: true })

    if (callsError) throw callsError

    const callsByDay: { [key: string]: number } = {}
    callsData?.forEach((call) => {
      const date = new Date(call.started_at).toISOString().split('T')[0]
      callsByDay[date] = (callsByDay[date] || 0) + 1
    })

    const callsPerDay = []
    for (let i = daysAgo - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      callsPerDay.push({
        date: dateStr,
        count: callsByDay[dateStr] || 0,
      })
    }

    // F0715: Bookings per day
    const { data: bookingsData, error: bookingsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('started_at')
      .eq('outcome', 'booked')
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: true })

    if (bookingsError) throw bookingsError

    const bookingsByDay: { [key: string]: number } = {}
    bookingsData?.forEach((booking) => {
      const date = new Date(booking.started_at).toISOString().split('T')[0]
      bookingsByDay[date] = (bookingsByDay[date] || 0) + 1
    })

    const bookingsPerDay = []
    for (let i = daysAgo - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      bookingsPerDay.push({
        date: dateStr,
        count: bookingsByDay[dateStr] || 0,
      })
    }

    // F0717: Outcome distribution
    const { data: outcomeData, error: outcomeError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('outcome')
      .gte('started_at', startDate.toISOString())
      .not('outcome', 'is', null)

    if (outcomeError) throw outcomeError

    const outcomeCounts: { [key: string]: number } = {}
    outcomeData?.forEach((call) => {
      if (call.outcome) {
        outcomeCounts[call.outcome] = (outcomeCounts[call.outcome] || 0) + 1
      }
    })

    const totalOutcomes = Object.values(outcomeCounts).reduce((sum, count) => sum + count, 0)

    const outcomeDistribution = Object.entries(outcomeCounts).map(([outcome, count]) => ({
      outcome,
      count,
      percentage: totalOutcomes > 0 ? (count / totalOutcomes) * 100 : 0,
    }))

    outcomeDistribution.sort((a, b) => b.count - a.count)

    return NextResponse.json({
      callsPerDay,
      bookingsPerDay,
      outcomeDistribution,
    })
  } catch (error: any) {
    console.error('[Analytics] Chart error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/analytics
 * F0944: Returns high-level analytics across all entities
 *
 * Returns:
 * - Total calls, campaigns, contacts, bookings
 * - Success rates
 * - Recent activity summary
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') // F0712, F0714, F0715, F0717
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const orgId = searchParams.get('org_id') // F0875: Analytics role scoping
    const format = searchParams.get('format') // F0852: CSV export
    const comprehensive = searchParams.get('comprehensive') === 'true' // F0854: Comprehensive analytics

    // F0854: If comprehensive analytics requested, return all metrics
    if (comprehensive) {
      const analytics = await getComprehensiveAnalytics({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        orgId: orgId || undefined,
      })

      // F0852: Export as CSV if requested
      if (format === 'csv') {
        const csv = await exportAnalyticsToCSV(analytics)
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        })
      }

      return NextResponse.json(analytics, { status: 200 })
    }

    // If range is specified, return chart data
    if (range) {
      return getChartAnalytics(range)
    }

    // Base date filters
    const dateFilter = startDate
      ? { gte: startDate, ...(endDate && { lte: endDate }) }
      : {}

    // Get call counts
    let callQuery = supabaseAdmin
      .from('voice_agent_calls')
      .select('id, status, end_reason, duration_seconds', { count: 'exact' })

    if (startDate) {
      callQuery = callQuery.gte('created_at', startDate)
    }
    if (endDate) {
      callQuery = callQuery.lte('created_at', endDate)
    }

    const { data: calls, count: totalCalls } = await callQuery

    const completedCalls = calls?.filter(c => c.end_reason === 'completed' || c.end_reason === 'transferred').length || 0
    const avgDuration = calls && calls.length > 0
      ? Math.round(calls.filter(c => c.duration_seconds).reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length)
      : 0

    // Get campaign counts
    let campaignQuery = supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, status', { count: 'exact' })

    if (startDate) {
      campaignQuery = campaignQuery.gte('created_at', startDate)
    }

    const { data: campaigns, count: totalCampaigns } = await campaignQuery
    const activeCampaigns = campaigns?.filter(c => c.status === 'active' || c.status === 'running').length || 0

    // Get contact counts
    let contactQuery = supabaseAdmin
      .from('voice_agent_contacts')
      .select('id', { count: 'exact' })

    if (startDate) {
      contactQuery = contactQuery.gte('created_at', startDate)
    }

    const { count: totalContacts } = await contactQuery

    // Get booking counts
    let bookingQuery = supabaseAdmin
      .from('voice_agent_bookings')
      .select('id, status', { count: 'exact' })

    if (startDate) {
      bookingQuery = bookingQuery.gte('created_at', startDate)
    }

    const { data: bookings, count: totalBookings } = await bookingQuery
    const confirmedBookings = bookings?.filter(b => b.status === 'scheduled' || b.status === 'confirmed').length || 0

    // Get SMS counts
    let smsQuery = supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('id, status', { count: 'exact' })

    if (startDate) {
      smsQuery = smsQuery.gte('created_at', startDate)
    }

    const { data: smsList, count: totalSMS } = await smsQuery
    const deliveredSMS = smsList?.filter(s => s.status === 'delivered').length || 0

    // F0944: Analytics object
    const analytics = {
      calls: {
        total: totalCalls || 0,
        completed: completedCalls,
        successRate: totalCalls && totalCalls > 0
          ? Math.round((completedCalls / totalCalls) * 100)
          : 0,
        avgDuration,
      },
      campaigns: {
        total: totalCampaigns || 0,
        active: activeCampaigns,
      },
      contacts: {
        total: totalContacts || 0,
      },
      bookings: {
        total: totalBookings || 0,
        confirmed: confirmedBookings,
        conversionRate: totalCalls && totalCalls > 0
          ? Math.round((confirmedBookings / totalCalls) * 100)
          : 0,
      },
      sms: {
        total: totalSMS || 0,
        delivered: deliveredSMS,
        deliveryRate: totalSMS && totalSMS > 0
          ? Math.round((deliveredSMS / totalSMS) * 100)
          : 0,
      },
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(analytics)
  } catch (error: any) {
    console.error('[Analytics API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
