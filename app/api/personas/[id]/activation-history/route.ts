// F0815: Persona activation history

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface ActivationEntry {
  id: string
  activated_at: string | null
  deactivated_at: string | null
  activated_by: string | null
  deactivated_by: string | null
  created_at: string
}

// GET /api/personas/:id/activation-history - Get activation/deactivation history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify persona exists and belongs to org
    let verifyQuery = supabaseAdmin.from('personas').select('id, active').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Get activation history
    const { data: history, error: historyError, count } = await supabaseAdmin
      .from('persona_activation_history')
      .select(
        'id, activated_at, deactivated_at, activated_by, deactivated_by, created_at',
        { count: 'exact' }
      )
      .eq('persona_id', params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 })
    }

    return NextResponse.json({
      activation_history: history as ActivationEntry[],
      current_status: persona.active ? 'active' : 'inactive',
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    })
  } catch (error: any) {
    console.error('Error fetching activation history:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas/:id/activation-history - Log activation change (internal)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { activated_at, deactivated_at, activated_by, deactivated_by } = await request.json()
    const orgId = new URL(request.url).searchParams.get('org_id')

    // Verify persona exists and belongs to org
    let verifyQuery = supabaseAdmin.from('personas').select('id').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Insert activation history entry
    const { data: entry, error: insertError } = await supabaseAdmin
      .from('persona_activation_history')
      .insert({
        persona_id: params.id,
        activated_at,
        deactivated_at,
        activated_by,
        deactivated_by,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Activation change logged', entry }, { status: 201 })
  } catch (error: any) {
    console.error('Error logging activation change:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
