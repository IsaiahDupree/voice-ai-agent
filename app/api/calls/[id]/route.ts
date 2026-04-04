import { NextRequest, NextResponse } from 'next/server'
import { getCall, endCall } from '@/lib/vapi'

// F0044: Get call API - returns call details with status, duration, cost, recording, transcript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const call = await getCall(params.id)
    // Call object includes:
    // F0046: status field (queued|ringing|in-progress|ended)
    // F0047: duration field (seconds)
    // F0048: cost field (USD)
    // F0049: recordingUrl field
    // F0050: transcript field
    return NextResponse.json(call)
  } catch (error: any) {
    console.error('Error getting call:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get call' },
      { status: error.response?.status || 500 }
    )
  }
}

// F0043: End call API - terminates active call within 2s
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await endCall(params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error ending call:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to end call' },
      { status: error.response?.status || 500 }
    )
  }
}
