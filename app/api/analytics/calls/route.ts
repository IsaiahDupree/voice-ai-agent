// F0945: GET /api/analytics/calls - Returns call-specific analytics
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/analytics/calls
 * F0945: Returns detailed call analytics
 *
 * Returns:
 * - Call volume by day/hour
 * - End reason breakdown
 * - Duration distribution
 * - Success rate trends
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const groupBy = searchParams.get('group_by') || 'day' // day, hour, week

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('*')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: calls, error } = await query

    if (error) {
      throw error
    }

    if (!calls || calls.length === 0) {
      return NextResponse.json({
        totalCalls: 0,
        byEndReason: {},
        byHour: {},
        avgDuration: 0,
        successRate: 0,
        durationDistribution: {},
      })
    }

    // Calculate end reason breakdown
    const byEndReason = calls.reduce((acc: any, call) => {
      const reason = call.end_reason || 'unknown'
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {})

    // Calculate calls by hour of day
    const byHour = calls.reduce((acc: any, call) => {
      if (call.started_at) {
        const hour = new Date(call.started_at).getHours()
        acc[hour] = (acc[hour] || 0) + 1
      }
      return acc
    }, {})

    // Calculate duration distribution (buckets: 0-30s, 30-60s, 1-2m, 2-5m, 5+m)
    const durationDistribution = calls.reduce((acc: any, call) => {
      const duration = call.duration_seconds || 0
      let bucket = '5+ min'

      if (duration <= 30) bucket = '0-30 sec'
      else if (duration <= 60) bucket = '30-60 sec'
      else if (duration <= 120) bucket = '1-2 min'
      else if (duration <= 300) bucket = '2-5 min'

      acc[bucket] = (acc[bucket] || 0) + 1
      return acc
    }, {})

    // Calculate average duration
    const callsWithDuration = calls.filter(c => c.duration_seconds > 0)
    const avgDuration = callsWithDuration.length > 0
      ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callsWithDuration.length)
      : 0

    // Calculate success rate
    const completedCalls = calls.filter(c => c.end_reason === 'completed' || c.end_reason === 'transferred').length
    const successRate = Math.round((completedCalls / calls.length) * 100)

    // Group by day/week/hour for time series
    const timeSeries: any[] = []
    if (groupBy === 'day') {
      const byDay = calls.reduce((acc: any, call) => {
        if (call.created_at) {
          const day = call.created_at.split('T')[0]
          if (!acc[day]) {
            acc[day] = { calls: 0, completed: 0 }
          }
          acc[day].calls++
          if (call.end_reason === 'completed' || call.end_reason === 'transferred') {
            acc[day].completed++
          }
        }
        return acc
      }, {})

      Object.entries(byDay).forEach(([date, stats]: [string, any]) => {
        timeSeries.push({
          date,
          calls: stats.calls,
          completed: stats.completed,
          successRate: Math.round((stats.completed / stats.calls) * 100),
        })
      })

      timeSeries.sort((a, b) => a.date.localeCompare(b.date))
    }

    return NextResponse.json({
      totalCalls: calls.length,
      byEndReason,
      byHour,
      durationDistribution,
      avgDuration,
      successRate,
      timeSeries,
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
    })
  } catch (error: any) {
    console.error('[Call Analytics API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch call analytics' },
      { status: 500 }
    )
  }
}
