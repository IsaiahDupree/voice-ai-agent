// F0934: GET /api/sms - Lists SMS log
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/sms
 * F0934: Lists all SMS logs with pagination
 * F016: Graceful fallback for /api/sms
 *
 * Query params:
 * - limit: Number of records to return (default 50)
 * - offset: Number of records to skip (default 0)
 * - status: Filter by status (sent, delivered, failed, pending)
 * - contact_id: Filter by contact ID
 * - campaign_id: Filter by campaign ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const contactId = searchParams.get('contact_id')
    const campaignId = searchParams.get('campaign_id')

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (contactId) {
      query = query.eq('contact_id', parseInt(contactId))
    }

    if (campaignId) {
      query = query.eq('campaign_id', parseInt(campaignId))
    }

    const { data, error, count } = await query

    // F016: Graceful fallback for schema errors
    if (error?.code === 'PGRST204' || error?.message?.includes('does not exist')) {
      console.warn('[SMS List API] Schema error detected, returning graceful fallback:', error)
      return NextResponse.json({
        messages: [],
        total: 0
      }, { status: 200 })
    }

    if (error) {
      throw error
    }

    return NextResponse.json({
      sms: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: count ? offset + limit < count : false,
      },
    })
  } catch (error: any) {
    // F016: Graceful fallback for schema-related errors
    if (error?.message?.includes('does not exist') || error?.message?.includes('column')) {
      console.warn('[SMS List API] Schema error caught in try/catch:', error)
      return NextResponse.json({
        messages: [],
        total: 0
      }, { status: 200 })
    }

    console.error('[SMS List API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list SMS' },
      { status: 500 }
    )
  }
}
