// F0907: GET /api/calls/:id/recording - Redirects to recording URL
// F1311: Handle missing recording URL gracefully
import { NextRequest, NextResponse } from 'next/server'
import { getCall } from '@/lib/vapi'
import { getOrCreateCorrelationId, attachCorrelationId } from '@/lib/correlation-id'

/**
 * GET /api/calls/:id/recording
 * F0907: Redirects to call recording URL
 * F1311: Graceful handling of missing recordings
 *
 * Returns 302 redirect to the actual recording audio file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = getOrCreateCorrelationId(request.headers)

  try {
    const call = await getCall(params.id)

    if (!call) {
      const response = NextResponse.json(
        {
          error: 'Call not found',
          correlation_id: correlationId,
        },
        { status: 404 }
      )
      attachCorrelationId(response.headers, correlationId)
      return response
    }

    const recordingUrl = call.recordingUrl || (call as any).recording_url

    // F1311: Graceful handling of missing recording URL
    if (!recordingUrl) {
      const reason = determineRecordingUnavailabilityReason(call)

      const response = NextResponse.json(
        {
          error: 'Recording unavailable',
          message: reason,
          call_id: params.id,
          status: 'unavailable',
          correlation_id: correlationId,
        },
        { status: 404 }
      )
      attachCorrelationId(response.headers, correlationId)
      return response
    }

    // F0907: 302 redirect to recording URL
    return NextResponse.redirect(recordingUrl, 302)
  } catch (error: any) {
    console.error('[Recording API] Error:', error)

    // F1311: Graceful error handling
    const response = NextResponse.json(
      {
        error: 'Failed to fetch recording',
        message: error.message || 'Recording temporarily unavailable',
        correlation_id: correlationId,
      },
      { status: error.statusCode || 500 }
    )
    attachCorrelationId(response.headers, correlationId)
    return response
  }
}

/**
 * F1311: Determine why recording is unavailable
 */
function determineRecordingUnavailabilityReason(call: any): string {
  // Call is still in progress
  if (call.status === 'in-progress' || call.endedAt === null) {
    return 'Recording not yet available. Call is still in progress.'
  }

  // Call just ended, recording is processing
  const endedAt = new Date(call.endedAt).getTime()
  const now = Date.now()
  const minutesSinceEnded = (now - endedAt) / 1000 / 60

  if (minutesSinceEnded < 5) {
    return 'Recording is being processed. Please check back in a few minutes.'
  }

  // Recording disabled for this call
  if (call.recordingEnabled === false) {
    return 'Recording was disabled for this call.'
  }

  // Call ended without recording
  if (call.duration < 3) {
    return 'Call was too short to generate a recording.'
  }

  // Unknown reason
  return 'Recording unavailable. The call may not have been recorded.'
}
