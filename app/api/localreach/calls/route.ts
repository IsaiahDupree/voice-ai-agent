import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch recent calls with business names
    const { data: calls, error } = await supabaseAdmin
      .from('localreach_call_attempts')
      .select(
        `
        id,
        status,
        outcome,
        created_at,
        campaign_id,
        business_id,
        localreach_businesses(name)
      `
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Transform to match dashboard expectations
    const transformed = (calls || []).map((call: any) => ({
      id: call.id,
      business_name: call.localreach_businesses?.name || 'Unknown',
      outcome: call.outcome || 'no_answer',
      created_at: call.created_at,
      campaign_id: call.campaign_id,
    }))

    return NextResponse.json(transformed)
  } catch (error: any) {
    console.error('[LocalReach Calls API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch calls' },
      { status: 500 }
    )
  }
}
