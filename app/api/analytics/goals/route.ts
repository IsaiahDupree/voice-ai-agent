// F0874: GET /api/analytics/goals - Track metrics against configured goals
// POST /api/analytics/goals - Set/update goals

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Goal {
  metric: string
  target: number
  current: number
  percentage: number
  status: 'on_track' | 'at_risk' | 'behind'
}

/**
 * F0874: GET goals and current performance
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // month, week, day

    // Calculate date range based on period
    const endDate = new Date()
    const startDate = new Date()

    if (period === 'month') {
      startDate.setDate(1) // First day of current month
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      const day = startDate.getDay()
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1) // Monday
      startDate.setDate(diff)
      startDate.setHours(0, 0, 0, 0)
    } else {
      startDate.setHours(0, 0, 0, 0)
    }

    // Fetch configured goals from settings (or use defaults)
    const { data: settingsData } = await supabase
      .from('settings')
      .select('goals')
      .eq('key', 'analytics_goals')
      .single()

    const configuredGoals = settingsData?.goals || {
      calls: 100,
      bookings: 20,
      conversion_rate: 20, // percentage
      avg_sentiment: 0.5, // -1 to 1 scale
    }

    // Fetch actual metrics for the period
    const { data: calls } = await supabase
      .from('calls')
      .select('id, status, sentiment')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    const { count: bookingsCount } = await supabase
      .from('bookings')
      .select('id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Calculate current metrics
    const totalCalls = calls?.length || 0
    const totalBookings = bookingsCount || 0
    const conversionRate = totalCalls > 0 ? (totalBookings / totalCalls) * 100 : 0
    const avgSentiment = totalCalls > 0 && calls
      ? calls.reduce((sum: number, c: any) => sum + (c.sentiment || 0), 0) / totalCalls
      : 0

    // Build goals array
    const goals: Goal[] = [
      {
        metric: 'Total Calls',
        target: configuredGoals.calls,
        current: totalCalls,
        percentage: (totalCalls / configuredGoals.calls) * 100,
        status:
          totalCalls >= configuredGoals.calls
            ? 'on_track'
            : totalCalls >= configuredGoals.calls * 0.8
            ? 'at_risk'
            : 'behind',
      },
      {
        metric: 'Bookings',
        target: configuredGoals.bookings,
        current: totalBookings,
        percentage: (totalBookings / configuredGoals.bookings) * 100,
        status:
          totalBookings >= configuredGoals.bookings
            ? 'on_track'
            : totalBookings >= configuredGoals.bookings * 0.8
            ? 'at_risk'
            : 'behind',
      },
      {
        metric: 'Conversion Rate',
        target: configuredGoals.conversion_rate,
        current: conversionRate,
        percentage: (conversionRate / configuredGoals.conversion_rate) * 100,
        status:
          conversionRate >= configuredGoals.conversion_rate
            ? 'on_track'
            : conversionRate >= configuredGoals.conversion_rate * 0.8
            ? 'at_risk'
            : 'behind',
      },
      {
        metric: 'Avg Sentiment',
        target: configuredGoals.avg_sentiment,
        current: avgSentiment,
        percentage: avgSentiment > 0 ? (avgSentiment / configuredGoals.avg_sentiment) * 100 : 0,
        status:
          avgSentiment >= configuredGoals.avg_sentiment
            ? 'on_track'
            : avgSentiment >= configuredGoals.avg_sentiment * 0.8
            ? 'at_risk'
            : 'behind',
      },
    ]

    return NextResponse.json({
      success: true,
      data: {
        goals,
        period,
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching goals:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * F0874: POST to update goal targets
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { calls, bookings, conversion_rate, avg_sentiment } = body

    if (!calls && !bookings && !conversion_rate && !avg_sentiment) {
      return NextResponse.json(
        { error: 'At least one goal must be provided' },
        { status: 400 }
      )
    }

    // Update or insert goals in settings table
    const goals = {
      calls: calls || 100,
      bookings: bookings || 20,
      conversion_rate: conversion_rate || 20,
      avg_sentiment: avg_sentiment || 0.5,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'analytics_goals',
        goals,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Goals updated successfully',
      goals,
    })
  } catch (error: any) {
    console.error('Error updating goals:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
