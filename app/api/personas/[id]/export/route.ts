import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0797: Persona export - Export persona config as JSON
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    let query = supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error } = await query.single()

    if (error || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Export full persona configuration
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      persona: {
        name: persona.name,
        voice_id: persona.voice_id,
        system_prompt: persona.system_prompt,
        first_message: persona.first_message,
        fallback_phrases: persona.fallback_phrases || [],
        tags: persona.tags || [],
        // Include any other relevant config fields
        model_config: persona.model_config || null,
        tool_config: persona.tool_config || null,
        voice_settings: persona.voice_settings || null,
      },
    }

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="persona-${persona.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting persona:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export persona' },
      { status: 500 }
    )
  }
}
