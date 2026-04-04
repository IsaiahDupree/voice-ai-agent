// F0657: Rep queue - manage queue of calls waiting for human reps

import { supabaseAdmin } from '@/lib/supabase'

export interface QueueEntry {
  id: string
  call_id: string
  contact_id: string
  escalation_level: string
  priority: number
  status: 'waiting' | 'assigned' | 'in_progress' | 'completed' | 'abandoned'
  assigned_to?: string
  wait_time_seconds?: number
  created_at: string
  assigned_at?: string
  completed_at?: string
}

/**
 * F0657: Add call to rep queue
 */
export async function addToQueue(data: {
  call_id: string
  contact_id: string
  escalation_level?: string
  priority?: number
  skill_required?: string
}): Promise<QueueEntry> {
  const supabase = supabaseAdmin

  const { data: queueEntry, error } = await supabase
    .from('rep_queue')
    .insert({
      call_id: data.call_id,
      contact_id: data.contact_id,
      escalation_level: data.escalation_level || 'medium',
      priority: data.priority || 5,
      skill_required: data.skill_required,
      status: 'waiting',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add to queue: ${error.message}`)
  }

  return queueEntry as QueueEntry
}

/**
 * F0657: Get next call from queue for rep
 */
export async function getNextFromQueue(repId: string, skills?: string[]): Promise<QueueEntry | null> {
  const supabase = supabaseAdmin

  // Build query - prioritize by priority (desc) and created_at (asc)
  let query = supabase
    .from('rep_queue')
    .select('*')
    .eq('status', 'waiting')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)

  // Filter by rep skills if provided
  if (skills && skills.length > 0) {
    query = query.or(
      `skill_required.is.null,skill_required.in.(${skills.join(',')})`
    )
  }

  const { data: entries } = await query

  if (!entries || entries.length === 0) {
    return null
  }

  const entry = entries[0]

  // Assign to rep
  const { data: assigned, error } = await supabase
    .from('rep_queue')
    .update({
      status: 'assigned',
      assigned_to: repId,
      assigned_at: new Date().toISOString(),
    })
    .eq('id', entry.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to assign queue entry: ${error.message}`)
  }

  return assigned as QueueEntry
}

/**
 * F0657: Get queue status/stats
 */
export async function getQueueStats(): Promise<{
  total: number
  waiting: number
  assigned: number
  in_progress: number
  avg_wait_time_seconds: number
  by_level: Record<string, number>
}> {
  const supabase = supabaseAdmin

  const { data: entries } = await supabase
    .from('rep_queue')
    .select('status, escalation_level, created_at, assigned_at')

  if (!entries) {
    return {
      total: 0,
      waiting: 0,
      assigned: 0,
      in_progress: 0,
      avg_wait_time_seconds: 0,
      by_level: {},
    }
  }

  const now = new Date()
  const waitTimes = entries
    .filter((e) => e.status === 'waiting')
    .map((e) => {
      const created = new Date(e.created_at)
      return (now.getTime() - created.getTime()) / 1000
    })

  const avgWaitTime = waitTimes.length > 0
    ? waitTimes.reduce((sum, t) => sum + t, 0) / waitTimes.length
    : 0

  const byLevel: Record<string, number> = {}
  entries.forEach((e) => {
    byLevel[e.escalation_level] = (byLevel[e.escalation_level] || 0) + 1
  })

  return {
    total: entries.length,
    waiting: entries.filter((e) => e.status === 'waiting').length,
    assigned: entries.filter((e) => e.status === 'assigned').length,
    in_progress: entries.filter((e) => e.status === 'in_progress').length,
    avg_wait_time_seconds: Math.round(avgWaitTime),
    by_level: byLevel,
  }
}

/**
 * F0657: Mark queue entry as completed
 */
export async function completeQueueEntry(queueEntryId: string): Promise<void> {
  const supabase = supabaseAdmin

  await supabase
    .from('rep_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', queueEntryId)
}
