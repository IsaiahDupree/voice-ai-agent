// F0542: SMS preview endpoint
// Returns rendered SMS preview before send

import { NextRequest, NextResponse } from 'next/server'
import { renderSMSTemplate } from '@/lib/sms-templates'
import { validateSMSLength, calculateSMSCost } from '@/lib/sms-utils'

/**
 * F0542: POST /api/sms/preview - Preview rendered SMS with variables
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template, variables, templateName } = body

    if (!template && !templateName) {
      return NextResponse.json(
        { error: 'Either template or templateName is required' },
        { status: 400 }
      )
    }

    let renderedMessage = ''

    if (templateName) {
      // Render from template name
      try {
        renderedMessage = renderSMSTemplate(templateName, variables || {})
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || 'Failed to render template' },
          { status: 400 }
        )
      }
    } else {
      // Render raw template string
      renderedMessage = template
      for (const [key, value] of Object.entries(variables || {})) {
        const placeholder = `{{${key}}}`
        renderedMessage = renderedMessage.replace(
          new RegExp(placeholder, 'g'),
          String(value)
        )
      }
    }

    // F0521: Validate length
    const validation = validateSMSLength(renderedMessage)

    // Calculate cost
    const estimatedCost = calculateSMSCost(renderedMessage)

    return NextResponse.json({
      preview: renderedMessage,
      length: validation.length,
      segments: validation.segments,
      valid: validation.valid,
      error: validation.error,
      estimatedCost,
    })
  } catch (error: any) {
    console.error('[SMS Preview] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate preview' },
      { status: 500 }
    )
  }
}
