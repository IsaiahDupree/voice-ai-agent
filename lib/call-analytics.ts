// F0145: Call abandonment detection
// Detects when caller hangs up before agent answers

import { supabaseAdmin } from './supabase'

export interface AbandonmentEvent {
  call_id: string
  phone_number: string
  ring_duration_seconds: number
  timestamp: string
  assistant_id?: string
}

/**
 * F0145: Track call abandonment
 * Abandonment = caller hangs up while call is in "ringing" state
 */
export async function trackAbandonment(event: AbandonmentEvent): Promise<void> {
  try {
    // Insert abandonment event into analytics table
    await supabaseAdmin.from('voice_agent_call_abandonments').insert({
      call_id: event.call_id,
      phone_number: event.phone_number,
      ring_duration_seconds: event.ring_duration_seconds,
      assistant_id: event.assistant_id,
      timestamp: event.timestamp,
    })

    // Update call record to mark as abandoned
    await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        status: 'abandoned',
        end_reason: 'caller_abandoned',
        is_abandoned: true,
        metadata: {
          abandonment: {
            ring_duration_seconds: event.ring_duration_seconds,
            detected_at: event.timestamp,
          },
        },
      })
      .eq('call_id', event.call_id)

    console.log(`Call ${event.call_id} marked as abandoned after ${event.ring_duration_seconds}s`)
  } catch (error) {
    console.error('Error tracking abandonment:', error)
    // Don't throw - this is analytics, shouldn't break main flow
  }
}

/**
 * F0145: Get abandonment rate for assistant
 * Returns percentage of calls abandoned
 */
export async function getAbandonmentRate(
  assistantId: string,
  startDate?: string,
  endDate?: string
): Promise<{ total: number; abandoned: number; rate: number }> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, status, is_abandoned')
      .eq('assistant_id', assistantId)

    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    const total = data?.length || 0
    const abandoned = data?.filter((c) => c.is_abandoned).length || 0
    const rate = total > 0 ? (abandoned / total) * 100 : 0

    return { total, abandoned, rate }
  } catch (error) {
    console.error('Error calculating abandonment rate:', error)
    return { total: 0, abandoned: 0, rate: 0 }
  }
}

/**
 * F0820: No-answer rate
 * Count no-answer / total outbound calls
 */
export async function getNoAnswerRate(
  orgId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ total: number; no_answer: number; rate: number }> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, status, direction, outcome')
      .eq('direction', 'outbound')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    const total = data?.length || 0
    const no_answer = data?.filter((c) => c.outcome === 'no_answer' || c.status === 'no_answer').length || 0
    const rate = total > 0 ? (no_answer / total) * 100 : 0

    return { total, no_answer, rate }
  } catch (error) {
    console.error('Error calculating no-answer rate:', error)
    return { total: 0, no_answer: 0, rate: 0 }
  }
}

/**
 * F0821: Voicemail rate
 * Count voicemail drops / total outbound
 */
export async function getVoicemailRate(
  orgId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ total: number; voicemail: number; rate: number }> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, status, direction, outcome')
      .eq('direction', 'outbound')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    const total = data?.length || 0
    const voicemail = data?.filter((c) => c.outcome === 'voicemail' || c.status === 'voicemail').length || 0
    const rate = total > 0 ? (voicemail / total) * 100 : 0

    return { total, voicemail, rate }
  } catch (error) {
    console.error('Error calculating voicemail rate:', error)
    return { total: 0, voicemail: 0, rate: 0 }
  }
}

/**
 * F0822: Average call duration
 * Mean duration of completed calls
 */
export async function getAverageCallDuration(
  orgId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ count: number; avg_duration_seconds: number; avg_duration_minutes: number }> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, duration_seconds, status')
      .not('duration_seconds', 'is', null)
      .in('status', ['completed', 'ended'])

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    const count = data?.length || 0
    if (count === 0) {
      return { count: 0, avg_duration_seconds: 0, avg_duration_minutes: 0 }
    }

    const totalSeconds = data.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
    const avg_duration_seconds = totalSeconds / count
    const avg_duration_minutes = avg_duration_seconds / 60

    return { count, avg_duration_seconds, avg_duration_minutes }
  } catch (error) {
    console.error('Error calculating average call duration:', error)
    return { count: 0, avg_duration_seconds: 0, avg_duration_minutes: 0 }
  }
}

/**
 * F0823: Duration histogram
 * Histogram of call durations in 30s buckets
 */
export async function getDurationHistogram(
  orgId?: string,
  startDate?: string,
  endDate?: string,
  bucketSize = 30
): Promise<{ bucket: string; count: number; range_seconds: { min: number; max: number } }[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, duration_seconds')
      .not('duration_seconds', 'is', null)
      .in('status', ['completed', 'ended'])

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    // Group into buckets
    const buckets: Record<number, number> = {}
    data?.forEach((call) => {
      const duration = call.duration_seconds || 0
      const bucketIndex = Math.floor(duration / bucketSize)
      buckets[bucketIndex] = (buckets[bucketIndex] || 0) + 1
    })

    // Convert to array format
    return Object.entries(buckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([bucketIndex, count]) => {
        const index = Number(bucketIndex)
        const min = index * bucketSize
        const max = (index + 1) * bucketSize
        return {
          bucket: `${min}-${max}s`,
          count,
          range_seconds: { min, max },
        }
      })
  } catch (error) {
    console.error('Error calculating duration histogram:', error)
    return []
  }
}

