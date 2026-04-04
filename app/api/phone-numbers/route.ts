// F0949: GET /api/phone-numbers - Lists purchased numbers

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0949: GET /api/phone-numbers
 * Lists all purchased phone numbers from voice_agent_phone_numbers table
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // active, inactive, all

    let query = supabaseAdmin
      .from('voice_agent_phone_numbers')
      .select('*')
      .order('purchased_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      numbers: data || [],
    })
  } catch (error: any) {
    console.error('Error fetching phone numbers:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch phone numbers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/phone-numbers
 * Add a new purchased phone number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, provider = 'vapi', assistant_id, status = 'active' } = body

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_phone_numbers')
      .insert({
        phone,
        provider,
        assistant_id,
        status,
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Phone number already exists', isDuplicate: true },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Phone number added',
        number: data,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error adding phone number:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add phone number' },
      { status: 500 }
    )
  }
}
