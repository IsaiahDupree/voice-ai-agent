// F0230: Live campaign dashboard
// Dashboard shows active campaign call rate

import { supabaseAdmin } from './supabase'

export interface CampaignDashboardMetrics {
  campaign_id: number
  campaign_name: string
  status: string
  active_calls: number
  calls_in_last_hour: number
  calls_today: number
  current_call_rate: number // calls per minute
  contacts_dialed_today: number
  contacts_pending: number
  bookings_today: number
  recent_activity: ActivityEvent[]
}

export interface ActivityEvent {
  event_type: string
  timestamp: string
  details?: any
}

/**
 * F0230: Get live dashboard metrics for campaign
 */
export async function getLiveCampaignMetrics(
  campaignId: number
): Promise<CampaignDashboardMetrics> {
  try {
    // Get campaign info
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('name, status')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`)
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const todayStart = new Date(now.setHours(0, 0, 0, 0))

    // Count active calls (in-progress)
    const { data: activeCalls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id')
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'in-progress', 'ringing'])

    // Count calls in last hour
    const { data: recentCalls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, started_at')
      .eq('campaign_id', campaignId)
      .gte('started_at', oneHourAgo.toISOString())

    // Count calls today
    const { data: todayCalls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id')
      .eq('campaign_id', campaignId)
      .gte('started_at', todayStart.toISOString())

    // Get contact counts
    const { data: contacts } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('status, outcome, last_attempted_at')
      .eq('campaign_id', campaignId)

    const contactsDialedToday =
      contacts?.filter((c) => {
        return (
          c.last_attempted_at &&
          new Date(c.last_attempted_at) >= todayStart
        )
      }).length || 0

    const contactsPending =
      contacts?.filter((c) => c.status === 'pending').length || 0

    const bookingsToday =
      contacts?.filter((c) => {
        return (
          c.outcome === 'booked' &&
          c.last_attempted_at &&
          new Date(c.last_attempted_at) >= todayStart
        )
      }).length || 0

    // Calculate current call rate (calls per minute in last hour)
    const callsInLastHour = recentCalls?.length || 0
    const currentCallRate = callsInLastHour / 60

    // Get recent activity
    const { data: activity } = await supabaseAdmin
      .from('voice_agent_campaign_activity')
      .select('event_type, timestamp, details')
      .eq('campaign_id', campaignId)
      .order('timestamp', { ascending: false })
      .limit(20)

    return {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      status: campaign.status,
      active_calls: activeCalls?.length || 0,
      calls_in_last_hour: callsInLastHour,
      calls_today: todayCalls?.length || 0,
      current_call_rate: Math.round(currentCallRate * 100) / 100,
      contacts_dialed_today: contactsDialedToday,
      contacts_pending: contactsPending,
      bookings_today: bookingsToday,
      recent_activity: (activity as ActivityEvent[]) || [],
    }
  } catch (error) {
    console.error('Error getting campaign metrics:', error)
    throw error
  }
}

/**
 * F0230: Log activity event to campaign dashboard
 */
export async function logCampaignActivity(
  campaignId: number,
  eventType: string,
  details?: any
): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_campaign_activity').insert({
      campaign_id: campaignId,
      event_type: eventType,
      details,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error logging campaign activity:', error)
    // Don't throw - activity logging is best-effort
  }
}
