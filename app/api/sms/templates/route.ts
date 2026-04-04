// F0518: Custom SMS template system
// Store and manage SMS templates in database

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateSMSLength } from '@/lib/sms-utils'

/**
 * F0518: GET /api/sms/templates - List all SMS templates
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')

    let query = supabaseAdmin
      .from('voice_agent_sms_templates')
      .select('*')
      .order('name', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('[SMS Templates] Error fetching templates:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ templates: data || [] })
  } catch (error: any) {
    console.error('[SMS Templates] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

/**
 * F0518: POST /api/sms/templates - Create new SMS template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, template, category, variables, description } = body

    if (!name || !template) {
      return NextResponse.json(
        { error: 'name and template are required' },
        { status: 400 }
      )
    }

    // F0521: Validate template length
    const validation = validateSMSLength(template)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Extract variables from template ({{variable}})
    const extractedVariables = extractTemplateVariables(template)

    const { data, error } = await supabaseAdmin
      .from('voice_agent_sms_templates')
      .insert({
        name,
        template,
        category: category || 'general',
        variables: variables || extractedVariables,
        description: description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[SMS Templates] Error creating template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('[SMS Templates] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    )
  }
}

/**
 * Extract variable placeholders from template
 * Finds all {{variable}} patterns
 */
function extractTemplateVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(template)) !== null) {
    const variable = match[1].trim()
    if (!variables.includes(variable)) {
      variables.push(variable)
    }
  }

  return variables
}
