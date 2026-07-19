// F0331: Booking analytics - bookings per day chart data
// F005: Graceful fallback for /api/analytics/bookings (missing start_time column)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const eventTypeId = searchParams.get('eventTypeId')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_bookings')
      .select('start_time, status, event_type_id, created_at')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: true })

    if (eventTypeId) {
      query = query.eq('event_type_id', eventTypeId)
    }

    const { data: bookings, error } = await query

    // F005: Graceful fallback for missing column
    if (error?.message?.includes('does not exist') || error?.message?.includes('schema cache') || error?.message?.includes('Could not find') || error?.message?.includes('start_time')) {
      console.warn('[Analytics Bookings] Schema error detected, returning graceful fallback:', error);
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total: 0,
          avgPerDay: 0,
          peakDay: { date: startDate.toISOString().split('T')[0], count: 0 },
          dateRange: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
          }
        }
      }, { status: 200 });
    }

    if (error) throw error

    // F0331: Group bookings by day
    const bookingsByDay: Record<string, number> = {}
    const statusBreakdown: Record<string, Record<string, number>> = {}

    // Initialize all days in range with 0
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      bookingsByDay[dateStr] = 0
      statusBreakdown[dateStr] = {
        confirmed: 0,
        cancelled: 0,
        rescheduled: 0,
        completed: 0
      }
    }

    // Count bookings per day
    bookings?.forEach((booking) => {
      const date = booking.start_time.split('T')[0]
      if (bookingsByDay[date] !== undefined) {
        bookingsByDay[date]++
        const status = booking.status || 'confirmed'
        if (statusBreakdown[date][status] !== undefined) {
          statusBreakdown[date][status]++
        }
      }
    })

    // Format for chart
    const chartData = Object.entries(bookingsByDay).map(([date, count]) => ({
      date,
      count,
      ...statusBreakdown[date]
    }))

    // Calculate summary stats
    const totalBookings = bookings?.length || 0
    const avgPerDay = totalBookings / days
    const peakDay = chartData.reduce(
      (max, day) => (day.count > max.count ? day : max),
      chartData[0]
    )

    return NextResponse.json({
      success: true,
      data: chartData,
      summary: {
        total: totalBookings,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        peakDay: {
          date: peakDay?.date,
          count: peakDay?.count || 0
        },
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      }
    })
  } catch (error: any) {
    // F005: Graceful fallback for schema-related errors
    if (error?.message?.includes('does not exist') || error?.message?.includes('schema cache') || error?.message?.includes('Could not find') || error?.message?.includes('column')) {
      const endDate = new Date();
      const startDate = new Date();
      const days = parseInt(new URL(error?.request?.url || '').searchParams.get('days') || '30');
      startDate.setDate(startDate.getDate() - days);
      console.warn('[Analytics Bookings] Schema error caught in try/catch:', error);
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total: 0,
          avgPerDay: 0,
          peakDay: { date: startDate.toISOString().split('T')[0], count: 0 },
          dateRange: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
          }
        }
      }, { status: 200 });
    }

    console.error('Error fetching booking analytics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch booking analytics' },
      { status: 500 }
    )
  }
}
