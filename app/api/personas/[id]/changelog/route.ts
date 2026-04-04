// F0809: Persona change log

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface ChangelogEntry {
  id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  change_reason?: string
  changed_by: string | null
  created_at: string
}

// GET /api/personas/:id/changelog - Get persona change history
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
    let verifyQuery = supabaseAdmin.from('personas').select('id').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Get changelog
    const { data: changelog, error: changelogError, count } = await supabaseAdmin
      .from('persona_changelog')
      .select('id, field_name, old_value, new_value, change_reason, changed_by, created_at', {
        count: 'exact',
      })
      .eq('persona_id', params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (changelogError) {
      return NextResponse.json({ error: changelogError.message }, { status: 500 })
    }

    return NextResponse.json({
      changelog: changelog as ChangelogEntry[],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    })
  } catch (error: any) {
    console.error('Error fetching persona changelog:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas/:id/changelog - Log a change (internal use)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { field_name, old_value, new_value, change_reason, changed_by } = await request.json()
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

    // Insert changelog entry
    const { data: entry, error: insertError } = await supabaseAdmin
      .from('persona_changelog')
      .insert({
        persona_id: params.id,
        field_name,
        old_value: old_value?.toString() || null,
        new_value: new_value?.toString() || null,
        change_reason,
        changed_by,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Change logged', entry }, { status: 201 })
  } catch (error: any) {
    console.error('Error logging persona change:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
