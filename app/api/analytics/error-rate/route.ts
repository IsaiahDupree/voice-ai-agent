// F0872: Error rate analytics - track API errors and failures by service

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface ErrorStats {
  service: string
  totalRequests: number
  errorCount: number
  errorRate: number
  errors4xx: number
  errors5xx: number
  commonErrors: { statusCode: number; count: number; message?: string }[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const service = searchParams.get('service')

    // Build query for API logs
    let query = supabaseAdmin
      .from('voice_agent_api_logs')
      .select('service, status_code, error_message, created_at')

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
        errorStats: [],
        summary: {
          totalRequests: 0,
          totalErrors: 0,
          overallErrorRate: 0,
        },
        filters: {
          start_date: startDate,
          end_date: endDate,
          service,
        },
      })
    }

    // Group by service
    const serviceMap = new Map<string, any>()

    logs.forEach((log: any) => {
      const svc = log.service
      if (!serviceMap.has(svc)) {
        serviceMap.set(svc, {
          totalRequests: 0,
          errorCount: 0,
          errors4xx: 0,
          errors5xx: 0,
          errorDetails: [] as any[],
        })
      }

      const data = serviceMap.get(svc)!
      data.totalRequests++

      if (log.status_code >= 400) {
        data.errorCount++
        if (log.status_code >= 400 && log.status_code < 500) {
          data.errors4xx++
        } else if (log.status_code >= 500) {
          data.errors5xx++
        }
        data.errorDetails.push({
          statusCode: log.status_code,
          message: log.error_message,
        })
      }
    })

    // Build error stats
    const errorStats: ErrorStats[] = Array.from(serviceMap.entries()).map(([svc, data]) => {
      // Count common status codes
      const statusCodeMap = new Map<number, number>()
      data.errorDetails.forEach((err: any) => {
        statusCodeMap.set(err.statusCode, (statusCodeMap.get(err.statusCode) || 0) + 1)
      })

      const commonErrors = Array.from(statusCodeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([statusCode, count]) => ({
          statusCode,
          count,
          message: data.errorDetails.find((e: any) => e.statusCode === statusCode)?.message,
        }))

      return {
        service: svc,
        totalRequests: data.totalRequests,
        errorCount: data.errorCount,
        errorRate: data.totalRequests > 0 ? (data.errorCount / data.totalRequests) * 100 : 0,
        errors4xx: data.errors4xx,
        errors5xx: data.errors5xx,
        commonErrors,
      }
    })

    // Sort by error rate
    errorStats.sort((a, b) => b.errorRate - a.errorRate)

    // Summary
    const totalRequests = logs.length
    const totalErrors = logs.filter((l: any) => l.status_code >= 400).length
    const overallErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0

    return apiSuccess({
      errorStats,
      summary: {
        totalRequests,
        totalErrors,
        overallErrorRate: Math.round(overallErrorRate * 100) / 100,
        mostUnreliableService: errorStats[0]?.service || null,
      },
      filters: {
        start_date: startDate,
        end_date: endDate,
        service,
      },
    })
  } catch (error: any) {
    console.error('Error rate analytics error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get error rate analytics: ${error.message}`,
      500
    )
  }
}
