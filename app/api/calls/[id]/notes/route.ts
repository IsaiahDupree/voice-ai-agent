import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F1401: Vapi call notes - add or update notes on a call

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { notes } = body

    if (!notes || typeof notes !== 'string') {
      return NextResponse.json(
        { error: 'notes (string) is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      call_id: params.id,
      notes: data.notes,
    })
  } catch (error: any) {
    console.error('Error updating notes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update notes' },
      { status: 500 }
    )
  }
}

// Get notes
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('notes')
      .eq('call_id', params.id)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      call_id: params.id,
      notes: data?.notes || '',
    })
  } catch (error: any) {
    console.error('Error fetching notes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

// Delete notes
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      call_id: params.id,
      notes: null,
    })
  } catch (error: any) {
    console.error('Error deleting notes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete notes' },
      { status: 500 }
    )
  }
}
