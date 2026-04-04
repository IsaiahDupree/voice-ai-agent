// F0518: SMS template CRUD operations

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateSMSLength } from '@/lib/sms-utils'

/**
 * Get SMS template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data, error } = await supabaseAdmin
      .from('voice_agent_sms_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

/**
 * Update SMS template
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, template, category, variables, description } = body

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (template !== undefined) {
      // Validate template length
      const validation = validateSMSLength(template)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
      updateData.template = template
    }
    if (category !== undefined) updateData.category = category
    if (variables !== undefined) updateData.variables = variables
    if (description !== undefined) updateData.description = description

    const { data, error } = await supabaseAdmin
      .from('voice_agent_sms_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    )
  }
}

/**
 * Delete SMS template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { error } = await supabaseAdmin
      .from('voice_agent_sms_templates')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    )
  }
}
