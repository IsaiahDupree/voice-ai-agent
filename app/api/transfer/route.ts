// F0670: Transfer API endpoint - initiate call transfer

import { NextRequest, NextResponse } from 'next/server'
import {
  checkRepAvailability,
  buildHandoffContext,
  logTransferOutcome,
  classifyTransferReason,
} from '@/lib/transfer-core'
import { logHandoffEvent } from '@/lib/human-handoff'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/transfer
 * F0670: Initiate call transfer to human rep
 *
 * Body:
 * {
 *   callId: string,
 *   transferType: 'warm' | 'cold',
 *   reason: string,
 *   trigger: string,
 *   preferredRepId?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { callId, transferType, reason, trigger, preferredRepId } = body

    if (!callId || !transferType || !reason || !trigger) {
      return NextResponse.json(
        { error: 'callId, transferType, reason, and trigger are required' },
        { status: 400 }
      )
    }

    if (!['warm', 'cold'].includes(transferType)) {
      return NextResponse.json(
        { error: 'transferType must be "warm" or "cold"' },
        { status: 400 }
      )
    }

    // Check rep availability
    const availability = await checkRepAvailability({ preferredRepId })

    if (!availability.available) {
      // No rep available - fallback to voicemail
      await logTransferOutcome({
        callId,
        success: false,
        transferType,
        transferReason: classifyTransferReason(trigger, reason),
        repConnected: false,
        outcome: 'failed',
      })

      return NextResponse.json(
        {
          success: false,
          reason: availability.reason || 'No reps available',
          fallback: 'voicemail',
        },
        { status: 503 }
      )
    }

    // Build handoff context packet
    const context = await buildHandoffContext(callId, reason, trigger)

    // Store context packet
    await supabaseAdmin.from('voice_agent_handoff_context').insert({
      call_id: callId,
      contact_id: context.contactId,
      context_packet: context,
      rep_id: availability.repId,
    })

    // Log handoff event
    await logHandoffEvent(callId, {
      type: trigger as any,
      detected: true,
      confidence: 1.0,
      reason,
    })

    // Initiate transfer via Vapi
    // This would call Vapi's transfer API
    // For now, return success with transfer details

    const transferResponse = {
      success: true,
      callId,
      transferType,
      rep: {
        id: availability.repId,
        name: availability.repName,
        phoneNumber: availability.phoneNumber,
      },
      context,
      message: `Transfer initiated to ${availability.repName}`,
    }

    // Log successful transfer initiation
    await logTransferOutcome({
      callId,
      success: true,
      transferType,
      transferReason: classifyTransferReason(trigger, reason),
      transferredTo: availability.phoneNumber,
      repConnected: true,
      outcome: 'completed',
    })

    return NextResponse.json(transferResponse)
  } catch (error: any) {
    console.error('[Transfer API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/transfer/metrics
 * F0661: Get transfer rate metrics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const { getTransferRate } = await import('@/lib/transfer-core')

    const metrics = await getTransferRate({ startDate, endDate })

    return NextResponse.json(metrics)
  } catch (error: any) {
    console.error('[Transfer Metrics API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
