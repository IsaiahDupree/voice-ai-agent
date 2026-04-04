// F0871: API latency analytics - track response times for external APIs

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface LatencyStats {
  service: string
  requestCount: number
  avgLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  minLatency: number
  maxLatency: number
  errorRate: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const service = searchParams.get('service') // vapi, calcom, twilio, elevenlabs, deepgram

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_api_logs')
      .select('service, endpoint, latency_ms, status_code, created_at')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (service) {
      query = query.eq('service', service)
    }

    const { data: logs, error } = await query

    if (error) {
      throw error
    }

    if (!logs || logs.length === 0) {
      return apiSuccess({
        latencyStats: [],
        summary: {
          totalRequests: 0,
          avgLatency: 0,
          slowestService: null,
        },
        filters: {
          start_date: startDate,
          end_date: endDate,
          service,
        },
      })
    }

    // Group by service
    const serviceMap = new Map<string, number[]>()
    const serviceErrors = new Map<string, number>()

    logs.forEach((log: any) => {
      const svc = log.service
      if (!serviceMap.has(svc)) {
        serviceMap.set(svc, [])
        serviceErrors.set(svc, 0)
      }
      serviceMap.get(svc)!.push(log.latency_ms)
      if (log.status_code >= 400) {
        serviceErrors.set(svc, serviceErrors.get(svc)! + 1)
      }
    })

    // Calculate percentiles
    const calculatePercentile = (values: number[], percentile: number): number => {
      if (values.length === 0) return 0
      const sorted = [...values].sort((a, b) => a - b)
      const index = Math.ceil((percentile / 100) * sorted.length) - 1
      return sorted[Math.max(0, index)]
    }

    // Build stats for each service
    const latencyStats: LatencyStats[] = Array.from(serviceMap.entries()).map(([svc, latencies]) => {
      const requestCount = latencies.length
      const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / requestCount
      const errorCount = serviceErrors.get(svc) || 0

      return {
        service: svc,
        requestCount,
        avgLatency: Math.round(avgLatency),
        p50Latency: calculatePercentile(latencies, 50),
        p95Latency: calculatePercentile(latencies, 95),
        p99Latency: calculatePercentile(latencies, 99),
        minLatency: Math.min(...latencies),
        maxLatency: Math.max(...latencies),
        errorRate: requestCount > 0 ? (errorCount / requestCount) * 100 : 0,
      }
    })

    // Sort by avg latency
    latencyStats.sort((a, b) => b.avgLatency - a.avgLatency)

    // Summary
    const totalRequests = logs.length
    const overallAvgLatency = logs.reduce((sum: number, l: any) => sum + l.latency_ms, 0) / totalRequests
    const slowestService = latencyStats[0]?.service || null

    return apiSuccess({
      latencyStats,
      summary: {
        totalRequests,
        avgLatency: Math.round(overallAvgLatency),
        slowestService,
        slowestAvgLatency: latencyStats[0]?.avgLatency || 0,
      },
      filters: {
        start_date: startDate,
        end_date: endDate,
        service,
      },
    })
  } catch (error: any) {
    console.error('API latency analytics error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get API latency analytics: ${error.message}`,
      500
    )
  }
}
