// F0810: Persona webhook test

import { NextRequest, NextResponse } from 'next/server'
import { testWebhook } from '@/lib/persona-builder'

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

  try {
    const personaId = id
    const { webhookUrl, secret } = await request.json()

    if (!personaId) {
      return NextResponse.json(
        { error: 'Persona ID is required' },
        { status: 400 }
      )
    }

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(webhookUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid webhook URL' },
        { status: 400 }
      )
    }

    const result = await testWebhook(webhookUrl, secret)

    return NextResponse.json({
      personaId,
      webhookUrl,
      result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error testing webhook:', error)
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    )
  }
}
