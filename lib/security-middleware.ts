// F1135: API key scopes - API keys have permission scopes
// F1156: PII access logging - Log access to contact PII fields
// F1160: IP allowlist - Optional IP allowlist for API access
// F1177: Bot detection - Block automated inbound calls (SIP scanners)
// F1181: API key last used - Track last_used_at on API keys
// F1480: Call spam detection - Flag callers who call > 10x/hour

import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase'

export type APIKeyScope =
  | 'calls:read'
  | 'calls:write'
  | 'contacts:read'
  | 'contacts:write'
  | 'campaigns:read'
  | 'campaigns:write'
  | 'sms:send'
  | 'admin:all'

// F1135: Check if API key has required scope
export async function verifyAPIKeyScope(apiKey: string, requiredScope: APIKeyScope): Promise<boolean> {
  try {
    const { data: key, error } = await supabaseAdmin
      .from('voice_agent_api_keys')
      .select('scopes, active, expires_at')
      .eq('key_hash', hashAPIKey(apiKey))
      .single()

    if (error || !key || !key.active) {
      return false
    }

    // Check expiration
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return false
    }

    const scopes: APIKeyScope[] = key.scopes || []

    // admin:all grants access to everything
    if (scopes.includes('admin:all')) {
      return true
    }

    return scopes.includes(requiredScope)
  } catch (error) {
    console.error('Error verifying API key scope:', error)
    return false
  }
}

// F1181: Track last_used_at on API keys
export async function trackAPIKeyUsage(apiKey: string, endpoint: string) {
  try {
    const keyHash = hashAPIKey(apiKey)

    // Note: usage_count increment would require RPC function or fetch+update pattern
    await supabaseAdmin
      .from('voice_agent_api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        last_used_endpoint: endpoint,
      })
      .eq('key_hash', keyHash)
  } catch (error) {
    console.error('Error tracking API key usage:', error)
    // Don't throw - this is best-effort tracking
  }
}

// F1160: IP allowlist check
export async function checkIPAllowlist(ip: string, apiKey: string): Promise<boolean> {
  try {
    const keyHash = hashAPIKey(apiKey)

    const { data: key } = await supabaseAdmin
      .from('voice_agent_api_keys')
      .select('ip_allowlist')
      .eq('key_hash', keyHash)
      .single()

    if (!key || !key.ip_allowlist || key.ip_allowlist.length === 0) {
      // No allowlist configured, allow all IPs
      return true
    }

    return key.ip_allowlist.includes(ip)
  } catch (error) {
    console.error('Error checking IP allowlist:', error)
    // Fail open for availability
    return true
  }
}

// F1156: Log PII access
export async function logPIIAccess(userId: string, contactId: string, fields: string[], action: 'read' | 'write') {
  try {
    await supabaseAdmin.from('voice_agent_pii_access_logs').insert({
      user_id: userId,
      contact_id: contactId,
      fields_accessed: fields,
      action,
      accessed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error logging PII access:', error)
    // Don't throw - logging is best-effort
  }
}

// F1177: Bot detection - Detect automated callers/SIP scanners
export async function detectBot(callerNumber: string, callPattern: any): Promise<boolean> {
  try {
    // Check for known bot patterns:
    // 1. Multiple calls in very short time
    // 2. Sequential number ranges
    // 3. Known SIP scanner IPs

    const { data: recentCalls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id, started_at')
      .eq('from_number', callerNumber)
      .gte('started_at', new Date(Date.now() - 60000).toISOString()) // Last minute
      .order('started_at', { ascending: false })

    if (recentCalls && recentCalls.length >= 5) {
      console.warn(`Bot detected: ${callerNumber} made ${recentCalls.length} calls in 1 minute`)
      return true
    }

    // Check for sequential number pattern (SIP scanners)
    if (/^1\d{3}00[0-9]{5}$/.test(callerNumber)) {
      console.warn(`Bot detected: Sequential number pattern ${callerNumber}`)
      return true
    }

    return false
  } catch (error) {
    console.error('Error in bot detection:', error)
    return false
  }
}

// F1480: Call spam detection - Flag callers who call > 10x/hour
export async function detectCallSpam(callerNumber: string): Promise<{ isSpam: boolean; callCount: number }> {
  try {
    const { data: recentCalls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id')
      .eq('from_number', callerNumber)
      .gte('started_at', new Date(Date.now() - 3600000).toISOString()) // Last hour

    const callCount = recentCalls?.length || 0
    const isSpam = callCount > 10

    if (isSpam) {
      console.warn(`Spam detected: ${callerNumber} made ${callCount} calls in 1 hour`)

      // Log spam detection
      await supabaseAdmin.from('voice_agent_spam_detections').insert({
        phone_number: callerNumber,
        detection_type: 'call_spam',
        call_count: callCount,
        detected_at: new Date().toISOString(),
      })
    }

    return { isSpam, callCount }
  } catch (error) {
    console.error('Error in spam detection:', error)
    return { isSpam: false, callCount: 0 }
  }
}

function hashAPIKey(apiKey: string): string {
  // In production, use proper hashing (bcrypt, argon2)
  // For now, simple hash for demo purposes
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}
