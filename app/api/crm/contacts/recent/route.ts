// F0601: Contact recent list

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/crm/contacts/recent - Get recently contacted/modified contacts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const days = parseInt(searchParams.get('days') || '30')

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    // Calculate date threshold
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)

    // Get recently updated contacts
    const { data: contacts, error, count } = await supabaseAdmin
      .from('crm_contacts')
      .select('id, name, email, phone_number, company, last_contacted_at, updated_at', {
        count: 'exact',
      })
      .eq('org_id', orgId)
      .gte('updated_at', daysAgo.toISOString())
      .order('last_contacted_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      contacts,
      pagination: {
        total: count || 0,
        limit,
        days_back: days,
      },
    })
  } catch (error: any) {
    console.error('Error fetching recent contacts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
