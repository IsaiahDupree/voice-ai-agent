// F0994: PUT /api/templates/:id - Update template
// F0995: DELETE /api/templates/:id - Delete template

import { NextRequest, NextResponse } from 'next/server'
import { updateTemplate, getTemplate, validateTemplate, extractVariables } from '@/lib/templates'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const templateId = params.id

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    const template = await getTemplate(templateId)

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const templateId = params.id
    const { name, description, category, content } = await request.json()

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Validate input
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (category !== undefined) updateData.category = category
    if (content !== undefined) updateData.content = content

    const validation = validateTemplate(updateData)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      )
    }

    // Extract variables if content was updated
    if (content !== undefined) {
      updateData.variables = extractVariables(content)
    }

    // Update template
    const updated = await updateTemplate(templateId, updateData)

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

// F0995: DELETE /api/templates/:id - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const templateId = params.id

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Verify template exists
    const template = await getTemplate(templateId)
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Delete template from database
    const { error: deleteError } = await supabaseAdmin
      .from('templates')
      .delete()
      .eq('id', templateId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Template deleted',
      deleted_id: templateId,
    })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
