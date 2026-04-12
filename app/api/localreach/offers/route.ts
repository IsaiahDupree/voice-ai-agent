import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F017: Graceful fallback for all /api/localreach/* routes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch offers
    const { data, error } = await supabaseAdmin
      .from('localreach_offers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // F017: Graceful fallback for schema errors
    if (error?.code === 'PGRST204' || error?.message?.includes('does not exist')) {
      console.warn('[LocalReach Offers API] Schema error detected, returning graceful fallback:', error)
      return NextResponse.json({
        offers: [],
        total: 0
      }, { status: 200 })
    }

    if (error) throw error

    return NextResponse.json({
      offers: data || [],
      total: data?.length || 0
    })
  } catch (error: any) {
    // F017: Graceful fallback for schema-related errors
    if (error?.message?.includes('does not exist') || error?.message?.includes('column')) {
      console.warn('[LocalReach Offers API] Schema error caught in try/catch:', error)
      return NextResponse.json({
        offers: [],
        total: 0
      }, { status: 200 })
    }

    console.error('[LocalReach Offers API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch offers' },
      { status: 500 }
    )
  }
}
