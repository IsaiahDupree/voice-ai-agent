// F1006: GET /api/queue - view campaign/call queue status

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = supabaseAdmin

    const campaignId = searchParams.get('campaign_id')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Get campaign queue entries
    let query = supabase
      .from('campaign_queue')
      .select('*, contacts!inner(*), campaigns!inner(name, status)')
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: queueItems, error: queueError } = await query

    if (queueError) {
      return apiError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to fetch queue: ${queueError.message}`,
        500
      )
    }

    // Get queue stats
    const { data: stats } = await supabase
      .from('campaign_queue')
      .select('status, campaign_id')

    const queueStats = {
      total: stats?.length || 0,
      pending: stats?.filter((s) => s.status === 'pending').length || 0,
      in_progress: stats?.filter((s) => s.status === 'in_progress').length || 0,
      completed: stats?.filter((s) => s.status === 'completed').length || 0,
      failed: stats?.filter((s) => s.status === 'failed').length || 0,
      by_campaign: {} as Record<string, number>,
    }

    // Group by campaign
    stats?.forEach((s) => {
      queueStats.by_campaign[s.campaign_id] = (queueStats.by_campaign[s.campaign_id] || 0) + 1
    })

    return apiSuccess({
      queue_items: queueItems || [],
      stats: queueStats,
      filters: {
        campaign_id: campaignId,
        status,
        limit,
      },
    })
  } catch (error: any) {
    console.error('Queue fetch error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to fetch queue: ${error.message}`,
      500
    )
  }
}