/**
 * F0826: Calls by outcome
 * Count calls grouped by outcome
 */
export async function getCallsByOutcome(
  orgId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ outcome: string; count: number }[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, outcome')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    // Group by outcome
    const outcomes: Record<string, number> = {}
    data?.forEach((call) => {
      const outcome = call.outcome || 'unknown'
      outcomes[outcome] = (outcomes[outcome] || 0) + 1
    })

    return Object.entries(outcomes).map(([outcome, count]) => ({ outcome, count }))
  } catch (error) {
    console.error('Error calculating calls by outcome:', error)
    return []
  }
}

/**
 * F0827: Calls by direction
 * Split inbound vs outbound counts
 */
export async function getCallsByDirection(
  orgId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ inbound: number; outbound: number; total: number }> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, direction')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    const inbound = data?.filter((c) => c.direction === 'inbound').length || 0
    const outbound = data?.filter((c) => c.direction === 'outbound').length || 0
    const total = data?.length || 0

    return { inbound, outbound, total }
  } catch (error) {
    console.error('Error calculating calls by direction:', error)
    return { inbound: 0, outbound: 0, total: 0 }
  }
}

/**
 * F0828: Calls by campaign
 * Count calls per campaign
 */
export async function getCallsByCampaign(
  orgId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ campaign_id: string; campaign_name: string | null; count: number }[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, campaign_id')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data: calls, error } = await query
    if (error) throw error

    // Group by campaign
    const campaigns: Record<string, number> = {}
    calls?.forEach((call) => {
      const campaignId = call.campaign_id || 'none'
      campaigns[campaignId] = (campaigns[campaignId] || 0) + 1
    })

    // Fetch campaign names
    const campaignIds = Object.keys(campaigns).filter((id) => id !== 'none')
    let campaignNames: Record<string, string> = {}

    if (campaignIds.length > 0) {
      const { data: campaignData } = await supabaseAdmin
        .from('voice_agent_campaigns')
        .select('id, name')
        .in('id', campaignIds)

      campaignNames = Object.fromEntries(campaignData?.map((c) => [c.id, c.name]) || [])
    }

    return Object.entries(campaigns).map(([campaign_id, count]) => ({
      campaign_id,
      campaign_name: campaignNames[campaign_id] || (campaign_id === 'none' ? 'No Campaign' : null),
      count,
    }))
  } catch (error) {
    console.error('Error calculating calls by campaign:', error)
    return []
  }
}

/**
 * F0831: Sentiment distribution
 * % positive/neutral/negative calls
 */
export async function getSentimentDistribution(
  orgId?: string,
  startDate?: string,
  endDate?: string
): Promise<{
  positive: number
  neutral: number
  negative: number
  unknown: number
  total: number
  percentages: { positive: number; neutral: number; negative: number; unknown: number }
}> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, sentiment')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    const total = data?.length || 0
    if (total === 0) {
      return {
        positive: 0,
        neutral: 0,
        negative: 0,
        unknown: 0,
        total: 0,
        percentages: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
      }
    }

    const positive = data?.filter((c) => c.sentiment === 'positive').length || 0
    const neutral = data?.filter((c) => c.sentiment === 'neutral').length || 0
    const negative = data?.filter((c) => c.sentiment === 'negative').length || 0
    const unknown = data?.filter((c) => !c.sentiment || c.sentiment === 'unknown').length || 0

    return {
      positive,
      neutral,
      negative,
      unknown,
      total,
      percentages: {
        positive: (positive / total) * 100,
        neutral: (neutral / total) * 100,
        negative: (negative / total) * 100,
        unknown: (unknown / total) * 100,
      },
    }
  } catch (error) {
    console.error('Error calculating sentiment distribution:', error)
    return {
      positive: 0,
      neutral: 0,
      negative: 0,
      unknown: 0,
      total: 0,
      percentages: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
    }
  }
}

/**
 * F0833: Transfer rate
 * % calls resulting in transfer
 */
export async function getTransferRate(
  orgId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ total: number; transferred: number; rate: number }> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, was_transferred')

    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    const total = data?.length || 0
    const transferred = data?.filter((c) => c.was_transferred === true).length || 0
    const rate = total > 0 ? (transferred / total) * 100 : 0

    return { total, transferred, rate }
  } catch (error) {
    console.error('Error calculating transfer rate:', error)
    return { total: 0, transferred: 0, rate: 0 }
  }
}

/**
 * F0858: Real-time call counter
 * Counter of currently active calls
 */
export async function getRealTimeCallCount(orgId?: string): Promise<{ active_calls: number }> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id', { count: 'exact', head: true })
      .in('status', ['ringing', 'in_progress', 'active'])

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { count, error } = await query
    if (error) throw error

    return { active_calls: count || 0 }
  } catch (error) {
    console.error('Error counting real-time calls:', error)
    return { active_calls: 0 }
  }
}
