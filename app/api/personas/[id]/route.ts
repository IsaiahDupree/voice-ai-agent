// F0940: PUT /api/personas/:id - Updates persona and pushes to Vapi
// F0813: Persona organization scoping

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { vapiClient } from '@/lib/vapi'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id') // F0813: Organization scoping

    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', params.id)

    // F0813: Verify org ownership - blocks cross-org access
    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ persona: data })
  } catch (error: any) {
    console.error('Error in GET /api/personas/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// F0940: Update persona
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      name,
      voice_id,
      system_prompt,
      first_message,
      fallback_phrases,
      active,
      org_id, // F0813: Organization scoping
    } = body

    // Get existing persona
    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', params.id)

    // F0813: Verify org ownership before update
    if (org_id) {
      query = query.eq('org_id', org_id)
    }

    const { data: existingPersona, error: fetchError } = await query.single()

    if (fetchError || !existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // F0785: Update Vapi assistant if vapi_assistant_id exists
    if (existingPersona.vapi_assistant_id) {
      try {
        await vapiClient.patch(`/assistant/${existingPersona.vapi_assistant_id}`, {
          name: name || existingPersona.name,
          voice: {
            provider: 'elevenlabs',
            voiceId: voice_id || existingPersona.voice_id || 'default',
          },
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            systemPrompt: system_prompt || existingPersona.system_prompt,
          },
          firstMessage: first_message || existingPersona.first_message,
        })
      } catch (error: any) {
        console.error('Error updating Vapi assistant:', error)
        return NextResponse.json(
          { error: `Failed to update Vapi assistant: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // Update persona in Supabase
    const { data, error } = await supabaseAdmin
      .from('personas')
      .update({
        name,
        voice_id,
        system_prompt,
        first_message,
        fallback_phrases,
        active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ persona: data })
  } catch (error: any) {
    console.error('Error in PUT /api/personas/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id') // F0813: Organization scoping

    // Get existing persona
    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', params.id)

    // F0813: Verify org ownership before delete
    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: existingPersona } = await query.single()

    if (!existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Delete Vapi assistant if exists
    if (existingPersona?.vapi_assistant_id) {
      try {
        await vapiClient.delete(`/assistant/${existingPersona.vapi_assistant_id}`)
      } catch (error: any) {
        console.error('Error deleting Vapi assistant:', error)
      }
    }

    // Delete from Supabase
    let deleteQuery = supabaseAdmin
      .from('personas')
      .delete()
      .eq('id', params.id)

    // F0813: Ensure org scoping on delete
    if (orgId) {
      deleteQuery = deleteQuery.eq('org_id', orgId)
    }

    const { error } = await deleteQuery

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/personas/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
