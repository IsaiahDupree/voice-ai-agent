// F0812: Persona background sound
// F0811: Persona language override

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface AudioSettings {
  background_sound_id?: string
  background_sound_url?: string
  language_override?: string
}

// GET /api/personas/:id/audio-settings - Get audio configuration
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    let query = supabaseAdmin
      .from('personas')
      .select(
        'id, background_sound_id, background_sound_url, language_override'
      )
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error } = await query.single()

    if (error || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    return NextResponse.json({
      audio_settings: {
        background_sound_id: persona.background_sound_id,
        background_sound_url: persona.background_sound_url,
        language_override: persona.language_override,
      },
    })
  } catch (error: any) {
    console.error('Error fetching audio settings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/personas/:id/audio-settings - Update audio configuration
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: AudioSettings = await request.json()
    const orgId = new URL(request.url).searchParams.get('org_id')

    // Get existing persona
    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: existingPersona, error: fetchError } = await query.single()

    if (fetchError || !existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Update persona with audio settings
    const updateData: any = {}
    if (body.background_sound_id !== undefined) updateData.background_sound_id = body.background_sound_id
    if (body.background_sound_url !== undefined) updateData.background_sound_url = body.background_sound_url
    if (body.language_override !== undefined) updateData.language_override = body.language_override

    updateData.updated_at = new Date().toISOString()

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('personas')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update audio settings: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Audio settings updated',
      audio_settings: {
        background_sound_id: updated.background_sound_id,
        background_sound_url: updated.background_sound_url,
        language_override: updated.language_override,
      },
    })
  } catch (error: any) {
    console.error('Error updating audio settings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
