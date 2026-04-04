import { NextRequest, NextResponse } from 'next/server'
import { startCall, listCalls } from '@/lib/vapi'

// F0042: Start call API - initiates outbound/inbound calls
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assistantId, phoneNumberId, customerNumber, assistantOverrides, metadata } = body

    if (!assistantId) {
      return NextResponse.json(
        { error: 'assistantId is required' },
        { status: 400 }
      )
    }

    // For outbound calls, customerNumber is required
    if (phoneNumberId && !customerNumber) {
      return NextResponse.json(
        { error: 'customerNumber is required for outbound calls' },
        { status: 400 }
      )
    }

    const call = await startCall({
      assistantId,
      phoneNumberId, // F0041: Outbound number assign
      customerNumber,
      assistantOverrides, // F0053: Assistant overrides per-call
      metadata, // F0052: Call metadata
    })

    return NextResponse.json(call, { status: 201 })
  } catch (error: any) {
    console.error('Error initiating call:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to initiate call',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}

// F0045: List calls API - returns paginated call list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined

    const calls = await listCalls({ limit, offset })
    return NextResponse.json(calls)
  } catch (error: any) {
    console.error('Error listing calls:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list calls' },
      { status: error.response?.status || 500 }
    )
  }
}
