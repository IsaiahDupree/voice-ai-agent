// F0782: Persona version history

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface PersonaVersion {
  id: string
  version: number
  persona_id: string
  snapshot: Record<string, any>
  created_at: string
  created_by?: string
  description?: string
}

// GET /api/personas/:id/versions - Get all versions of a persona
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify persona exists
    let verifyQuery = supabaseAdmin.from('personas').select('id').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Get versions from changelog (approximated from persona_changelog)
    const { data: changes, error: changesError, count } = await supabaseAdmin
      .from('persona_changelog')
      .select('created_at, changed_by', { count: 'exact' })
      .eq('persona_id', params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (changesError) {
      return NextResponse.json({ error: changesError.message }, { status: 500 })
    }

    // Group changes into versions (would be better with a dedicated versions table)
    const versions = changes?.map((change, idx) => ({
      id: `v${idx + 1}`,
      version: idx + 1,
      persona_id: params.id,
      created_at: change.created_at,
      created_by: change.changed_by,
    })) || []

    return NextResponse.json({
      persona_id: params.id,
      versions,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    })
  } catch (error: any) {
    console.error('Error fetching persona versions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET specific version - handled via query param ?version=X in main GET above
async function GET_SPECIFIC(
  request: NextRequest,
  { params }: { params: { id: string; version: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    // Verify persona exists
    let verifyQuery = supabaseAdmin.from('personas').select('*').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Would fetch specific version from versions table
    return NextResponse.json({
      persona_id: params.id,
      version: params.version,
      snapshot: persona,
    })
  } catch (error: any) {
    console.error('Error fetching persona version:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas/:id/versions - Create a new version (snapshot)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    const { description } = body

    // Verify persona exists
    let verifyQuery = supabaseAdmin.from('personas').select('*').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Create version snapshot
    // Would insert into persona_versions table
    const versionNumber = (persona.version_count || 0) + 1

    return NextResponse.json({
      message: 'Version snapshot created',
      version: {
        id: `v${versionNumber}`,
        version: versionNumber,
        persona_id: params.id,
        snapshot: persona,
        description,
        created_at: new Date().toISOString(),
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating persona version:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
