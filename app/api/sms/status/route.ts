// F0559: SMS status dashboard - overview of SMS delivery status

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = supabaseAdmin

    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Get SMS message stats
    let query = supabase.from('sms_messages').select('status, direction, created_at, retry_count')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: messages, error } = await query

    if (error) {
      return apiError(ErrorCodes.DATABASE_ERROR, `Failed to fetch SMS data: ${error.message}`, 500)
    }

    const total = messages?.length || 0
    const sent = messages?.filter((m) => m.status === 'sent').length || 0
    const pending = messages?.filter((m) => m.status === 'pending').length || 0
    const failed = messages?.filter((m) => m.status === 'failed').length || 0
    const queued = messages?.filter((m) => m.status === 'queued').length || 0

    const inbound = messages?.filter((m) => m.direction === 'inbound').length || 0
    const outbound = messages?.filter((m) => m.direction === 'outbound').length || 0

    // Calculate delivery rate
    const deliveryRate = total > 0 ? (sent / total) * 100 : 0

    // Calculate retry stats
    const messagesWithRetries = messages?.filter((m) => (m.retry_count || 0) > 0).length || 0
    const retryRate = total > 0 ? (messagesWithRetries / total) * 100 : 0

    // Get active threads count
    const { data: threads } = await supabase
      .from('sms_threads')
      .select('status')
      .eq('status', 'active')

    const activeThreads = threads?.length || 0

    // Get recent failures for troubleshooting
    const { data: recentFailures } = await supabase
      .from('sms_messages')
      .select('id, to_number, error, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10)

    return apiSuccess({
      summary: {
        total_messages: total,
        sent,
        pending,
        failed,
        queued,
        delivery_rate: deliveryRate.toFixed(2),
        retry_rate: retryRate.toFixed(2),
      },
      by_direction: {
        inbound,
        outbound,
      },
      threads: {
        active: activeThreads,
      },
      recent_failures: recentFailures || [],
      filters: {
        start_date: startDate,
        end_date: endDate,
      },
    })
  } catch (error: any) {
    console.error('SMS status dashboard error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to generate SMS status: ${error.message}`,
      500
    )
  }
}
