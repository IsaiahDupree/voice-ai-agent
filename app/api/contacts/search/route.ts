// F0602: Contact full-text search API

import { NextRequest, NextResponse } from 'next/server'
import { searchContacts } from '@/lib/contact-management'

/**
 * GET /api/contacts/search?q=query&limit=50
 * F0602: Full-text search across contact fields
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const limitStr = searchParams.get('limit')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 50

    const results = await searchContacts(query, limit)

    return NextResponse.json({
      query,
      results,
      count: results.length,
    })
  } catch (error: any) {
    console.error('[Contact Search API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
