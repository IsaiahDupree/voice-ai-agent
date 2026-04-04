// F0165: Call quality monitor - Alert on calls with MOS < 3.5
import { supabaseAdmin } from './supabase'

const MOS_THRESHOLD = 3.5 // Mean Opinion Score threshold

export async function monitorCallQuality(callData: {
  call_id: string
  mos_score?: number
  packet_loss?: number
  jitter?: number
  latency?: number
  assistant_id: string
  from_number?: string
  to_number?: string
}): Promise<void> {
  try {
    const { call_id, mos_score, packet_loss, jitter, latency, assistant_id, from_number, to_number } = callData

    // Check if MOS score is below threshold
    if (mos_score && mos_score < MOS_THRESHOLD) {
      console.warn(`Low call quality detected: Call ${call_id} has MOS ${mos_score}`)

      // Log quality issue
      await supabaseAdmin.from('voice_agent_call_quality_issues').insert({
        call_id,
        mos_score,
        packet_loss,
        jitter,
        latency,
        threshold: MOS_THRESHOLD,
        assistant_id,
        from_number,
        to_number,
        detected_at: new Date().toISOString(),
      })

      // Send alert notification
      await sendQualityAlert({
        call_id,
        mos_score,
        threshold: MOS_THRESHOLD,
        assistant_id,
        metrics: {
          packet_loss,
          jitter,
          latency,
        },
      })
    }
  } catch (error: any) {
    console.error('Call quality monitoring error:', error)
    // Don't throw - monitoring is best-effort
  }
}

async function sendQualityAlert(alertData: {
  call_id: string
  mos_score: number
  threshold: number
  assistant_id: string
  metrics?: {
    packet_loss?: number
    jitter?: number
    latency?: number
  }
}) {
  try {
    // Send to configured alert channels
    const alertEmail = process.env.QUALITY_ALERT_EMAIL
    const alertWebhook = process.env.QUALITY_ALERT_WEBHOOK

    if (alertWebhook) {
      await fetch(alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'call_quality_alert',
          call_id: alertData.call_id,
          mos_score: alertData.mos_score,
          threshold: alertData.threshold,
          assistant_id: alertData.assistant_id,
          metrics: alertData.metrics,
          timestamp: new Date().toISOString(),
        }),
      })
      console.log(`Quality alert sent to webhook for call ${alertData.call_id}`)
    }

    // Could also send email alert here
    if (alertEmail) {
      console.log(`Would send quality alert email to ${alertEmail}`)
      // Implement email sending if needed
    }
  } catch (error) {
    console.error('Failed to send quality alert:', error)
    // Don't throw - alert sending is best-effort
  }
}

export async function getQualityStats(assistantId?: string, startDate?: string, endDate?: string) {
  try {
    let query = supabaseAdmin
      .from('voice_agent_call_quality_issues')
      .select('*')
      .order('detected_at', { ascending: false })

    if (assistantId) {
      query = query.eq('assistant_id', assistantId)
    }
    if (startDate) {
      query = query.gte('detected_at', startDate)
    }
    if (endDate) {
      query = query.lte('detected_at', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    return {
      total_issues: data?.length || 0,
      issues: data || [],
      avg_mos: data && data.length > 0
        ? data.reduce((sum, issue) => sum + issue.mos_score, 0) / data.length
        : null,
    }
  } catch (error: any) {
    console.error('Error fetching quality stats:', error)
    return {
      total_issues: 0,
      issues: [],
      avg_mos: null,
      error: error.message,
    }
  }
}
