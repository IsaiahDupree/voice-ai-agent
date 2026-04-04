// F1154: Audit logging - All write operations logged to audit_log table
// F1155: Audit log immutability - audit_log rows cannot be updated or deleted

import { supabaseAdmin } from './supabase'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'START'
  | 'STOP'
  | 'PAUSE'
  | 'RESUME'
  | 'TRANSFER'
  | 'CONFIGURE'
  | 'LOGIN'
  | 'LOGOUT'

export interface AuditLogEntry {
  action: AuditAction
  resource: string // e.g., 'campaign', 'persona', 'contact'
  resourceId: string
  userId: string
  userName?: string
  changes?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  statusCode?: number
  error?: string
}

/**
 * F1154: Log an audit event
 * Write operations are logged to audit_log table
 * These logs are immutable (F1155)
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_audit_log').insert({
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId,
      user_id: entry.userId,
      user_name: entry.userName || null,
      changes: entry.changes || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      status_code: entry.statusCode || null,
      error: entry.error || null,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Fail-open: don't block requests if audit logging fails
    console.error('Failed to log audit event:', error)
  }
}

/**
 * Get audit logs for a resource
 * Used by dashboard and audit log viewer
 */
export async function getAuditLogs(params: {
  resource?: string
  resourceId?: string
  userId?: string
  action?: AuditAction
  limit?: number
  offset?: number
  startDate?: Date
  endDate?: Date
}): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_audit_log')
      .select('*')
      .order('created_at', { ascending: false })

    if (params.resource) {
      query = query.eq('resource', params.resource)
    }

    if (params.resourceId) {
      query = query.eq('resource_id', params.resourceId)
    }

    if (params.userId) {
      query = query.eq('user_id', params.userId)
    }

    if (params.action) {
      query = query.eq('action', params.action)
    }

    if (params.startDate) {
      query = query.gte('created_at', params.startDate.toISOString())
    }

    if (params.endDate) {
      query = query.lte('created_at', params.endDate.toISOString())
    }

    const limit = params.limit || 100
    const offset = params.offset || 0

    const { data, error } = await query.range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return data || []
  } catch (error: any) {
    console.error('Failed to fetch audit logs:', error)
    return []
  }
}

/**
 * Create a summary of changes for audit log
 * Useful for tracking what changed between versions
 */
export function createChangeSummary(before: any, after: any): Record<string, any> {
  const changes: Record<string, any> = {}

  // Compare all keys in 'after' with 'before'
  for (const key in after) {
    if (before[key] !== after[key]) {
      changes[key] = {
        from: before[key],
        to: after[key],
      }
    }
  }

  return changes
}
