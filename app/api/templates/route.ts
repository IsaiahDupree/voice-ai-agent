// F0992: GET /api/templates - List all templates
// F0993: POST /api/templates - Create new template

import { NextRequest, NextResponse } from 'next/server'
import { getTemplates, createTemplate, validateTemplate, extractVariables } from '@/lib/templates'

export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default-org'
    const category = request.nextUrl.searchParams.get('category')

    let templates = await getTemplates(orgId)

    // Filter by category if provided
    if (category) {
      templates = templates.filter(t => t.category === category)
    }

    return NextResponse.json({
      templates,
      count: templates.length
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default-org'
    const { name, description, category, content, createdBy } = await request.json()

    // Validate input
    const validation = validateTemplate({ name, category, content })
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      )
    }

    // Extract variables from content
    const variables = extractVariables(content)

    // Create template
    const template = await createTemplate({
      name,
      description,
      category,
      content,
      variables,
      org_id: orgId,
      created_by: createdBy || 'system'
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      )
    }

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
