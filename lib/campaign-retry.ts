// F0205: Retry delay configuration
// F0207: Retry on busy
// F0208: Retry on voicemail
// F0199: Voicemail drop text

import { supabaseAdmin } from './supabase'

export interface RetryConfig {
  campaign_id: number
  // F0205: Retry delay in minutes
  retry_delay_minutes: number
  // F0207: Retry when number is busy
  retry_on_busy: boolean
  // F0208: Retry when voicemail reached
  retry_on_voicemail: boolean
  // Maximum retry attempts
  max_attempts: number
  // F0199: Custom voicemail message text
  voicemail_message?: string
  created_at?: string
  updated_at?: string
}

/**
 * F0205: Set retry delay for campaign
 * F0207: Configure retry on busy
 * F0208: Configure retry on voicemail
 */
export async function setRetryConfig(config: Partial<RetryConfig>): Promise<void> {
  try {
    if (!config.campaign_id) {
      throw new Error('campaign_id is required')
    }

    const retryConfig: Partial<RetryConfig> = {
      ...config,
      updated_at: new Date().toISOString(),
    }

    // Upsert retry configuration
    await supabaseAdmin
      .from('voice_agent_campaign_retry_config')
      .upsert(retryConfig, { onConflict: 'campaign_id' })

    console.log(`Updated retry config for campaign ${config.campaign_id}`)
  } catch (error) {
    console.error('Error setting retry config:', error)
    throw error
  }
}

/**
 * F0205/F0207/F0208: Get retry configuration for campaign
 * Returns default config if none exists
 */
export async function getRetryConfig(campaignId: number): Promise<RetryConfig> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaign_retry_config')
      .select('*')
      .eq('campaign_id', campaignId)
      .single()

    if (error || !data) {
      // Return default config
      return {
        campaign_id: campaignId,
        retry_delay_minutes: 60, // F0205: Default 60 minute delay
        retry_on_busy: true, // F0207: Retry on busy by default
        retry_on_voicemail: true, // F0208: Retry on voicemail by default
        max_attempts: 3,
        voicemail_message: undefined,
      }
    }

    return data as RetryConfig
  } catch (error) {
    console.error('Error getting retry config:', error)
    throw error
  }
}

/**
 * F0207/F0208: Check if contact should be retried based on outcome
 */
export function shouldRetry(
  outcome: string,
  config: RetryConfig
): boolean {
  if (outcome === 'busy' && config.retry_on_busy) {
    return true
  }

  if (outcome === 'voicemail' && config.retry_on_voicemail) {
    return true
  }

  if (outcome === 'no-answer') {
    return true // Always retry no-answer
  }

  // Don't retry: booked, dnc, failed
  return false
}

/**
 * F0205: Schedule retry with configured delay
 * Returns scheduled time for next attempt
 */
export async function scheduleRetry(
  campaignId: number,
  contactId: number,
  outcome: string
): Promise<Date | null> {
  try {
    const config = await getRetryConfig(campaignId)

    // Check if we should retry this outcome
    if (!shouldRetry(outcome, config)) {
      console.log(`Not retrying contact ${contactId}: outcome=${outcome}`)
      return null
    }

    // Check if contact has exceeded max attempts
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('attempts')
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)
      .single()

    if (!contact || contact.attempts >= config.max_attempts) {
      console.log(`Max attempts reached for contact ${contactId}`)
      return null
    }

    // F0205: Calculate next attempt time with configured delay
    const nextAttempt = new Date()
    nextAttempt.setMinutes(nextAttempt.getMinutes() + config.retry_delay_minutes)

    // Update contact with scheduled retry
    await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .update({
        status: 'pending',
        next_attempt_at: nextAttempt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)

    console.log(`Scheduled retry for contact ${contactId} at ${nextAttempt.toISOString()}`)

    return nextAttempt
  } catch (error) {
    console.error('Error scheduling retry:', error)
    return null
  }
}

/**
 * F0199: Get voicemail drop message for campaign
 */
export async function getVoicemailMessage(campaignId: number): Promise<string> {
  try {
    const config = await getRetryConfig(campaignId)

    // F0199: Return custom voicemail message or default
    return config.voicemail_message ||
      `Hi, this is a message from our team. We're sorry we missed you. We'll try calling again soon, or you can call us back at your convenience. Thank you!`
  } catch (error) {
    console.error('Error getting voicemail message:', error)
    return 'We tried to reach you but missed you. We will try again soon.'
  }
}
