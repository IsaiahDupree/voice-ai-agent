/**
 * F1338: Monitoring: response time
 * Alert when p95 response time > 2s
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface PerformanceMetrics {
  timestamp: string
  response_times: number[]
  p50: number
  p95: number
  p99: number
  avg: number
}

const metrics: PerformanceMetrics[] = []
const MAX_METRICS = 1000

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[index] || 0
}

export async function GET() {
  try {
    // In production, fetch from APM tool or metrics store
    // For now, simulate with sample data

    const sampleResponseTimes = [
      100, 150, 200, 180, 220, 190, 210, 170, 160, 230,
      140, 195, 205, 185, 215, 175, 165, 225, 155, 235,
    ]

    const p50 = calculatePercentile(sampleResponseTimes, 50)
    const p95 = calculatePercentile(sampleResponseTimes, 95)
    const p99 = calculatePercentile(sampleResponseTimes, 99)
    const avg = sampleResponseTimes.reduce((sum, t) => sum + t, 0) / sampleResponseTimes.length

    const metric: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      response_times: sampleResponseTimes,
      p50,
      p95,
      p99,
      avg,
    }

    metrics.push(metric)
    if (metrics.length > MAX_METRICS) {
      metrics.shift()
    }

    // Alert if p95 > 2000ms
    const threshold = 2000
    const shouldAlert = p95 > threshold

    if (shouldAlert) {
      console.error(`[PERFORMANCE ALERT] p95 response time ${p95}ms exceeds ${threshold}ms threshold`)
    }

    return NextResponse.json({
      current: {
        p50,
        p95,
        p99,
        avg: Math.round(avg),
      },
      threshold,
      alert: shouldAlert,
      period: '5min',
      recentMetrics: metrics.slice(-10).map((m) => ({
        timestamp: m.timestamp,
        p95: m.p95,
      })),
    })
  } catch (error) {
    console.error('Performance check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
