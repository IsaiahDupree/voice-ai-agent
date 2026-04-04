// F0501: Transcript ingestion queue API

import { NextRequest, NextResponse } from 'next/server'
import {
  enqueueTranscriptProcessing,
  processTranscriptQueue,
  getQueueStats,
} from '@/lib/transcript-queue'

/**
 * POST /api/transcripts/queue
 * F0501: Add transcript to processing queue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { callId, deepgramResponse } = body

    if (!callId || !deepgramResponse) {
      return NextResponse.json(
        { error: 'callId and deepgramResponse are required' },
        { status: 400 }
      )
    }

    const jobId = await enqueueTranscriptProcessing(callId, deepgramResponse)

    return NextResponse.json({ jobId, callId, status: 'queued' })
  } catch (error: any) {
    console.error('[Transcript Queue API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/transcripts/queue
 * F0501: Get queue statistics
 */
export async function GET() {
  try {
    const stats = await getQueueStats()

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('[Transcript Queue API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
