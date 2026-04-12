import { NextRequest, NextResponse } from 'next/server'
import { startCall, listCalls } from '@/lib/vapi'
import { supabaseAdmin } from '@/lib/supabase'

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
// F001: Graceful fallback for /api/calls DB schema errors
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    const page = Math.floor(offset / limit) + 1

    // Try to query from Supabase
    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('*')
      .range(offset, offset + limit - 1)

    // If schema error, gracefully return empty data
    if (error?.code === 'PGRST204' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
      console.warn('[Calls API] Schema error detected, returning graceful fallback:', error)
      return NextResponse.json({
        calls: [],
        total: 0,
        page,
        limit
      }, { status: 200 })
    }

    if (error) {
      console.error('[Calls API] Supabase query error:', error)
      // Fallback to Vapi if Supabase fails
      const calls = await listCalls({ limit, offset })
      return NextResponse.json(calls)
    }

    return NextResponse.json({
      calls: data || [],
      total: data?.length || 0,
      page,
      limit
    })
  } catch (error: any) {
    // Graceful fallback for any schema-related errors
    if (error?.message?.includes('column') || error?.message?.includes('does not exist')) {
      console.warn('[Calls API] Schema error caught in try/catch:', error)
      return NextResponse.json({
        calls: [],
        total: 0,
        page: 1,
        limit: 50
      }, { status: 200 })
    }

    console.error('Error listing calls:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list calls' },
      { status: error.response?.status || 500 }
    )
  }
}
