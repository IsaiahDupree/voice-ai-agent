// F0854: Analytics API endpoint - comprehensive analytics module
// Brings together all analytics from call, SMS, contact, and campaign modules

import {
  getNoAnswerRate,
  getVoicemailRate,
  getAverageCallDuration,
  getDurationHistogram,
  getCallsByOutcome,
  getCallsByDirection,
  getCallsByCampaign,
  getSentimentDistribution,
  getTransferRate,
  getRealTimeCallCount,
} from './call-analytics'
import { getSMSDeliveryRate, getSMSOptOutRate } from './sms-analytics'
import { getContactAcquisitionRate } from './contact-analytics'

export interface AnalyticsOptions {
  startDate?: string
  endDate?: string
  orgId?: string
  campaignId?: string
}

export interface ComprehensiveAnalytics {
  call_metrics: {
    no_answer_rate: { total: number; no_answer: number; rate: number }
    voicemail_rate: { total: number; voicemail: number; rate: number }
    avg_duration: { count: number; avg_duration_seconds: number; avg_duration_minutes: number }
    duration_histogram: Array<{
      bucket: string
      count: number
      range_seconds: { min: number; max: number }
    }>
    by_outcome: Array<{ outcome: string; count: number }>
    by_direction: { inbound: number; outbound: number; total: number }
    by_campaign: Array<{ campaign_id: string; campaign_name: string | null; count: number }>
    sentiment_distribution: {
      positive: number
      neutral: number
      negative: number
      unknown: number
      total: number
      percentages: { positive: number; neutral: number; negative: number; unknown: number }
    }
    transfer_rate: { total: number; transferred: number; rate: number }
    real_time: { active_calls: number }
  }
  sms_metrics: {
    delivery_rate: { sent: number; delivered: number; rate: number }
    opt_out_rate: { sent: number; opt_outs: number; rate: number }
  }
  contact_metrics: {
    acquisition_rate: {
      total_new_contacts: number
      days: number
      avg_per_day: number
      by_day: Array<{ date: string; count: number }>
    }
  }
  generated_at: string
}

/**
 * F0854: Get comprehensive analytics
 * Returns all analytics metrics in one call
 */
