// F0770: Prompt variable helpers - GET available template variables

import { NextRequest, NextResponse } from 'next/server'
import { getPromptTemplateVariables, groupVariablesByCategory } from '@/lib/persona-builder'

export async function GET(request: NextRequest) {
  try {
    const variables = getPromptTemplateVariables()
    const grouped = groupVariablesByCategory(variables)

    return NextResponse.json({
      variables,
      grouped,
      total: variables.length
    })
  } catch (error) {
    console.error('Error fetching variables:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt variables' },
      { status: 500 }
    )
  }
}
