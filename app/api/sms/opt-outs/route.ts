// F0539: SMS opt-out list endpoint

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0539: GET /api/sms/opt-outs - Returns list of opted-out phone numbers
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const offset = (page - 1) * limit

    // Get all contacts with sms_consent = false
    const { data, error, count } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('phone, name, email, updated_at', { count: 'exact' })
      .eq('sms_consent', false)
      .not('phone', 'is', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[SMS Opt-Outs] Error fetching opt-outs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      optOuts: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('[SMS Opt-Outs] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch opt-outs' },
      { status: 500 }
    )
  }
}

/**
 * Check if a phone number is opted out
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('phone, sms_consent')
      .eq('phone', phone)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found = not opted out
        return NextResponse.json({ optedOut: false })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      optedOut: data.sms_consent === false,
      phone: data.phone,
    })
  } catch (error: any) {
    console.error('[SMS Opt-Outs] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check opt-out status' },
      { status: 500 }
    )
  }
}
