import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0193: DNC list check
// F0194: DNC list import
// F0195: DNC self-service opt-out

// Check if a phone number is on the DNC list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      // List all DNC entries
      const { data, error } = await supabaseAdmin
        .from('voice_agent_dnc')
        .select('*')
        .order('added_at', { ascending: false })

      if (error) throw error

      return NextResponse.json({
        success: true,
        count: data?.length || 0,
        dnc: data || [],
      })
    }

    // Check specific number
    const { data, error } = await supabaseAdmin
      .from('voice_agent_dnc')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      isDNC: !!data,
      entry: data || null,
    })
  } catch (error: any) {
    console.error('Error checking DNC:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check DNC list' },
      { status: 500 }
    )
  }
}

// Add a number to DNC list (manual or self-service opt-out)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, source = 'manual', reason, addedBy } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      )
    }

    // F0195: Self-service opt-out - source can be 'self-service' when caller requests removal
    const { data, error } = await supabaseAdmin
      .from('voice_agent_dnc')
      .insert({
        phone,
        source, // manual, self-service, import
        reason,
        added_by: addedBy,
        added_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation (already exists)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Phone number already on DNC list', isDuplicate: true },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Number added to DNC list',
        entry: data,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error adding to DNC:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add to DNC list' },
      { status: 500 }
    )
  }
}

// Remove a number from DNC list
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json(
        { error: 'phone parameter is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('voice_agent_dnc')
      .delete()
      .eq('phone', phone)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Number removed from DNC list',
    })
  } catch (error: any) {
    console.error('Error removing from DNC:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove from DNC list' },
      { status: 500 }
    )
  }
}
