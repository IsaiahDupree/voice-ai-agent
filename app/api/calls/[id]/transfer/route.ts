// F0990: POST /api/calls/:id/transfer - Initiate call transfer

import { NextRequest, NextResponse } from 'next/server'
import { transferCallWithType, type TransferType } from '@/lib/call-transfer-enhanced'

interface RouteParams {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const callId = params.id
    const { to_phone, type = 'warm', announcement, context } = await request.json()

    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      )
    }

    if (!to_phone) {
      return NextResponse.json(
        { error: 'Destination phone number is required' },
        { status: 400 }
      )
    }

    if (!['warm', 'cold'].includes(type)) {
      return NextResponse.json(
        { error: 'Transfer type must be warm or cold' },
        { status: 400 }
      )
    }

    // Validate phone number format
    if (!/^\+?1?\d{9,15}$/.test(to_phone.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid destination phone number' },
        { status: 400 }
      )
    }

    // Initiate transfer
    const result = await transferCallWithType({
      call_id: callId,
      to_phone,
      type: type as TransferType,
      announcement,
      context
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to initiate transfer' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Call transfer initiated (${type})`,
      callId,
      toPhone: to_phone,
      transferType: type,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error initiating transfer:', error)
    return NextResponse.json(
      { error: 'Failed to initiate transfer' },
      { status: 500 }
    )
  }
}
