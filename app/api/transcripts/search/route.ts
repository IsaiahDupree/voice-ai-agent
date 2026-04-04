// F0976: GET /api/transcripts/search - Search transcripts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parsePaginationParams } from '@/lib/api-response'

/**
 * F0976: GET /api/transcripts/search
 * Search transcripts by query term
 *
 * Query params:
 *   - q: Search query (searches transcript_text field)
 *   - sentiment: Filter by sentiment (positive, negative, neutral)
 *   - dateFrom: Filter by date range (ISO8601)
 *   - dateTo: Filter by date range (ISO8601)
 *   - page: Page number (default: 1)
 *   - limit: Results per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const sentiment = searchParams.get('sentiment')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const { page, pageSize, offset } = parsePaginationParams(searchParams)

    // Build query
    let dbQuery = supabaseAdmin
      .from('voice_agent_transcripts')
      .select('*', { count: 'exact' })

    // F0976: Text search in transcript_text field
    if (query) {
      dbQuery = dbQuery.ilike('transcript_text', `%${query}%`)
    }

    // Filter by sentiment
    if (sentiment) {
      dbQuery = dbQuery.eq('metadata->>sentiment', sentiment)
    }

    // Filter by date range
    if (dateFrom) {
      dbQuery = dbQuery.gte('created_at', dateFrom)
    }
    if (dateTo) {
      dbQuery = dbQuery.lte('created_at', dateTo)
    }

    // Pagination
    dbQuery = dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    const { data, error, count } = await dbQuery

    if (error) {
      console.error('Error searching transcripts:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to search transcripts' },
        { status: 500 }
      )
    }

    // Format results
    const transcripts = (data || []).map(t => ({
      id: t.id,
      call_id: t.call_id,
      transcript_text: t.transcript_text,
      duration: t.duration,
      sentiment: t.metadata?.sentiment,
      sentiment_score: t.metadata?.sentiment_score,
      summary: t.metadata?.summary,
      created_at: t.created_at,
    }))

    return NextResponse.json({
      success: true,
      transcripts,
      query,
      filters: {
        sentiment,
        dateFrom,
        dateTo,
      },
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    })
  } catch (error: any) {
    console.error('Error in transcript search:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search transcripts' },
      { status: 500 }
    )
  }
}
