// F0501: Transcript queue processing endpoint (for cron jobs)

import { NextRequest, NextResponse } from 'next/server'
import { processTranscriptQueue } from '@/lib/transcript-queue'

/**
 * POST /api/transcripts/queue/process
 * F0501: Process transcript queue (call from cron job)
 * Requires admin API key for security
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin API key
    const adminKey = request.headers.get('x-admin-key')
    const isAdmin = !!(
      adminKey &&
      process.env.ADMIN_API_KEY &&
      adminKey === process.env.ADMIN_API_KEY
    )

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Process queue
    const result = await processTranscriptQueue()

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Transcript Queue Process API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
