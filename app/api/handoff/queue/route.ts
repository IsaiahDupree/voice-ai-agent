// F0657: Rep queue API - manage human handoff queue

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { addToQueue, getNextFromQueue, getQueueStats, completeQueueEntry } from '@/lib/rep-queue'

/**
 * F0657: GET queue status and entries
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'stats' or 'list'
    const repId = searchParams.get('rep_id')

    if (action === 'stats') {
      const stats = await getQueueStats()
      return apiSuccess(stats)
    }

    if (action === 'next' && repId) {
      const skills = searchParams.get('skills')?.split(',')
      const nextEntry = await getNextFromQueue(repId, skills)

      if (!nextEntry) {
        return apiSuccess({ message: 'No entries in queue', entry: null })
      }

      return apiSuccess({ entry: nextEntry })
    }

    // Default: list all queue entries
    const supabase = supabaseAdmin
    const { data: entries, error } = await supabase
      .from('rep_queue')
      .select('*, calls!inner(*), contacts!inner(*)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      return apiError(ErrorCodes.DATABASE_ERROR, `Failed to fetch queue: ${error.message}`, 500)
    }

    return apiSuccess({ entries })
  } catch (error: any) {
    console.error('Queue GET error:', error)
    return apiError(ErrorCodes.INTERNAL_ERROR, `Failed to get queue: ${error.message}`, 500)
  }
}

/**
 * F0657: POST - add call to queue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { call_id, contact_id, escalation_level, priority, skill_required } = body

    if (!call_id || !contact_id) {
      return apiError(ErrorCodes.BAD_REQUEST, 'Missing required fields: call_id, contact_id', 400)
    }

    const entry = await addToQueue({
      call_id,
      contact_id,
      escalation_level,
      priority,
      skill_required,
    })

    return apiSuccess(entry, { timestamp: new Date().toISOString() })
  } catch (error: any) {
    console.error('Queue POST error:', error)
    return apiError(ErrorCodes.INTERNAL_ERROR, `Failed to add to queue: ${error.message}`, 500)
  }
}

/**
 * F0657: PATCH - update queue entry status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { entry_id, status } = body

    if (!entry_id) {
      return apiError(ErrorCodes.BAD_REQUEST, 'Missing required field: entry_id', 400)
    }

    if (status === 'completed') {
      await completeQueueEntry(entry_id)
      return apiSuccess({ message: 'Queue entry completed', entry_id })
    }

    // Generic status update
    const supabase = supabaseAdmin
    const { data: updated, error } = await supabase
      .from('rep_queue')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', entry_id)
      .select()
      .single()

    if (error) {
      return apiError(ErrorCodes.DATABASE_ERROR, `Failed to update queue entry: ${error.message}`, 500)
    }

    return apiSuccess(updated)
  } catch (error: any) {
    console.error('Queue PATCH error:', error)
    return apiError(ErrorCodes.INTERNAL_ERROR, `Failed to update queue: ${error.message}`, 500)
  }
}
