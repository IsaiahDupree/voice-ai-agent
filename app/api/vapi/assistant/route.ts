import { NextRequest, NextResponse } from 'next/server'
import { createAssistant, listAssistants, VapiAssistant } from '@/lib/vapi'

export async function POST(request: NextRequest) {
  try {
    const body: VapiAssistant = await request.json()
    const assistant = await createAssistant(body)

    return NextResponse.json(assistant, { status: 201 })
  } catch (error: any) {
    console.error('Error creating assistant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create assistant' },
      { status: error.response?.status || 500 }
    )
  }
}

export async function GET() {
  try {
    const assistants = await listAssistants()
    return NextResponse.json(assistants)
  } catch (error: any) {
    console.error('Error listing assistants:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list assistants' },
      { status: error.response?.status || 500 }
    )
  }
}
