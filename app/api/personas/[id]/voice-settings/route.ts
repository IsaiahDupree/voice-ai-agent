// F0768: Custom voice clone
// F0791: Persona speaking rate
// F0792: Persona stability
// F0793: Persona interrupt sensitivity
// F0811: Persona language override

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface VoiceSettings {
  voice_clone_id?: string
  voice_sample_url?: string
  speaking_rate?: number
  stability?: number
  interrupt_sensitivity?: number
  language_override?: string
}

// GET /api/personas/:id/voice-settings - Retrieve voice configuration
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
        'id, voice_id, voice_clone_id, voice_sample_url, speaking_rate, stability, interrupt_sensitivity, language_override'
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
      voice_settings: {
        voice_id: persona.voice_id,
        voice_clone_id: persona.voice_clone_id,
        voice_sample_url: persona.voice_sample_url,
        speaking_rate: persona.speaking_rate || 1.0,
        stability: persona.stability || 0.5,
        interrupt_sensitivity: persona.interrupt_sensitivity || 0.5,
        language_override: persona.language_override,
      },
    })
  } catch (error: any) {
    console.error('Error fetching voice settings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/personas/:id/voice-settings - Update voice configuration
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: VoiceSettings = await request.json()
    const orgId = new URL(request.url).searchParams.get('org_id')

    // Validate input ranges
    if (body.speaking_rate !== undefined && (body.speaking_rate < 0.5 || body.speaking_rate > 2.0)) {
      return NextResponse.json(
        { error: 'Speaking rate must be between 0.5 and 2.0' },
        { status: 400 }
      )
    }

    if (body.stability !== undefined && (body.stability < 0 || body.stability > 1)) {
      return NextResponse.json(
        { error: 'Stability must be between 0 and 1' },
        { status: 400 }
      )
    }

    if (
      body.interrupt_sensitivity !== undefined &&
      (body.interrupt_sensitivity < 0 || body.interrupt_sensitivity > 1)
    ) {
      return NextResponse.json(
        { error: 'Interrupt sensitivity must be between 0 and 1' },
        { status: 400 }
      )
    }

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

    // Update persona with new voice settings
    const updateData: any = {}
    if (body.voice_clone_id !== undefined) updateData.voice_clone_id = body.voice_clone_id
    if (body.voice_sample_url !== undefined) updateData.voice_sample_url = body.voice_sample_url
    if (body.speaking_rate !== undefined) updateData.speaking_rate = body.speaking_rate
    if (body.stability !== undefined) updateData.stability = body.stability
    if (body.interrupt_sensitivity !== undefined) {
      updateData.interrupt_sensitivity = body.interrupt_sensitivity
    }
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
        { error: `Failed to update voice settings: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Voice settings updated',
      voice_settings: {
        voice_clone_id: updated.voice_clone_id,
        voice_sample_url: updated.voice_sample_url,
        speaking_rate: updated.speaking_rate,
        stability: updated.stability,
        interrupt_sensitivity: updated.interrupt_sensitivity,
        language_override: updated.language_override,
      },
    })
  } catch (error: any) {
    console.error('Error updating voice settings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
