// F0459, F0460, F0461: Real-time transcript streaming via Supabase Realtime

import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * F0460: Broadcast transcript update via Supabase Realtime channel
 * Supports partial segments for real-time streaming
 */
export async function broadcastTranscriptUpdate(
  callId: string,
  update: {
    segment?: {
      role: 'user' | 'assistant'
      content: string
      timestamp?: number
      partial?: boolean // F0461: Partial segment support
    }
    status?: 'started' | 'streaming' | 'completed'
    metadata?: Record<string, any>
  }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Broadcast to the call-specific channel
    const channel = supabase.channel(`transcript:${callId}`)

    await channel.send({
      type: 'broadcast',
      event: 'transcript_update',
      payload: {
        call_id: callId,
        timestamp: Date.now(),
        ...update,
      },
    })

    console.log(`[Transcript Stream] Broadcasted update for call ${callId}`)
  } catch (error) {
    console.error('[Transcript Stream] Broadcast failed:', error)
    // Fail-open: don't block on broadcast failures
  }
}

/**
 * F0461: Stream partial transcript segments as they arrive
 * This simulates Deepgram's real-time transcription updates
 */
export async function streamPartialSegment(
  callId: string,
  segment: {
    role: 'user' | 'assistant'
    content: string
    partial: boolean
    timestamp: number
  }
) {
  await broadcastTranscriptUpdate(callId, {
    segment: {
      ...segment,
      partial: segment.partial,
    },
    status: segment.partial ? 'streaming' : 'completed',
  })
}

/**
 * F0459: Start real-time transcript stream for a call
 * Called when a call begins
 */
export async function startTranscriptStream(callId: string) {
  await broadcastTranscriptUpdate(callId, {
    status: 'started',
    metadata: {
      started_at: new Date().toISOString(),
    },
  })
}

/**
 * F0459: End real-time transcript stream for a call
 * Called when a call ends
 */
export async function endTranscriptStream(callId: string) {
  await broadcastTranscriptUpdate(callId, {
    status: 'completed',
    metadata: {
      ended_at: new Date().toISOString(),
    },
  })
}

/**
 * Client-side hook for subscribing to transcript updates
 * Used in React components
 */
export interface TranscriptStreamUpdate {
  call_id: string
  timestamp: number
  segment?: {
    role: 'user' | 'assistant'
    content: string
    timestamp?: number
    partial?: boolean
  }
  status?: 'started' | 'streaming' | 'completed'
  metadata?: Record<string, any>
}

export type TranscriptStreamCallback = (update: TranscriptStreamUpdate) => void

/**
 * F0460: Subscribe to real-time transcript updates for a call
 * Returns unsubscribe function
 */
export function subscribeToTranscript(
  callId: string,
  callback: TranscriptStreamCallback
): () => void {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const channel = supabase.channel(`transcript:${callId}`)

  channel
    .on('broadcast', { event: 'transcript_update' }, ({ payload }) => {
      callback(payload as TranscriptStreamUpdate)
    })
    .subscribe()

  console.log(`[Transcript Stream] Subscribed to call ${callId}`)

  // Return unsubscribe function
  return () => {
    channel.unsubscribe()
    console.log(`[Transcript Stream] Unsubscribed from call ${callId}`)
  }
}

/**
 * F0461: Handle partial transcript segments
 * Merges partial segments into final complete segment
 */
export class PartialSegmentBuffer {
  private buffer: Map<string, string> = new Map()

  /**
   * Add partial segment content
   * Returns complete segment if this is the final partial, null otherwise
   */
  addPartial(
    segmentId: string,
    content: string,
    isFinal: boolean
  ): string | null {
    const existing = this.buffer.get(segmentId) || ''
    const updated = existing + content

    if (isFinal) {
      this.buffer.delete(segmentId)
      return updated
    } else {
      this.buffer.set(segmentId, updated)
      return null
    }
  }

  /**
   * Get current partial content for a segment
   */
  getPartial(segmentId: string): string {
    return this.buffer.get(segmentId) || ''
  }

  /**
   * Clear buffer for a segment
   */
  clear(segmentId: string) {
    this.buffer.delete(segmentId)
  }

  /**
   * Clear all buffers
   */
  clearAll() {
    this.buffer.clear()
  }
}
