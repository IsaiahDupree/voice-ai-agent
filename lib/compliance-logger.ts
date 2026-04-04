import { supabaseAdmin } from './supabase'

// F0166: Inbound compliance logging - Immutable audit log for all inbound interactions
// F0227: TCPA compliance logging - Track consent and compliance events

export interface ComplianceLogEntry {
  event_type: 'call_received' | 'call_answered' | 'call_ended' | 'consent_given' | 'consent_revoked' | 'dnc_request' | 'transfer' | 'recording_started' | 'recording_stopped' | 'booking_made' | 'sms_sent'
  call_id?: string
  contact_id?: string
  phone_number: string
  event_data: Record<string, any>
  timestamp: string
  ip_address?: string
  user_agent?: string
}

/**
 * F0166: Log compliance event to immutable audit log
 * All inbound/outbound interactions are logged for regulatory compliance
 */
export async function logComplianceEvent(entry: ComplianceLogEntry): Promise<void> {
  try {
    // Insert into compliance_log table (should have RLS policy preventing updates/deletes)
    await supabaseAdmin.from('voice_agent_compliance_log').insert({
      event_type: entry.event_type,
      call_id: entry.call_id,
      contact_id: entry.contact_id,
      phone_number: entry.phone_number,
      event_data: entry.event_data,
      timestamp: entry.timestamp || new Date().toISOString(),
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      // Note: This table should have a policy that prevents UPDATE and DELETE
      // to ensure immutability for compliance purposes
    })

    console.log(`Compliance log: ${entry.event_type} for ${entry.phone_number}`)
  } catch (error) {
    // Critical: Compliance logging failure should be monitored
    console.error('CRITICAL: Compliance logging failed:', error)
    // In production, send alert to monitoring system
  }
}

/**
 * F0227: Log TCPA consent event
 */
export async function logConsentEvent(params: {
  phone_number: string
  consent_type: 'voice' | 'sms' | 'both'
  consent_given: boolean
  call_id?: string
  contact_id?: string
  method: 'verbal' | 'web_form' | 'written' | 'implied'
  recording_url?: string
}) {
  await logComplianceEvent({
    event_type: params.consent_given ? 'consent_given' : 'consent_revoked',
    call_id: params.call_id,
    contact_id: params.contact_id,
    phone_number: params.phone_number,
    event_data: {
      consent_type: params.consent_type,
      method: params.method,
      recording_url: params.recording_url, // F0227: Link to recording of verbal consent
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * F0166: Log call interaction for compliance
 */
export async function logCallInteraction(params: {
  event_type: 'call_received' | 'call_answered' | 'call_ended'
  call_id: string
  phone_number: string
  direction: 'inbound' | 'outbound'
  duration_seconds?: number
  outcome?: string
  recording_url?: string
}) {
  await logComplianceEvent({
    event_type: params.event_type,
    call_id: params.call_id,
    phone_number: params.phone_number,
    event_data: {
      direction: params.direction,
      duration_seconds: params.duration_seconds,
      outcome: params.outcome,
      recording_url: params.recording_url,
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * F0166: Log DNC request for compliance
 */
export async function logDNCRequest(params: {
  phone_number: string
  call_id?: string
  method: 'voice_call' | 'sms' | 'web_form' | 'manual'
  reason?: string
}) {
  await logComplianceEvent({
    event_type: 'dnc_request',
    call_id: params.call_id,
    phone_number: params.phone_number,
    event_data: {
      method: params.method,
      reason: params.reason,
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * Query compliance log for a specific phone number
 */
export async function getComplianceHistory(phone_number: string) {
  const { data, error } = await supabaseAdmin
    .from('voice_agent_compliance_log')
    .select('*')
    .eq('phone_number', phone_number)
    .order('timestamp', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching compliance history:', error)
    return []
  }

  return data || []
}

/**
 * Generate compliance report for date range
 */
export async function generateComplianceReport(params: {
  start_date: string
  end_date: string
  event_types?: string[]
}) {
  let query = supabaseAdmin
    .from('voice_agent_compliance_log')
    .select('*')
    .gte('timestamp', params.start_date)
    .lte('timestamp', params.end_date)

  if (params.event_types && params.event_types.length > 0) {
    query = query.in('event_type', params.event_types)
  }

  const { data, error } = await query.order('timestamp', { ascending: true })

  if (error) {
    console.error('Error generating compliance report:', error)
    return []
  }

  return data || []
}
