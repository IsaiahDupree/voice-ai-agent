// F0799: Persona tags

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/personas/:id/tags - Get all tags for a persona
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    // Verify persona exists and belongs to org
    let verifyQuery = supabaseAdmin.from('personas').select('id').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Get tags
    const { data: tags, error: tagsError } = await supabaseAdmin
      .from('persona_tags')
      .select('tag, created_at')
      .eq('persona_id', params.id)
      .order('created_at', { ascending: false })

    if (tagsError) {
      return NextResponse.json({ error: tagsError.message }, { status: 500 })
    }

    return NextResponse.json({
      tags: tags.map((t) => t.tag),
      count: tags.length,
    })
  } catch (error: any) {
    console.error('Error fetching persona tags:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas/:id/tags - Add a tag to a persona
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tag } = await request.json()
    const orgId = new URL(request.url).searchParams.get('org_id')

    if (!tag || typeof tag !== 'string' || tag.length === 0) {
      return NextResponse.json({ error: 'Tag is required and must be a non-empty string' }, { status: 400 })
    }

    if (tag.length > 50) {
      return NextResponse.json({ error: 'Tag must be 50 characters or less' }, { status: 400 })
    }

    // Verify persona exists and belongs to org
    let verifyQuery = supabaseAdmin.from('personas').select('id').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Add tag
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('persona_tags')
      .insert({
        persona_id: params.id,
        tag: tag.toLowerCase().trim(),
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'This tag already exists for this persona' }, { status: 409 })
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Tag added', tag: inserted.tag }, { status: 201 })
  } catch (error: any) {
    console.error('Error adding persona tag:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
