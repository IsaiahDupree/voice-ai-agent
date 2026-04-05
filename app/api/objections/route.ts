import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offerType = searchParams.get('offer_type')

    let query = supabaseAdmin
      .from('localreach_objections')
      .select('*')
      .order('offer_type', { ascending: true })
      .order('frequency', { ascending: false })

    if (offerType) {
      query = query.eq('offer_type', offerType)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by offer_type
    const grouped: Record<string, any[]> = {}
    for (const obj of data || []) {
      const key = obj.offer_type || 'general'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({
        id: obj.id,
        objection: obj.objection,
        response: obj.response,
        category: obj.category,
        frequency: obj.frequency,
        effectiveness: obj.effectiveness,
        isCustom: obj.is_custom || false,
        createdAt: obj.created_at,
      })
    }

    return NextResponse.json({
      success: true,
      totalObjections: data?.length || 0,
      offerTypes: Object.keys(grouped),
      objections: grouped,
    })
  } catch (error: any) {
    console.error('[Objections API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list objections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      objection,
      response,
      offer_type,
      category,
    } = body

    if (!objection || !response) {
      return NextResponse.json(
        { error: 'objection and response are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('localreach_objections')
      .insert({
        objection,
        response,
        offer_type: offer_type || 'general',
        category: category || 'custom',
        frequency: 0,
        effectiveness: null,
        is_custom: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { success: true, objection: data },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Objections API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create objection' },
      { status: 500 }
    )
  }
}
