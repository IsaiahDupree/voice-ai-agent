import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0135: Callback scheduling - schedule callbacks for preferred times

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_callbacks')
      .select('*')
      .order('scheduled_for', { ascending: true })
      .gte('scheduled_for', new Date().toISOString())

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error fetching callbacks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch callbacks' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, scheduled_for, contact_name, notes, call_id } = body

    if (!phone || !scheduled_for) {
      return NextResponse.json(
        { error: 'phone and scheduled_for are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_callbacks')
      .insert({
        phone,
        scheduled_for,
        contact_name,
        notes,
        call_id,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error scheduling callback:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to schedule callback' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json(
        { error: 'id and status are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_callbacks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating callback:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update callback' },
      { status: 500 }
    )
  }
}
