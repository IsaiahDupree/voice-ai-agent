// F1174: Consent logging - Log recording consent acknowledgment

import { supabaseAdmin } from './supabase'

interface ConsentLog {
  id?: string
  call_id: string
  consent_type: 'recording' | 'transcript' | 'analytics' | 'followup'
  granted: boolean
  method: 'voice' | 'dtmf' | 'api' | 'manual'
  user_ip?: string
  user_agent?: string
  created_at?: string
}

/**
 * F1174: Log recording consent acknowledgment
 * Records when caller consents to call recording
 */
export async function logConsentGiven(consent: ConsentLog): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('consent_logs')
      .insert({
        ...consent,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    return {
      success: true,
      id: data?.id,
    }
  } catch (error: any) {
    console.error('Error logging consent:', error)
    return {
      success: false,
      error: error.message || 'Failed to log consent',
    }
  }
}

/**
 * Get consent log for a call
 */
export async function getCallConsentLog(callId: string): Promise<{
  data: ConsentLog | null
  error?: string
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('consent_logs')
      .select('*')
      .eq('call_id', callId)
      .eq('consent_type', 'recording')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return {
      data: data || null,
    }
  } catch (error: any) {
    console.error('Error fetching consent log:', error)
    return {
      data: null,
      error: error.message || 'Failed to fetch consent log',
    }
  }
}

/**
 * Check if consent was granted for a call
 */
export async function wasConsentGranted(callId: string): Promise<boolean> {
  const { data, error } = await getCallConsentLog(callId)

  if (error || !data) {
    return false
  }

  return data.granted === true
}

/**
 * Log all consent changes for compliance audit
 */
export async function logConsentAudit(
  callId: string,
  changes: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('consent_audit_logs')
      .insert({
        call_id: callId,
        changes,
        timestamp: new Date().toISOString(),
        ip_address: changes.user_ip,
      })

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error logging consent audit:', error)
    return {
      success: false,
      error: error.message || 'Failed to log consent audit',
    }
  }
}

/**
 * Update consent status for a call
 */
export async function updateCallConsent(
  callId: string,
  granted: boolean,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: updateError } = await supabaseAdmin
      .from('consent_logs')
      .update({
        granted,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', callId)

    if (updateError) {
      throw updateError
    }

    // Audit log
    if (reason) {
      await logConsentAudit(callId, {
        action: 'update',
        granted,
        reason,
      })
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error updating consent:', error)
    return {
      success: false,
      error: error.message || 'Failed to update consent',
    }
  }
}

/**
 * Get consent logs for compliance reporting
 */
export async function getConsentLogsForPeriod(
  startDate: Date,
  endDate: Date
): Promise<{
  logs: ConsentLog[]
  total: number
  granted: number
  denied: number
  error?: string
}> {
  try {
    const { data, error, count } = await supabaseAdmin
      .from('consent_logs')
      .select('*', { count: 'exact' })
      .eq('consent_type', 'recording')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) {
      throw error
    }

    const logs = (data || []) as ConsentLog[]
    const granted = logs.filter((l) => l.granted).length
    const denied = logs.length - granted

    return {
      logs,
      total: count || 0,
      granted,
      denied,
    }
  } catch (error: any) {
    console.error('Error fetching consent logs:', error)
    return {
      logs: [],
      total: 0,
      granted: 0,
      denied: 0,
      error: error.message || 'Failed to fetch consent logs',
    }
  }
}
