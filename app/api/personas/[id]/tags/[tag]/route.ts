// F0799: Persona tags - delete

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// DELETE /api/personas/:id/tags/:tag - Remove a tag
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; tag: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    const decodedTag = decodeURIComponent(params.tag).toLowerCase()

    // Verify persona exists and belongs to org
    let verifyQuery = supabaseAdmin.from('personas').select('id').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Delete tag
    const { error: deleteError } = await supabaseAdmin
      .from('persona_tags')
      .delete()
      .eq('persona_id', params.id)
      .eq('tag', decodedTag)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Tag removed', tag: decodedTag })
  } catch (error: any) {
    console.error('Error deleting persona tag:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
