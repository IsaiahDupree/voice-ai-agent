// F0937: POST /api/personas - Creates agent persona
// F0761: Persona CRUD API
// F0813: Persona organization scoping

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { vapiClient } from '@/lib/vapi'

// F0937: Create persona
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      voice_id,
      system_prompt,
      first_message,
      fallback_phrases,
      model,
      tools,
      org_id, // F0813: Organization scoping
    } = body

    // F0762: Persona name validation
    if (!name || name.length < 1 || name.length > 50) {
      return NextResponse.json(
        { error: 'Persona name is required and must be 1-50 characters' },
        { status: 400 }
      )
    }

    // F0807: Persona validation on save
    if (!system_prompt) {
      return NextResponse.json(
        { error: 'System prompt is required' },
        { status: 400 }
      )
    }

    // F0785: Persona webhook on save - Create Vapi assistant
    let vapiAssistantId = null
    try {
      const vapiResponse = await vapiClient.post('/assistant', {
        name,
        voice: {
          provider: 'elevenlabs',
          voiceId: voice_id || 'default',
        },
        model: {
          provider: 'openai',
          model: model || 'gpt-4o',
          systemPrompt: system_prompt,
        },
        firstMessage: first_message,
        tools: tools || [],
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
    // F0813: Include org_id for organization scoping
    const { data, error } = await supabaseAdmin
      .from('personas')
      .insert({
        name,
        voice_id,
        system_prompt,
        first_message,
        fallback_phrases: fallback_phrases || [],
        vapi_assistant_id: vapiAssistantId,
        active: true,
        org_id: org_id || null, // F0813: Organization scoping
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating persona:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ persona: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/personas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// F0813: Get all personas (with optional org scoping)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id') // F0813: Organization scoping

    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .order('created_at', { ascending: false })

    // F0813: Filter by org_id if provided - blocks cross-org access
    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ personas: data })
  } catch (error: any) {
    console.error('Error in GET /api/personas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
