// F0655: Handoff dashboard alerts - notify reps of escalations and queue changes

import { supabaseAdmin } from '@/lib/supabase'

export interface DashboardAlert {
  id?: string
  type: 'escalation' | 'queue_entry' | 'sla_breach' | 'transfer_request'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  call_id?: string
  contact_id?: string
  assigned_to?: string[]
  metadata?: Record<string, any>
  created_at?: string
  read?: boolean
}

/**
 * F0655: Create dashboard alert
 */
export async function createDashboardAlert(alert: DashboardAlert): Promise<DashboardAlert> {
  const supabase = supabaseAdmin

  const { data, error } = await supabase
    .from('dashboard_alerts')
    .insert({
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      call_id: alert.call_id,
      contact_id: alert.contact_id,
      metadata: alert.metadata,
      created_at: new Date().toISOString(),
      read: false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create alert: ${error.message}`)
  }

  // Send real-time notification if assigned to specific reps
  if (alert.assigned_to && alert.assigned_to.length > 0) {
    // In production, use WebSocket or SSE to push to connected clients
    console.log(`🔔 Alert created for reps: ${alert.assigned_to.join(', ')}`)
  }

  return data as DashboardAlert
}

/**
 * F0655: Alert on escalation created
 */
export async function alertOnEscalation(data: {
  call_id: string
  level: string
  reason: string
  assigned_to?: string
}): Promise<void> {
  const severity = data.level === 'critical' ? 'critical' : data.level === 'high' ? 'warning' : 'info'

  await createDashboardAlert({
    type: 'escalation',
    severity,
    title: `${data.level.toUpperCase()} Escalation`,
    message: `Call ${data.call_id} escalated: ${data.reason}`,
    call_id: data.call_id,
    assigned_to: data.assigned_to ? [data.assigned_to] : undefined,
    metadata: { level: data.level, reason: data.reason },
  })
}

/**
 * F0655: Alert on SLA breach
 */
export async function alertOnSLABreach(data: {
  call_id: string
  escalation_level: string
  elapsed_minutes: number
  sla_minutes: number
}): Promise<void> {
  await createDashboardAlert({
    type: 'sla_breach',
    severity: 'critical',
    title: 'SLA Breach',
    message: `Call ${data.call_id} exceeded SLA: ${data.elapsed_minutes}min (limit: ${data.sla_minutes}min)`,
    call_id: data.call_id,
    metadata: data,
  })
}

/**
 * F0655: Alert on new queue entry
 */
export async function alertOnQueueEntry(data: {
  call_id: string
  contact_id: string
  priority: number
  escalation_level: string
}): Promise<void> {
  const severity = data.priority >= 8 ? 'critical' : data.priority >= 5 ? 'warning' : 'info'

  await createDashboardAlert({
    type: 'queue_entry',
    severity,
    title: 'New Queue Entry',
    message: `Call ${data.call_id} added to queue (priority: ${data.priority})`,
    call_id: data.call_id,
    contact_id: data.contact_id,
    metadata: data,
  })
}

/**
 * F0655: Get unread alerts for rep
 */
export async function getUnreadAlerts(repId?: string): Promise<DashboardAlert[]> {
  const supabase = supabaseAdmin

  let query = supabase
    .from('dashboard_alerts')
    .select('*')
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(50)

  // TODO: Filter by assigned_to if repId provided
  // This requires a JSON query on the assigned_to array

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch alerts: ${error.message}`)
  }

  return (data || []) as DashboardAlert[]
}

/**
 * F0655: Mark alert as read
 */
export async function markAlertRead(alertId: string): Promise<void> {
  const supabase = supabaseAdmin

  await supabase
    .from('dashboard_alerts')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', alertId)
}
