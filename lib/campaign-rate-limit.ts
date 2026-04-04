// F0225: Outbound call rate limit
// Max calls per hour per campaign

import { supabaseAdmin } from './supabase'

export interface RateLimitConfig {
  campaign_id: number
  max_calls_per_hour: number
  created_at?: string
  updated_at?: string
}

export interface RateLimitStatus {
  campaign_id: number
  calls_in_last_hour: number
  max_calls_per_hour: number
  can_dial: boolean
  wait_until?: string
}

/**
 * F0225: Set rate limit for campaign
 */
export async function setRateLimit(
  campaignId: number,
  maxCallsPerHour: number
): Promise<void> {
  try {
    await supabaseAdmin
      .from('voice_agent_campaign_rate_limits')
      .upsert(
        {
          campaign_id: campaignId,
          max_calls_per_hour: maxCallsPerHour,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'campaign_id' }
      )

    console.log(`Set rate limit for campaign ${campaignId}: ${maxCallsPerHour} calls/hour`)
  } catch (error) {
    console.error('Error setting rate limit:', error)
    throw error
  }
}

/**
 * F0225: Check if campaign can make more calls
 * Returns true if under rate limit
 */
export async function checkRateLimit(campaignId: number): Promise<RateLimitStatus> {
  try {
    // Get rate limit config
    const { data: config } = await supabaseAdmin
      .from('voice_agent_campaign_rate_limits')
      .select('max_calls_per_hour')
      .eq('campaign_id', campaignId)
      .single()

    if (!config) {
      // No rate limit configured - allow unlimited
      return {
        campaign_id: campaignId,
        calls_in_last_hour: 0,
        max_calls_per_hour: Infinity,
        can_dial: true,
      }
    }

    // Count calls in last hour
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)

    const { data: calls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id')
      .eq('campaign_id', campaignId)
      .gte('started_at', oneHourAgo.toISOString())

    const callsInLastHour = calls?.length || 0
    const canDial = callsInLastHour < config.max_calls_per_hour

    let waitUntil: string | undefined
    if (!canDial && calls && calls.length > 0) {
      // Calculate when the oldest call will age out
      const { data: oldestCall } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('started_at')
        .eq('campaign_id', campaignId)
        .gte('started_at', oneHourAgo.toISOString())
        .order('started_at', { ascending: true })
        .limit(1)
        .single()

      if (oldestCall) {
        const waitTime = new Date(oldestCall.started_at)
        waitTime.setHours(waitTime.getHours() + 1)
        waitUntil = waitTime.toISOString()
      }
    }

    return {
      campaign_id: campaignId,
      calls_in_last_hour: callsInLastHour,
      max_calls_per_hour: config.max_calls_per_hour,
      can_dial: canDial,
      wait_until: waitUntil,
    }
  } catch (error) {
    console.error('Error checking rate limit:', error)
    // On error, allow the call (fail open)
    return {
      campaign_id: campaignId,
      calls_in_last_hour: 0,
      max_calls_per_hour: Infinity,
      can_dial: true,
    }
  }
}
