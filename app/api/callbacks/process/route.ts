// F0176: Process pending callbacks API
// Cron endpoint to process scheduled callbacks

import { NextRequest, NextResponse } from 'next/server'
import { processPendingCallbacks } from '@/lib/missed-call-followup'

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/cron secret validation
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const processed = await processPendingCallbacks()

    return NextResponse.json({
      success: true,
      processed,
      message: `Processed ${processed} callback(s)`,
    })
  } catch (error: any) {
    console.error('Process callbacks error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process callbacks' },
      { status: 500 }
    )
  }
}

// Allow GET for manual testing
export async function GET(request: NextRequest) {
  try {
    const processed = await processPendingCallbacks()

    return NextResponse.json({
      success: true,
      processed,
      message: `Processed ${processed} callback(s)`,
    })
  } catch (error: any) {
    console.error('Process callbacks error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process callbacks' },
      { status: 500 }
    )
  }
}
