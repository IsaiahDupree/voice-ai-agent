// F0473: Transcript access control
// Only users with access to call can view transcript

import { supabaseAdmin } from './supabase'

export interface TranscriptAccessCheck {
  hasAccess: boolean
  reason?: string
}

/**
 * F0473: Check if user has access to view transcript
 * Access granted if:
 * 1. User owns the call (their phone number)
 * 2. User is an admin (via x-admin-key header)
 * 3. Call belongs to user's organization (org_id match)
 */
export async function checkTranscriptAccess(
  callId: string,
  userId?: string,
  userPhone?: string,
  orgId?: string,
  isAdmin: boolean = false
): Promise<TranscriptAccessCheck> {
  // Admin bypass
  if (isAdmin) {
    return { hasAccess: true, reason: 'admin' }
  }

  try {
    // Fetch call details
    const { data: call, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('id, from_number, to_number, org_id, contact_id')
      .eq('call_id', callId)
      .single()

    if (error || !call) {
      return {
        hasAccess: false,
        reason: 'call_not_found',
      }
    }

    // Check phone number match (for end users)
    if (userPhone) {
      const normalizedUserPhone = normalizePhone(userPhone)
      const fromMatch = normalizePhone(call.from_number) === normalizedUserPhone
      const toMatch = normalizePhone(call.to_number) === normalizedUserPhone

      if (fromMatch || toMatch) {
        return { hasAccess: true, reason: 'phone_match' }
      }
    }

    // Check org_id match (for multi-tenant setups)
    if (orgId && call.org_id && call.org_id === orgId) {
      return { hasAccess: true, reason: 'org_match' }
    }

    // No access
    return {
      hasAccess: false,
      reason: 'unauthorized',
    }
  } catch (error) {
    console.error('[Transcript Access] Error checking access:', error)
    return {
      hasAccess: false,
      reason: 'error',
    }
  }
}

/**
 * Helper: Normalize phone number for comparison
 * Removes +, spaces, dashes, parentheses
 */
function normalizePhone(phone?: string): string {
  if (!phone) return ''
  return phone.replace(/[^\d]/g, '')
}

/**
 * F0473: Middleware to check transcript access
 * Use in API routes: const access = await requireTranscriptAccess(callId, request)
 */
export async function requireTranscriptAccess(
  callId: string,
  request: Request
): Promise<TranscriptAccessCheck> {
  // Extract auth info from headers
  const adminKey = request.headers.get('x-admin-key')
  const userPhone = request.headers.get('x-user-phone')
  const userId = request.headers.get('x-user-id')
  const orgId = request.headers.get('x-org-id')

  const isAdmin = !!(
    adminKey &&
    process.env.ADMIN_API_KEY &&
    adminKey === process.env.ADMIN_API_KEY
  )

  return checkTranscriptAccess(callId, userId || undefined, userPhone || undefined, orgId || undefined, isAdmin)
}
