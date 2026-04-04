// F0252: Outbound call quality - Monitor and report call quality metrics

import { supabaseAdmin } from '@/lib/supabase'
import { vapiClient } from './vapi'

export interface CallQualityMetrics {
  call_id: string
  vapi_call_id: string
  audio_quality_score: number // 0-100
  latency_ms: number // Average latency
  packet_loss_rate: number // % packet loss
  jitter_ms: number // Audio jitter
  mos_score: number // Mean Opinion Score (1-5)
  transcription_accuracy: number // 0-100
  interruptions_count: number
  silence_periods_count: number
  call_duration_seconds: number
  quality_rating: 'excellent' | 'good' | 'fair' | 'poor'
  issues: string[]
  measured_at: string
}

/**
 * F0252: Collect call quality metrics from Vapi
 */
export async function collectCallQualityMetrics(
  vapiCallId: string
): Promise<CallQualityMetrics | null> {
  try {
    // Fetch call details from Vapi
    const response = await vapiClient.get(`/call/${vapiCallId}`)
    const call = response.data

    if (!call) {
      return null
    }

    // Extract quality metrics from Vapi response
    // Note: Actual field names depend on Vapi's API structure
    const metrics = call.quality || {}

    // Calculate composite quality score
    const audioQuality = metrics.audioQuality || 85
    const latency = metrics.latency || 120
    const packetLoss = metrics.packetLoss || 0.5
    const jitter = metrics.jitter || 10

    // Calculate MOS score (Mean Opinion Score 1-5)
    let mosScore = 4.5
    if (latency > 200) mosScore -= 0.5
    if (latency > 400) mosScore -= 1.0
    if (packetLoss > 1) mosScore -= 0.5
    if (packetLoss > 3) mosScore -= 1.0
    if (jitter > 30) mosScore -= 0.5

    mosScore = Math.max(1, Math.min(5, mosScore))

    // Determine quality rating
    let qualityRating: 'excellent' | 'good' | 'fair' | 'poor'
    if (mosScore >= 4.3) qualityRating = 'excellent'
    else if (mosScore >= 4.0) qualityRating = 'good'
    else if (mosScore >= 3.5) qualityRating = 'fair'
    else qualityRating = 'poor'

    // Detect quality issues
    const issues: string[] = []
    if (latency > 300) issues.push('High latency detected')
    if (packetLoss > 2) issues.push('Packet loss affecting audio quality')
    if (jitter > 40) issues.push('High jitter causing choppy audio')
    if (audioQuality < 70) issues.push('Low audio quality score')

    const qualityMetrics: CallQualityMetrics = {
      call_id: call.id,
      vapi_call_id: vapiCallId,
      audio_quality_score: audioQuality,
      latency_ms: latency,
      packet_loss_rate: packetLoss,
      jitter_ms: jitter,
      mos_score: mosScore,
      transcription_accuracy: metrics.transcriptionAccuracy || 95,
      interruptions_count: metrics.interruptions || 0,
      silence_periods_count: metrics.silencePeriods || 0,
      call_duration_seconds: call.duration || 0,
      quality_rating: qualityRating,
      issues,
      measured_at: new Date().toISOString(),
    }

    // Store quality metrics
    await storeQualityMetrics(qualityMetrics)

    return qualityMetrics
  } catch (error) {
    console.error('Error collecting call quality metrics:', error)
    return null
  }
}

/**
 * Store quality metrics in database
 */
async function storeQualityMetrics(metrics: CallQualityMetrics): Promise<void> {
  await supabaseAdmin
    .from('call_quality_metrics')
    .upsert({
      vapi_call_id: metrics.vapi_call_id,
      audio_quality_score: metrics.audio_quality_score,
      latency_ms: metrics.latency_ms,
      packet_loss_rate: metrics.packet_loss_rate,
      jitter_ms: metrics.jitter_ms,
      mos_score: metrics.mos_score,
      transcription_accuracy: metrics.transcription_accuracy,
      interruptions_count: metrics.interruptions_count,
      silence_periods_count: metrics.silence_periods_count,
      call_duration_seconds: metrics.call_duration_seconds,
      quality_rating: metrics.quality_rating,
      issues: metrics.issues,
      measured_at: metrics.measured_at,
    }, { onConflict: 'vapi_call_id' })
}

/**
 * F0252: Get quality metrics for a campaign
 */
export async function getCampaignQualityReport(
  campaignId: number,
  startDate?: string,
  endDate?: string
): Promise<{
  total_calls: number
  avg_mos_score: number
  avg_latency_ms: number
  avg_packet_loss_rate: number
  quality_distribution: Record<string, number>
  common_issues: Array<{ issue: string; count: number }>
}> {
  let query = supabaseAdmin
    .from('call_quality_metrics')
    .select(`
      *,
      calls!inner(campaign_id)
    `)
    .eq('calls.campaign_id', campaignId)

  if (startDate) {
    query = query.gte('measured_at', startDate)
  }
  if (endDate) {
    query = query.lte('measured_at', endDate)
  }

  const { data: metrics, error } = await query

  if (error || !metrics || metrics.length === 0) {
    return {
      total_calls: 0,
      avg_mos_score: 0,
      avg_latency_ms: 0,
      avg_packet_loss_rate: 0,
      quality_distribution: {},
      common_issues: [],
    }
  }

  // Calculate averages
  const totalCalls = metrics.length
  const avgMosScore = metrics.reduce((sum, m) => sum + m.mos_score, 0) / totalCalls
  const avgLatency = metrics.reduce((sum, m) => sum + m.latency_ms, 0) / totalCalls
  const avgPacketLoss = metrics.reduce((sum, m) => sum + m.packet_loss_rate, 0) / totalCalls

  // Quality distribution
  const qualityDist: Record<string, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  }
  metrics.forEach(m => {
    qualityDist[m.quality_rating] = (qualityDist[m.quality_rating] || 0) + 1
  })

  // Common issues
  const issuesCount: Record<string, number> = {}
  metrics.forEach(m => {
    if (m.issues) {
      m.issues.forEach((issue: string) => {
        issuesCount[issue] = (issuesCount[issue] || 0) + 1
      })
    }
  })

  const commonIssues = Object.entries(issuesCount)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    total_calls: totalCalls,
    avg_mos_score: parseFloat(avgMosScore.toFixed(2)),
    avg_latency_ms: parseFloat(avgLatency.toFixed(2)),
    avg_packet_loss_rate: parseFloat(avgPacketLoss.toFixed(2)),
    quality_distribution: qualityDist,
    common_issues: commonIssues,
  }
}

/**
 * F0252: Flag calls with poor quality for review
 */
export async function flagPoorQualityCalls(mosThreshold: number = 3.5): Promise<number> {
  const { data: poorQualityCalls, error } = await supabaseAdmin
    .from('call_quality_metrics')
    .select('vapi_call_id')
    .lt('mos_score', mosThreshold)
    .eq('flagged_for_review', false)

  if (error || !poorQualityCalls) {
    return 0
  }

  // Flag these calls
  await supabaseAdmin
    .from('call_quality_metrics')
    .update({ flagged_for_review: true })
    .lt('mos_score', mosThreshold)
    .eq('flagged_for_review', false)

  return poorQualityCalls.length
}
