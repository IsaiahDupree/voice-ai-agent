// F0538: SMS analytics - dashboard shows SMS sent/delivered/failed counts

import { supabaseAdmin } from './supabase'

export interface SMSAnalytics {
  total: number
  sent: number // Twilio confirmed sent
  delivered: number
  failed: number
  pending: number // queued/sending
  deliveryRate: number // percentage
  failureRate: number // percentage
  byStatus: Record<string, number>
  byDay: Array<{
    date: string
    sent: number
    delivered: number
    failed: number
  }>
}

/**
 * F0538: Get SMS analytics for a time period
 */
export async function getSMSAnalytics(options: {
  startDate?: string
  endDate?: string
  contactId?: number
  campaignId?: number
}): Promise<SMSAnalytics> {
  try {
    let query = supabaseAdmin.from('voice_agent_sms_logs').select('status, created_at')

    // Apply filters
    if (options.startDate) {
      query = query.gte('created_at', options.startDate)
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate)
    }

    if (options.contactId) {
      query = query.eq('contact_id', options.contactId)
    }

    // Note: campaign_id would need to be added to sms_logs table
    // For now, filter via call_id -> campaign_id join if needed

    const { data: logs, error } = await query

    if (error) {
      console.error('[SMS Analytics] Error fetching logs:', error)
      throw error
    }

    if (!logs || logs.length === 0) {
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        deliveryRate: 0,
        failureRate: 0,
        byStatus: {},
        byDay: [],
      }
    }

    // Count by status
    const byStatus: Record<string, number> = {}
    logs.forEach((log) => {
      const status = log.status || 'unknown'
      byStatus[status] = (byStatus[status] || 0) + 1
    })

    // Calculate totals
    const total = logs.length
    const sent = (byStatus.sent || 0) + (byStatus.delivered || 0)
    const delivered = byStatus.delivered || 0
    const failed = (byStatus.failed || 0) + (byStatus.undelivered || 0)
    const pending = (byStatus.queued || 0) + (byStatus.sending || 0)

    const deliveryRate = total > 0 ? (delivered / total) * 100 : 0
    const failureRate = total > 0 ? (failed / total) * 100 : 0

    // Group by day
    const byDayMap: Record<string, { sent: number; delivered: number; failed: number }> = {}

    logs.forEach((log) => {
      const date = new Date(log.created_at).toISOString().split('T')[0]

      if (!byDayMap[date]) {
        byDayMap[date] = { sent: 0, delivered: 0, failed: 0 }
      }

      if (log.status === 'sent' || log.status === 'delivered') {
        byDayMap[date].sent++
      }

      if (log.status === 'delivered') {
        byDayMap[date].delivered++
      }

      if (log.status === 'failed' || log.status === 'undelivered') {
        byDayMap[date].failed++
      }
    })

    const byDay = Object.entries(byDayMap)
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      total,
      sent,
      delivered,
      failed,
      pending,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      byStatus,
      byDay,
    }
  } catch (error) {
    console.error('[SMS Analytics] Error:', error)
    throw error
  }
}

/**
 * F0538: Get SMS analytics by campaign
 */
export async function getCampaignSMSAnalytics(campaignId: number): Promise<SMSAnalytics> {
  try {
    // Get all calls for this campaign
    const { data: calls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id')
      .eq('campaign_id', campaignId)

    if (!calls || calls.length === 0) {
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        deliveryRate: 0,
        failureRate: 0,
        byStatus: {},
        byDay: [],
      }
    }

    const callIds = calls.map((c) => c.call_id)

    // Get SMS logs for these calls
    const { data: logs } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('status, created_at')
      .in('call_id', callIds)

    if (!logs) {
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        deliveryRate: 0,
        failureRate: 0,
        byStatus: {},
        byDay: [],
      }
    }

    // Use same analytics logic
    return getSMSAnalytics({ startDate: undefined, endDate: undefined })
  } catch (error) {
    console.error('[SMS Analytics] Error getting campaign analytics:', error)
    throw error
  }
}

/**
 * F0538: Get recent SMS failures for debugging
 */
export async function getRecentSMSFailures(limit: number = 20): Promise<
  Array<{
    messageSid: string
    toNumber: string
    errorCode?: string
    errorMessage?: string
    createdAt: string
  }>
> {
  try {
    const { data: failures } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('message_sid, to_number, error_code, error_message, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit)

    return (
      failures?.map((f) => ({
        messageSid: f.message_sid,
        toNumber: f.to_number,
        errorCode: f.error_code,
        errorMessage: f.error_message,
        createdAt: f.created_at,
      })) || []
    )
  } catch (error) {
    console.error('[SMS Analytics] Error getting failures:', error)
    return []
  }
}

/**
 * F0835: SMS delivery rate
 * delivered/sent * 100 for SMS
 * This is already calculated in getSMSAnalytics above as deliveryRate
 */
export async function getSMSDeliveryRate(options: {
  startDate?: string
  endDate?: string
  orgId?: string
}): Promise<{ sent: number; delivered: number; rate: number }> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('status')

    if (options.startDate) {
      query = query.gte('created_at', options.startDate)
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate)
    }
    if (options.orgId) {
      query = query.eq('org_id', options.orgId)
    }

    const { data, error } = await query
    if (error) throw error

    const sent = data?.filter((s) => s.status === 'sent' || s.status === 'delivered').length || 0
    const delivered = data?.filter((s) => s.status === 'delivered').length || 0
    const rate = sent > 0 ? (delivered / sent) * 100 : 0

    return { sent, delivered, rate }
  } catch (error) {
    console.error('Error calculating SMS delivery rate:', error)
    return { sent: 0, delivered: 0, rate: 0 }
  }
}

/**
 * F0836: SMS opt-out rate
 * opt-outs/sent * 100
 */
export async function getSMSOptOutRate(options: {
  startDate?: string
  endDate?: string
  orgId?: string
}): Promise<{ sent: number; opt_outs: number; rate: number }> {
  try {
    // Count total SMS sent
    let smsQuery = supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('id')
      .in('status', ['sent', 'delivered'])

    if (options.startDate) {
      smsQuery = smsQuery.gte('created_at', options.startDate)
    }
    if (options.endDate) {
      smsQuery = smsQuery.lte('created_at', options.endDate)
    }
    if (options.orgId) {
      smsQuery = smsQuery.eq('org_id', options.orgId)
    }

    const { count: sent, error: smsError } = await smsQuery
    if (smsError) throw smsError

    // Count opt-outs
    let optOutQuery = supabaseAdmin
      .from('voice_agent_contacts')
      .select('id')
      .eq('opt_out_sms', true)

    if (options.orgId) {
      optOutQuery = optOutQuery.eq('org_id', options.orgId)
    }
    if (options.startDate) {
      optOutQuery = optOutQuery.gte('updated_at', options.startDate)
    }

    const { count: opt_outs, error: optOutError } = await optOutQuery
    if (optOutError) throw optOutError

    const sentTotal = sent || 0
    const optOutsTotal = opt_outs || 0
    const rate = sentTotal > 0 ? (optOutsTotal / sentTotal) * 100 : 0

    return { sent: sentTotal, opt_outs: optOutsTotal, rate }
  } catch (error) {
    console.error('Error calculating SMS opt-out rate:', error)
    return { sent: 0, opt_outs: 0, rate: 0 }
  }
}
