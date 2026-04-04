import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F1400: Vapi call labels - add labels to calls for filtering and categorization

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { labels } = body

    if (!labels || !Array.isArray(labels)) {
      return NextResponse.json(
        { error: 'labels array is required' },
        { status: 400 }
      )
    }

    // Get existing call to merge labels
    const { data: existingCall } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('labels')
      .eq('call_id', params.id)
      .single()

    const existingLabels = existingCall?.labels || []
    const mergedLabels = Array.from(new Set([...existingLabels, ...labels]))

    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        labels: mergedLabels,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      call_id: params.id,
      labels: data.labels,
    })
  } catch (error: any) {
    console.error('Error adding labels:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add labels' },
      { status: 500 }
    )
  }
}

// Remove labels
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const labelsToRemove = searchParams.get('labels')?.split(',') || []

    if (labelsToRemove.length === 0) {
      return NextResponse.json(
        { error: 'labels query parameter required (comma-separated)' },
        { status: 400 }
      )
    }

    // Get existing call
    const { data: existingCall } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('labels')
      .eq('call_id', params.id)
      .single()

    const existingLabels = existingCall?.labels || []
    const updatedLabels = existingLabels.filter((l: string) => !labelsToRemove.includes(l))

    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        labels: updatedLabels,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      call_id: params.id,
      labels: data.labels,
    })
  } catch (error: any) {
    console.error('Error removing labels:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove labels' },
      { status: 500 }
    )
  }
}
