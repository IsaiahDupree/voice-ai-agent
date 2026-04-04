// F0228: Campaign scheduling
// Schedule campaign to start at future datetime

import { supabaseAdmin } from './supabase'

export interface CampaignSchedule {
  campaign_id: number
  scheduled_start: string // ISO8601 datetime
  scheduled_end?: string // Optional end time
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  started_at?: string
  ended_at?: string
  created_at?: string
  updated_at?: string
}

/**
 * F0228: Schedule campaign to start at future time
 */
export async function scheduleCampaign(
  campaignId: number,
  scheduledStart: string,
  scheduledEnd?: string
): Promise<CampaignSchedule> {
  try {
    const schedule: Partial<CampaignSchedule> = {
      campaign_id: campaignId,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaign_schedules')
      .upsert(schedule, { onConflict: 'campaign_id' })
      .select()
      .single()

    if (error) throw error

    console.log(`Scheduled campaign ${campaignId} to start at ${scheduledStart}`)

    return data as CampaignSchedule
  } catch (error) {
    console.error('Error scheduling campaign:', error)
    throw error
  }
}

/**
 * F0228: Get campaigns ready to start
 * Returns campaigns where scheduled_start <= now and status = pending
 */
export async function getScheduledCampaigns(): Promise<CampaignSchedule[]> {
  try {
    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaign_schedules')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_start', now)
      .order('scheduled_start', { ascending: true })

    if (error) throw error

    return (data as CampaignSchedule[]) || []
  } catch (error) {
    console.error('Error getting scheduled campaigns:', error)
    return []
  }
}

/**
 * F0228: Mark campaign as started
 */
export async function markCampaignStarted(campaignId: number): Promise<void> {
  try {
    await supabaseAdmin
      .from('voice_agent_campaign_schedules')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', campaignId)

    console.log(`Marked campaign ${campaignId} as started`)
  } catch (error) {
    console.error('Error marking campaign started:', error)
    throw error
  }
}

/**
 * F0228: Cancel scheduled campaign
 */
export async function cancelScheduledCampaign(campaignId: number): Promise<void> {
  try {
    await supabaseAdmin
      .from('voice_agent_campaign_schedules')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    console.log(`Cancelled scheduled campaign ${campaignId}`)
  } catch (error) {
    console.error('Error cancelling campaign:', error)
    throw error
  }
}
