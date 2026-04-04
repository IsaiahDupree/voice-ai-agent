// F0812: Background sounds - get available sounds

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface BackgroundSound {
  id: string
  name: string
  url: string
  category: string
  duration_seconds: number
}

// GET /api/personas/background-sounds - List available background sounds
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = supabaseAdmin
      .from('background_sounds')
      .select('id, name, url, category, duration_seconds')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data: sounds, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by category
    const byCategory = (sounds as BackgroundSound[]).reduce(
      (acc, sound) => {
        if (!acc[sound.category]) {
          acc[sound.category] = []
        }
        acc[sound.category].push(sound)
        return acc
      },
      {} as Record<string, BackgroundSound[]>
    )

    return NextResponse.json({
      sounds: sounds as BackgroundSound[],
      grouped: byCategory,
      categories: Object.keys(byCategory),
      total: sounds?.length || 0,
    })
  } catch (error: any) {
    console.error('Error fetching background sounds:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas/background-sounds - Add a new background sound (admin only)
export async function POST(request: NextRequest) {
  try {
    const { name, url, category, duration_seconds } = await request.json()

    if (!name || !url || !category) {
      return NextResponse.json(
        { error: 'name, url, and category are required' },
        { status: 400 }
      )
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('background_sounds')
      .insert({
        name,
        url,
        category,
        duration_seconds: duration_seconds || 120,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Sound added', sound: inserted }, { status: 201 })
  } catch (error: any) {
    console.error('Error adding background sound:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
