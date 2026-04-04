/**
 * F1337: Monitoring: error rate
 * Alert when API error rate > 5%
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ErrorMetrics {
  timestamp: string
  total_requests: number
  error_count: number
  error_rate: number
}

const metrics: ErrorMetrics[] = []
const MAX_METRICS = 1000

export async function GET() {
  try {
    // In production, fetch from database or metrics store
    // For now, simulate with recent data

    const metric: ErrorMetrics = {
      timestamp: new Date().toISOString(),
      total_requests: 1000,
      error_count: 25,
      error_rate: 0.025, // 2.5%
    }

    metrics.push(metric)
    if (metrics.length > MAX_METRICS) {
      metrics.shift()
    }

    // Calculate rolling 5min error rate
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const recentMetrics = metrics.filter(
      (m) => new Date(m.timestamp).getTime() > fiveMinutesAgo
    )

    const totalRequests = recentMetrics.reduce((sum, m) => sum + m.total_requests, 0)
    const totalErrors = recentMetrics.reduce((sum, m) => sum + m.error_count, 0)
    const currentErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0

    // Alert if error rate > 5%
    const threshold = 0.05
    const shouldAlert = currentErrorRate > threshold

    if (shouldAlert) {
      console.error(`[ERROR RATE ALERT] Error rate ${(currentErrorRate * 100).toFixed(2)}% exceeds ${(threshold * 100)}% threshold`)
    }

    return NextResponse.json({
      current: {
        error_rate: currentErrorRate,
        total_requests: totalRequests,
        total_errors: totalErrors,
      },
      threshold,
      alert: shouldAlert,
      period: '5min',
      recentMetrics: metrics.slice(-10),
    })
  } catch (error) {
    console.error('Error rate check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
