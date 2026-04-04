// F0254: Campaign audit log
// Log all campaign state changes with timestamp

import { supabaseAdmin } from './supabase'

export interface CampaignAuditLog {
  id?: number
  campaign_id: number
  action: 'created' | 'started' | 'paused' | 'resumed' | 'stopped' | 'completed' | 'config_updated' | 'contact_added' | 'contact_removed'
  actor?: string // User ID or 'system'
  metadata?: Record<string, any>
  timestamp: string
}

/**
 * F0254: Log campaign state change
 */
export async function logCampaignAction(log: Omit<CampaignAuditLog, 'id'>): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_campaign_audit_log').insert({
      campaign_id: log.campaign_id,
      action: log.action,
      actor: log.actor || 'system',
      metadata: log.metadata || {},
      timestamp: log.timestamp || new Date().toISOString(),
    })

    console.log(`Audit: Campaign ${log.campaign_id} - ${log.action} by ${log.actor || 'system'}`)
  } catch (error) {
    console.error('Error logging campaign action:', error)
    // Don't throw - audit logging failures shouldn't break main flow
  }
}

/**
 * F0254: Get audit log for campaign
 */
export async function getCampaignAuditLog(
  campaignId: number,
  limit: number = 100
): Promise<CampaignAuditLog[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaign_audit_log')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data as CampaignAuditLog[]) || []
  } catch (error) {
    console.error('Error getting campaign audit log:', error)
    return []
  }
}

/**
 * F0250: Check if contact had recent interaction (skip logic)
 * Returns true if contact was called in last 24 hours
 */
export async function hasRecentInteraction(
  contactId: number,
  hoursAgo: number = 24
): Promise<boolean> {
  try {
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - hoursAgo)

    const { data } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('last_attempt_at')
      .eq('contact_id', contactId)
      .gte('last_attempt_at', cutoff.toISOString())
      .limit(1)

    return !!data && data.length > 0
  } catch (error) {
    console.error('Error checking recent interaction:', error)
    return false
  }
}

/**
 * F0261: Check campaign cooldown
 * Returns true if contact should be excluded due to cooldown period
 */
export async function isInCooldown(
  campaignId: number,
  contactId: number,
  cooldownHours: number = 24
): Promise<boolean> {
  try {
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - cooldownHours)

    const { data } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('last_attempt_at')
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)
      .gte('last_attempt_at', cutoff.toISOString())
      .single()

    return !!data
  } catch (error) {
    // No record or error means not in cooldown
    return false
  }
}
