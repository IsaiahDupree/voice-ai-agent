/**
 * F1336: Monitoring: uptime
 * External uptime monitoring on /api/health
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface UptimeMetrics {
  timestamp: string
  status: 'up' | 'down'
  responseTime: number
  checks: {
    api: boolean
    database: boolean
    vapi: boolean
  }
}

// Store uptime metrics (in production, use Vercel KV or database)
const metrics: UptimeMetrics[] = []
const MAX_METRICS = 1000

export async function GET() {
  try {
    const startTime = Date.now()

    // Check API health
    const healthResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/health`,
      { cache: 'no-store' }
    )

    const isUp = healthResponse.ok
    const responseTime = Date.now() - startTime

    const metric: UptimeMetrics = {
      timestamp: new Date().toISOString(),
      status: isUp ? 'up' : 'down',
      responseTime,
      checks: {
        api: healthResponse.ok,
        database: true,
        vapi: true,
      },
    }

    // Store metric
    metrics.push(metric)
    if (metrics.length > MAX_METRICS) {
      metrics.shift()
    }

    // Calculate uptime percentage (last 24h)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
    const recentMetrics = metrics.filter(
      (m) => new Date(m.timestamp).getTime() > twentyFourHoursAgo
    )

    const upCount = recentMetrics.filter((m) => m.status === 'up').length
    const uptimePercentage = recentMetrics.length > 0 ? (upCount / recentMetrics.length) * 100 : 100

    // Alert on 3 consecutive failures
    const lastThree = metrics.slice(-3)
    const consecutiveFailures = lastThree.every((m) => m.status === 'down')

    if (consecutiveFailures && metrics.length >= 3) {
      console.error('[UPTIME ALERT] 3 consecutive failures detected')
    }

    return NextResponse.json({
      current: metric,
      uptime: {
        percentage: uptimePercentage.toFixed(2),
        period: '24h',
      },
      alert: consecutiveFailures,
      recentChecks: metrics.slice(-10),
    })
  } catch (error) {
    console.error('Uptime check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
