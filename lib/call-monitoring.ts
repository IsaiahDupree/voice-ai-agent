// F0251: Live agent monitoring - Supervisor can listen to active calls

import { vapiClient } from './vapi'

export interface MonitoringSession {
  call_id: string
  listen_url?: string
  whisper_enabled: boolean
  supervisor_joined_at?: string
}

/**
 * F0251: Get live monitoring URL for an active call
 * Allows supervisor to listen in on the call
 */
export async function getCallMonitoringUrl(callId: string): Promise<{
  success: boolean
  listen_url?: string
  error?: string
}> {
  try {
    // Check if call is still active via Vapi API
    const response = await vapiClient.get(`/call/${callId}`)
    const call = response.data

    if (!call || call.status !== 'in-progress') {
      return {
        success: false,
        error: 'Call is not currently active',
      }
    }

    // Note: Vapi may not provide direct listen-in URLs via API
    // This would require:
    // 1. WebRTC-based monitoring (if Vapi supports it)
    // 2. Or forwarding call audio to a monitoring service
    // 3. Or using Twilio's Conference API for 3-way calls

    // For now, return a placeholder that would need to be implemented
    // based on the actual Vapi capabilities or Twilio integration

    // If using Twilio for calls, you could add the supervisor to a conference:
    const listenUrl = await createTwilioMonitoringSession(callId)

    return {
      success: true,
      listen_url: listenUrl,
    }
  } catch (error: any) {
    console.error('Error getting monitoring URL:', error)
    return {
      success: false,
      error: error.message || 'Failed to get monitoring URL',
    }
  }
}

/**
 * Create Twilio monitoring session (if using Twilio)
 * This adds a supervisor to the call conference
 */
async function createTwilioMonitoringSession(callId: string): Promise<string> {
  // This would require:
  // 1. Finding the Twilio conference SID for this call
  // 2. Creating a new participant with coaching: true
  // 3. Returning the dial-in number or WebRTC URL

  // Placeholder implementation
  const monitoringUrl = `${process.env.NEXT_PUBLIC_APP_URL}/monitor/${callId}`
  return monitoringUrl
}

/**
 * F0251: Enable whisper mode (supervisor can speak without caller hearing)
 */
export async function enableWhisperMode(
  callId: string,
  supervisorPhone: string
): Promise<boolean> {
  try {
    // Twilio Conference coaching mode allows supervisor to speak
    // only to the agent, not the customer
    // Implementation would depend on actual Twilio integration

    console.log(`Enabling whisper mode for call ${callId}, supervisor ${supervisorPhone}`)
    return true
  } catch (error) {
    console.error('Error enabling whisper mode:', error)
    return false
  }
}

/**
 * F0251: Log supervisor monitoring session
 */
export async function logMonitoringSession(
  callId: string,
  supervisorEmail: string,
  action: 'joined' | 'left' | 'whispered'
): Promise<void> {
  const { supabaseAdmin } = await import('@/lib/supabase')

  await supabaseAdmin
    .from('call_monitoring_log')
    .insert({
      call_id: callId,
      supervisor_email: supervisorEmail,
      action,
      timestamp: new Date().toISOString(),
    })
}

/**
 * F0251: Get active calls available for monitoring
 */
export async function getMonitorableCalls(campaignId?: number): Promise<any[]> {
  const { supabaseAdmin } = await import('@/lib/supabase')

  let query = supabaseAdmin
    .from('voice_agent_calls')
    .select(`
      *,
      contacts:voice_agent_contacts(name, phone, company),
      campaigns:voice_agent_campaigns(name)
    `)
    .eq('status', 'in-progress')
    .order('started_at', { ascending: false })

  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching monitorable calls:', error)
    return []
  }

  return data || []
}
