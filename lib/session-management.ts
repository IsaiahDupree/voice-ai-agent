// F1157: Session invalidation - Logout invalidates all active sessions
// F1158: Session timeout - Sessions expire after 24h of inactivity

import { supabaseAdmin } from './supabase'

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * F1158: Check if session is still valid
 * Sessions expire after 24h of inactivity
 */
export function isSessionValid(lastActivity: Date): boolean {
  const now = Date.now()
  const lastActivityTime = lastActivity.getTime()
  const inactivityDuration = now - lastActivityTime

  return inactivityDuration < SESSION_TIMEOUT_MS
}

/**
 * Update session last activity time
 * Called on each request to track inactivity
 */
export async function updateSessionActivity(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('sessions')
      .update({
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      throw error
    }

    return true
  } catch (error: any) {
    console.error('Error updating session activity:', error)
    return false
  }
}

/**
 * F1157: Invalidate all sessions for a user
 * Called on logout to invalidate all active sessions
 */
export async function invalidateAllUserSessions(
  userId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Get all active sessions for user
    const { data: sessions, error: fetchError } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')

    if (fetchError) {
      throw fetchError
    }

    if (!sessions || sessions.length === 0) {
      return { success: true, count: 0 }
    }

    // Invalidate all sessions
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({
        status: 'invalidated',
        invalidated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active')

    if (updateError) {
      throw updateError
    }

    console.log(`[Session Management] Invalidated ${sessions.length} sessions for user ${userId}`)

    return {
      success: true,
      count: sessions.length,
    }
  } catch (error: any) {
    console.error('Error invalidating sessions:', error)
    return {
      success: false,
      error: error.message || 'Failed to invalidate sessions',
    }
  }
}

/**
 * F1157: Invalidate a specific session
 */
export async function invalidateSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('sessions')
      .update({
        status: 'invalidated',
        invalidated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      throw error
    }

    return true
  } catch (error: any) {
    console.error('Error invalidating session:', error)
    return false
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // Filter out timed-out sessions (F1158)
    return (data || []).filter((session) =>
      isSessionValid(new Date(session.last_activity))
    )
  } catch (error: any) {
    console.error('Error getting user sessions:', error)
    return []
  }
}

/**
 * Clean up expired sessions (maintenance task)
 * Should be run periodically (e.g., every hour)
 */
export async function cleanupExpiredSessions(): Promise<{
  success: boolean
  deletedCount?: number
  error?: string
}> {
  try {
    const expiryTime = new Date(Date.now() - SESSION_TIMEOUT_MS)

    const { data: expired, error: fetchError } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('status', 'active')
      .lt('last_activity', expiryTime.toISOString())

    if (fetchError) {
      throw fetchError
    }

    if (!expired || expired.length === 0) {
      return { success: true, deletedCount: 0 }
    }

    // Mark as expired
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({
        status: 'expired',
        expired_at: new Date().toISOString(),
      })
      .eq('status', 'active')
      .lt('last_activity', expiryTime.toISOString())

    if (updateError) {
      throw updateError
    }

    console.log(`[Session Management] Cleaned up ${expired.length} expired sessions`)

    return {
      success: true,
      deletedCount: expired.length,
    }
  } catch (error: any) {
    console.error('Error cleaning up sessions:', error)
    return {
      success: false,
      error: error.message || 'Failed to cleanup sessions',
    }
  }
}
