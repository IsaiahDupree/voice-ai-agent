import { NextRequest, NextResponse } from 'next/server'
import { getAssistant, updateAssistant, deleteAssistant, VapiAssistant } from '@/lib/vapi'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

  try {
    const assistant = await getAssistant(id)
    return NextResponse.json(assistant)
  } catch (error: any) {
    console.error('Error getting assistant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get assistant' },
      { status: error.response?.status || 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

  try {
    const body: Partial<VapiAssistant> = await request.json()
    const assistant = await updateAssistant(id, body)

    return NextResponse.json(assistant)
  } catch (error: any) {
    console.error('Error updating assistant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update assistant' },
      { status: error.response?.status || 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

  try {
    await deleteAssistant(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting assistant:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete assistant' },
      { status: error.response?.status || 500 }
    )
  }
}
