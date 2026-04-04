// F0459, F0460, F0461: Vapi webhook handler for real-time transcript streaming

import { NextRequest, NextResponse } from 'next/server'
import {
  broadcastTranscriptUpdate,
  streamPartialSegment,
  startTranscriptStream,
  endTranscriptStream,
} from '@/lib/transcript-stream'

/**
 * F0459, F0460: Handle Vapi transcript webhooks
 * Receives real-time transcript updates from Vapi/Deepgram
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { type, call, message } = body

    if (!call?.id) {
      return NextResponse.json(
        { error: 'call.id is required' },
        { status: 400 }
      )
    }

    const callId = call.id

    // Handle different message types
    switch (type) {
      case 'transcript':
        // F0460, F0461: Handle real-time transcript message
        await handleTranscriptMessage(callId, message)
        break

      case 'call-started':
        // F0459: Start transcript stream
        await startTranscriptStream(callId)
        break

      case 'call-ended':
      case 'end-of-call-report':
        // F0459: End transcript stream
        await endTranscriptStream(callId)
        break

      default:
        console.log(`[Transcript Webhook] Unhandled message type: ${type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[Transcript Webhook] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * F0460, F0461: Handle transcript message from Vapi
 * Supports partial segments for real-time streaming
 */
async function handleTranscriptMessage(callId: string, message: any) {
  try {
    // Vapi transcript message format
    const {
      role, // "user" or "assistant"
      transcriptType, // "partial" or "final"
      transcript, // The actual text
      timestamp,
    } = message

    if (!transcript) {
      console.log('[Transcript Webhook] No transcript content in message')
      return
    }

    // F0461: Partial segment support
    const isPartial = transcriptType === 'partial'

    // Stream the segment
    await streamPartialSegment(callId, {
      role: role || 'assistant',
      content: transcript,
      partial: isPartial,
      timestamp: timestamp || Date.now(),
    })

    console.log(
      `[Transcript Webhook] Streamed ${isPartial ? 'partial' : 'final'} segment for call ${callId}`
    )
  } catch (error) {
    console.error('[Transcript Webhook] Failed to handle message:', error)
    // Fail-open: don't block on streaming failures
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    webhook: 'vapi-transcript',
    status: 'active',
    features: ['F0459', 'F0460', 'F0461'],
  })
}
