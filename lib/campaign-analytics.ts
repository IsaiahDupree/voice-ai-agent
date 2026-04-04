// F0210: Campaign progress tracking
// F0213: Campaign conversion rate
// F0246: Cost per call tracking

import { supabaseAdmin } from './supabase'

export interface CampaignStats {
  campaign_id: number
  total_contacts: number
  completed: number
  pending: number
  in_progress: number
  booked: number
  no_answer: number
  voicemail: number
  dnc: number
  failed: number
  progress_percent: number // F0210: Progress percentage
  conversion_rate: number // F0213: Conversion rate (booked / completed)
  total_calls: number
  total_cost: number // F0246: Total campaign cost
  cost_per_call: number // F0246: Average cost per call
  cost_per_booking: number // F0246: Cost per successful booking
}

/**
 * F0210: Get campaign progress tracking
 * F0213: Calculate conversion rate
 * F0246: Track cost per call
 */
export async function getCampaignStats(campaignId: number): Promise<CampaignStats> {
  try {
    // Get contact counts by status
    const { data: contacts } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('status, outcome, attempts')
      .eq('campaign_id', campaignId)

    const total = contacts?.length || 0
    const completed = contacts?.filter((c) => c.status === 'completed').length || 0
    const pending = contacts?.filter((c) => c.status === 'pending').length || 0
    const inProgress = contacts?.filter((c) => c.status === 'in_progress').length || 0

    const booked = contacts?.filter((c) => c.outcome === 'booked').length || 0
    const noAnswer = contacts?.filter((c) => c.outcome === 'no-answer').length || 0
    const voicemail = contacts?.filter((c) => c.outcome === 'voicemail').length || 0
    const dnc = contacts?.filter((c) => c.outcome === 'dnc').length || 0
    const failed = contacts?.filter((c) => c.outcome === 'failed').length || 0

    // F0210: Progress percentage
    const progressPercent = total > 0 ? (completed / total) * 100 : 0

    // F0213: Conversion rate
    const conversionRate = completed > 0 ? (booked / completed) * 100 : 0

    // F0246: Get total calls and cost for this campaign
    const { data: calls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('cost, duration_seconds')
      .eq('campaign_id', campaignId)

    const totalCalls = calls?.length || 0
    const totalCost = calls?.reduce((sum, call) => sum + (call.cost || 0), 0) || 0
    const costPerCall = totalCalls > 0 ? totalCost / totalCalls : 0
    const costPerBooking = booked > 0 ? totalCost / booked : 0

    return {
      campaign_id: campaignId,
      total_contacts: total,
      completed,
      pending,
      in_progress: inProgress,
      booked,
      no_answer: noAnswer,
      voicemail,
      dnc,
      failed,
      progress_percent: progressPercent,
      conversion_rate: conversionRate,
      total_calls: totalCalls,
      total_cost: totalCost,
      cost_per_call: costPerCall,
      cost_per_booking: costPerBooking,
    }
  } catch (error) {
    console.error('Error getting campaign stats:', error)
    throw error
  }
}

/**
 * F0220: Export campaign report as CSV data
 */
export async function exportCampaignReport(campaignId: number): Promise<string> {
  try {
    // Get campaign info
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`)
    }

    // Get all contacts with call data
    const { data: contacts } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select(`
        *,
        contact:contact_id (
          name,
          email,
          phone,
          company
        )
      `)
      .eq('campaign_id', campaignId)

    if (!contacts || contacts.length === 0) {
      throw new Error('No contacts found for this campaign')
    }

    // Build CSV
    const headers = [
      'Contact Name',
      'Phone',
      'Email',
      'Company',
      'Status',
      'Outcome',
      'Attempts',
      'Last Attempt',
      'Booked At',
      'Call ID',
    ]

    let csv = headers.join(',') + '\n'

    for (const contact of contacts) {
      const row = [
        contact.contact?.name || '',
        contact.contact?.phone || '',
        contact.contact?.email || '',
        contact.contact?.company || '',
        contact.status || '',
        contact.outcome || '',
        contact.attempts || 0,
        contact.last_attempt_at || '',
        contact.booked_at || '',
        contact.last_call_id || '',
      ]

      csv += row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n'
    }

    return csv
  } catch (error) {
    console.error('Error exporting campaign report:', error)
    throw error
  }
}
