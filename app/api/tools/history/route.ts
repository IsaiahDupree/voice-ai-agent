import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F1420: Tool invocation history
// GET /api/tools/history returns tool invocation log
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const tool_name = searchParams.get('tool_name')
    const call_id = searchParams.get('call_id')

    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('function_tool_invocations')
      .select('*', { count: 'exact' })

    // Filter by tool name
    if (tool_name) {
      query = query.eq('tool_name', tool_name)
    }

    // Filter by call ID
    if (call_id) {
      query = query.eq('call_id', call_id)
    }

    // Pagination and ordering
    query = query
      .order('invoked_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching tool history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      invocations: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('Error in tool history API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tool history' },
      { status: 500 }
    )
  }
}