export async function getComprehensiveAnalytics(
  options: AnalyticsOptions = {}
): Promise<ComprehensiveAnalytics> {
  try {
    // F0875: Analytics role scoping - all functions use orgId filter
    const { startDate, endDate, orgId } = options

    // Fetch all metrics in parallel
    const [
      no_answer_rate,
      voicemail_rate,
      avg_duration,
      duration_histogram,
      by_outcome,
      by_direction,
      by_campaign,
      sentiment_distribution,
      transfer_rate,
      real_time,
      delivery_rate,
      opt_out_rate,
      acquisition_rate,
    ] = await Promise.all([
      getNoAnswerRate(orgId, startDate, endDate),
      getVoicemailRate(orgId, startDate, endDate),
      getAverageCallDuration(orgId, startDate, endDate),
      getDurationHistogram(orgId, startDate, endDate),
      getCallsByOutcome(orgId, startDate, endDate),
      getCallsByDirection(orgId, startDate, endDate),
      getCallsByCampaign(orgId, startDate, endDate),
      getSentimentDistribution(orgId, startDate, endDate),
      getTransferRate(orgId, startDate, endDate),
      getRealTimeCallCount(orgId),
      getSMSDeliveryRate({ startDate, endDate, orgId }),
      getSMSOptOutRate({ startDate, endDate, orgId }),
      getContactAcquisitionRate({ startDate, endDate, orgId }),
    ])

    return {
      call_metrics: {
        no_answer_rate,
        voicemail_rate,
        avg_duration,
        duration_histogram,
        by_outcome,
        by_direction,
        by_campaign,
        sentiment_distribution,
        transfer_rate,
        real_time,
      },
      sms_metrics: {
        delivery_rate,
        opt_out_rate,
      },
      contact_metrics: {
        acquisition_rate,
      },
      generated_at: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error generating comprehensive analytics:', error)
    throw error
  }
}

/**
 * F0852: Analytics export CSV
 * Export analytics data to CSV format
 */
export async function exportAnalyticsToCSV(
  analytics: ComprehensiveAnalytics
): Promise<string> {
  const rows: string[] = []

  // Header
  rows.push('Metric,Value,Additional Info')

  // Call Metrics
  rows.push('=== CALL METRICS ===,,')
  rows.push(
    `No-Answer Rate,${analytics.call_metrics.no_answer_rate.rate.toFixed(2)}%,${analytics.call_metrics.no_answer_rate.no_answer} of ${analytics.call_metrics.no_answer_rate.total}`
  )
  rows.push(
    `Voicemail Rate,${analytics.call_metrics.voicemail_rate.rate.toFixed(2)}%,${analytics.call_metrics.voicemail_rate.voicemail} of ${analytics.call_metrics.voicemail_rate.total}`
  )
  rows.push(
    `Avg Call Duration,${analytics.call_metrics.avg_duration.avg_duration_minutes.toFixed(2)} min,${analytics.call_metrics.avg_duration.avg_duration_seconds.toFixed(0)}s over ${analytics.call_metrics.avg_duration.count} calls`
  )
  rows.push(
    `Transfer Rate,${analytics.call_metrics.transfer_rate.rate.toFixed(2)}%,${analytics.call_metrics.transfer_rate.transferred} of ${analytics.call_metrics.transfer_rate.total}`
  )
  rows.push(
    `Inbound Calls,${analytics.call_metrics.by_direction.inbound},${((analytics.call_metrics.by_direction.inbound / analytics.call_metrics.by_direction.total) * 100).toFixed(1)}%`
  )
  rows.push(
    `Outbound Calls,${analytics.call_metrics.by_direction.outbound},${((analytics.call_metrics.by_direction.outbound / analytics.call_metrics.by_direction.total) * 100).toFixed(1)}%`
  )
  rows.push(
    `Active Calls (Real-time),${analytics.call_metrics.real_time.active_calls},`
  )

  // Sentiment
  rows.push(',,')
  rows.push('=== SENTIMENT ===,,')
  rows.push(
    `Positive,${analytics.call_metrics.sentiment_distribution.percentages.positive.toFixed(1)}%,${analytics.call_metrics.sentiment_distribution.positive} calls`
  )
  rows.push(
    `Neutral,${analytics.call_metrics.sentiment_distribution.percentages.neutral.toFixed(1)}%,${analytics.call_metrics.sentiment_distribution.neutral} calls`
  )
  rows.push(
    `Negative,${analytics.call_metrics.sentiment_distribution.percentages.negative.toFixed(1)}%,${analytics.call_metrics.sentiment_distribution.negative} calls`
  )

  // Call Outcomes
  rows.push(',,')
  rows.push('=== CALL OUTCOMES ===,,')
  analytics.call_metrics.by_outcome.forEach((outcome) => {
    rows.push(`${outcome.outcome},${outcome.count},`)
  })

  // Duration Histogram
  rows.push(',,')
  rows.push('=== DURATION HISTOGRAM ===,,')
  analytics.call_metrics.duration_histogram.forEach((bucket) => {
    rows.push(`${bucket.bucket},${bucket.count},`)
  })

  // Campaigns
  if (analytics.call_metrics.by_campaign.length > 0) {
    rows.push(',,')
    rows.push('=== BY CAMPAIGN ===,,')
    analytics.call_metrics.by_campaign.forEach((campaign) => {
      rows.push(`${campaign.campaign_name || campaign.campaign_id},${campaign.count},`)
    })
  }

  // SMS Metrics
  rows.push(',,')
  rows.push('=== SMS METRICS ===,,')
  rows.push(
    `SMS Delivery Rate,${analytics.sms_metrics.delivery_rate.rate.toFixed(2)}%,${analytics.sms_metrics.delivery_rate.delivered} of ${analytics.sms_metrics.delivery_rate.sent}`
  )
  rows.push(
    `SMS Opt-Out Rate,${analytics.sms_metrics.opt_out_rate.rate.toFixed(2)}%,${analytics.sms_metrics.opt_out_rate.opt_outs} opt-outs from ${analytics.sms_metrics.opt_out_rate.sent} sent`
  )

  // Contact Metrics
  rows.push(',,')
  rows.push('=== CONTACT METRICS ===,,')
  rows.push(
    `Total New Contacts,${analytics.contact_metrics.acquisition_rate.total_new_contacts},`
  )
  rows.push(
    `Avg Contacts Per Day,${analytics.contact_metrics.acquisition_rate.avg_per_day.toFixed(2)},over ${analytics.contact_metrics.acquisition_rate.days} days`
  )

  // Contact Acquisition by Day
  if (analytics.contact_metrics.acquisition_rate.by_day.length > 0) {
    rows.push(',,')
    rows.push('=== CONTACT ACQUISITION BY DAY ===,,')
    analytics.contact_metrics.acquisition_rate.by_day.forEach((day) => {
      rows.push(`${day.date},${day.count},`)
    })
  }

  // Footer
  rows.push(',,')
  rows.push(`Generated At,${analytics.generated_at},`)

  return rows.join('\n')
}
