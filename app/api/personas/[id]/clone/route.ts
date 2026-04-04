import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { vapiClient } from '@/lib/vapi'

// F0781: Persona clone - Clone existing persona
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name_suffix, org_id } = body

    // Get existing persona
    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', params.id)

    if (org_id) {
      query = query.eq('org_id', org_id)
    }

    const { data: existingPersona, error: fetchError } = await query.single()

    if (fetchError || !existingPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Generate new name
    const newName = name_suffix
      ? `${existingPersona.name} - ${name_suffix}`
      : `${existingPersona.name} (Copy)`

    // Create Vapi assistant for clone
    let vapiAssistantId = null
    try {
      const vapiResponse = await vapiClient.post('/assistant', {
        name: newName,
        voice: {
          provider: 'elevenlabs',
          voiceId: existingPersona.voice_id || 'default',
          ...existingPersona.voice_settings,
        },
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          systemPrompt: existingPersona.system_prompt,
          ...existingPersona.model_config,
        },
        firstMessage: existingPersona.first_message,
        tools: existingPersona.tool_config || [],
      })

      vapiAssistantId = vapiResponse.data.id
    } catch (error: any) {
      console.error('Error creating Vapi assistant for clone:', error)
      return NextResponse.json(
        { error: `Failed to create Vapi assistant: ${error.message}` },
        { status: 500 }
      )
    }

    // Clone persona in Supabase
    const { data, error } = await supabaseAdmin
      .from('personas')
      .insert({
        name: newName,
        voice_id: existingPersona.voice_id,
        system_prompt: existingPersona.system_prompt,
        first_message: existingPersona.first_message,
        fallback_phrases: existingPersona.fallback_phrases || [],
        tags: existingPersona.tags || [],
        model_config: existingPersona.model_config || null,
        tool_config: existingPersona.tool_config || null,
        voice_settings: existingPersona.voice_settings || null,
        vapi_assistant_id: vapiAssistantId,
        active: true,
        org_id: org_id || existingPersona.org_id || null,
        cloned_from: params.id, // Track original persona
      })
      .select()
      .single()

    if (error) {
      console.error('Error cloning persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        persona: data,
        message: 'Persona cloned successfully',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error in POST /api/personas/:id/clone:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
