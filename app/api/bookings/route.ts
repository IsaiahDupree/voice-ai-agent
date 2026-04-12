import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F018: Create /api/bookings route (missing — sidebar causes 404)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Query bookings table with limit/offset
    const { data, error, count } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Graceful fallback for missing table
    if (error?.code === 'PGRST204' || error?.message?.includes('does not exist')) {
      console.warn('[Bookings API] Schema error detected, returning graceful fallback:', error)
      return NextResponse.json({
        bookings: [],
        total: 0
      }, { status: 200 })
    }

    if (error) {
      console.error('Error fetching bookings:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch bookings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      bookings: data || [],
      total: count || 0,
      limit,
      offset
    })
  } catch (error: any) {
    // Graceful fallback for schema errors
    if (error?.message?.includes('does not exist') || error?.message?.includes('column')) {
      console.warn('[Bookings API] Schema error caught in try/catch:', error)
      return NextResponse.json({
        bookings: [],
        total: 0
      }, { status: 200 })
    }

    console.error('Error in GET /api/bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

// F018: POST for creating new booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Insert new booking
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('Error creating booking:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create booking' },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}
