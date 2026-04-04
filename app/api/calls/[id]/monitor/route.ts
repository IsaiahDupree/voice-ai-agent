// F0251: Live agent monitoring API

import { NextRequest, NextResponse } from 'next/server'
import {
  getCallMonitoringUrl,
  enableWhisperMode,
  logMonitoringSession,
  getMonitorableCalls,
} from '@/lib/call-monitoring'

// F0251: Get monitoring URL for a specific call
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getCallMonitoringUrl(params.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      call_id: params.id,
      listen_url: result.listen_url,
      instructions: 'Visit the listen_url to monitor this call in real-time',
    })
  } catch (error: any) {
    console.error('Error getting monitoring URL:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get monitoring URL' },
      { status: 500 }
    )
  }
}

// F0251: Join call as supervisor (with optional whisper mode)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { supervisor_email, supervisor_phone, whisper_mode = false } = body

    if (!supervisor_email) {
      return NextResponse.json(
        { error: 'supervisor_email is required' },
        { status: 400 }
      )
    }

    // Get monitoring URL
    const result = await getCallMonitoringUrl(params.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Enable whisper mode if requested
    if (whisper_mode && supervisor_phone) {
      await enableWhisperMode(params.id, supervisor_phone)
    }

    // Log the monitoring session
    await logMonitoringSession(params.id, supervisor_email, 'joined')

    return NextResponse.json({
      success: true,
      call_id: params.id,
      listen_url: result.listen_url,
      whisper_mode: whisper_mode,
      message: 'Supervisor joined call monitoring',
    })
  } catch (error: any) {
    console.error('Error joining call monitoring:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to join monitoring' },
      { status: 500 }
    )
  }
}
