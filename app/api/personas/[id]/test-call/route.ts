// F0816: Persona test call via API

import { NextRequest, NextResponse } from 'next/server'
import { createPersonaTestCall, getPersonaTestCall } from '@/lib/persona-builder'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const personaId = params.id
    const testCallId = request.nextUrl.searchParams.get('testCallId')

    if (!personaId) {
      return NextResponse.json(
        { error: 'Persona ID is required' },
        { status: 400 }
      )
    }

    if (!testCallId) {
      return NextResponse.json(
        { error: 'Test call ID is required' },
        { status: 400 }
      )
    }

    const testCall = await getPersonaTestCall(testCallId)

    if (!testCall) {
      return NextResponse.json(
        { error: 'Test call not found' },
        { status: 404 }
      )
    }

    if (testCall.persona_id !== personaId) {
      return NextResponse.json(
        { error: 'Test call does not belong to this persona' },
        { status: 403 }
      )
    }

    return NextResponse.json(testCall)
  } catch (error) {
    console.error('Error fetching test call:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test call' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const personaId = params.id
    const { fromNumber } = await request.json()

    if (!personaId) {
      return NextResponse.json(
        { error: 'Persona ID is required' },
        { status: 400 }
      )
    }

    if (!fromNumber) {
      return NextResponse.json(
        { error: 'From number is required' },
        { status: 400 }
      )
    }

    // Validate phone number format (E.164)
    if (!/^\+?1?\d{9,15}$/.test(fromNumber.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    const result = await createPersonaTestCall(personaId, fromNumber)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      testCallId: result.id,
      status: 'pending',
      personaId,
      fromNumber,
      createdAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error creating test call:', error)
    return NextResponse.json(
      { error: 'Failed to create test call' },
      { status: 500 }
    )
  }
}
