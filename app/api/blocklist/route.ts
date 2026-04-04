// F1011: GET /api/blocklist - Returns blocked numbers
// F1012: POST /api/blocklist - Adds number to blocklist
// F1013: DELETE /api/blocklist/:phone - Removes from blocklist

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const limit = request.nextUrl.searchParams.get('limit') || '100'
    const offset = request.nextUrl.searchParams.get('offset') || '0'
    const source = request.nextUrl.searchParams.get('source')

    let query = supabaseAdmin
      .from('dnc_list')
      .select('*', { count: 'exact' })

    // Filter by source if provided
    if (source) {
      query = query.eq('source', source)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (error) {
      console.error('Error fetching blocklist:', error)
      return NextResponse.json(
        { error: 'Failed to fetch blocklist' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      blocklist: data || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sources: ['self-service', 'manual', 'complaint', 'import']
    })
  } catch (error) {
    console.error('Error in blocklist endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blocklist' },
      { status: 500 }
    )
  }
}

/**
 * F1012: POST /api/blocklist
 * Adds a phone number to the blocklist (DNC list)
 * Body:
 *   - phone: Phone number to block
 *   - reason: Reason for blocking (optional)
 *   - source: Source of the blocklist entry (self-service, manual, complaint, import)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, reason, source = 'self-service' } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      )
    }

    // Check if already blocked
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('dnc_list')
      .select('id')
      .eq('phone', phone)
      .single()

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Phone number already blocked' },
        { status: 409 }
      )
    }

    // Add to blocklist
    const { data: blocked, error: blockError } = await supabaseAdmin
      .from('dnc_list')
      .insert({
        phone,
        reason: reason || null,
        source,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (blockError) {
      throw blockError
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Number added to blocklist',
        entry: blocked,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error adding to blocklist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add to blocklist' },
      { status: 500 }
    )
  }
}
