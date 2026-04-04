import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { vapiClient } from '@/lib/vapi'

// F0798: Persona import - Import persona config from JSON
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { persona, org_id } = body

    if (!persona) {
      return NextResponse.json(
        { error: 'Persona data is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!persona.name || !persona.system_prompt) {
      return NextResponse.json(
        { error: 'Persona must include name and system_prompt' },
        { status: 400 }
      )
    }

    // Create Vapi assistant
    let vapiAssistantId = null
    try {
      const vapiResponse = await vapiClient.post('/assistant', {
        name: persona.name,
        voice: {
          provider: 'elevenlabs',
          voiceId: persona.voice_id || 'default',
          ...persona.voice_settings,
        },
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          systemPrompt: persona.system_prompt,
          ...persona.model_config,
        },
        firstMessage: persona.first_message || 'Hello! How can I help you?',
        tools: persona.tool_config || [],
      })

      vapiAssistantId = vapiResponse.data.id
    } catch (error: any) {
      console.error('Error creating Vapi assistant:', error)
      return NextResponse.json(
        { error: `Failed to create Vapi assistant: ${error.message}` },
        { status: 500 }
      )
    }

    // Store persona in Supabase
    const { data, error } = await supabaseAdmin
      .from('personas')
      .insert({
        name: `${persona.name} (Imported)`,
        voice_id: persona.voice_id,
        system_prompt: persona.system_prompt,
        first_message: persona.first_message,
        fallback_phrases: persona.fallback_phrases || [],
        tags: persona.tags || [],
        model_config: persona.model_config || null,
        tool_config: persona.tool_config || null,
        voice_settings: persona.voice_settings || null,
        vapi_assistant_id: vapiAssistantId,
        active: true,
        org_id: org_id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error importing persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        persona: data,
        message: 'Persona imported successfully',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error in POST /api/personas/import:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
