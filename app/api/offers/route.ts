import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getDefaultOffers } from '@/lib/localreach/offer-matcher'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')
    const niche = searchParams.get('niche')

    let query = supabaseAdmin
      .from('localreach_offers')
      .select('*')
      .order('sort_order', { ascending: true })

    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    }

    const { data, error } = await query

    if (error) throw error

    // If no offers exist in DB, seed with defaults
    if (!data || data.length === 0) {
      const defaultOffers = getDefaultOffers()

      // Check if we need to seed
      const seedResult = await supabaseAdmin
        .from('localreach_offers')
        .insert(
          defaultOffers.map(o => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            description: o.description,
            niche_tags: o.niche_tags,
            price_cents: o.price_cents,
            billing_interval: o.billing_interval,
            discount_threshold_percent: o.discount_threshold_percent,
            elevator_pitch: o.elevator_pitch,
            features: o.features,
            stripe_price_id: o.stripe_price_id,
            is_active: o.active,
            sort_order: o.sort_order,
            created_at: o.created_at,
            updated_at: o.updated_at,
          }))
        )
        .select()

      if (seedResult.error) {
        // Offers might already exist, try to fetch again
        const { data: retryData } = await supabaseAdmin
          .from('localreach_offers')
          .select('*')
          .order('sort_order', { ascending: true })

        return NextResponse.json({
          success: true,
          count: retryData?.length || 0,
          offers: retryData || defaultOffers,
          seeded: false,
        })
      }

      return NextResponse.json({
        success: true,
        count: seedResult.data?.length || 0,
        offers: seedResult.data || defaultOffers,
        seeded: true,
      })
    }

    // Filter by niche if provided (check against niche_tags array)
    const filtered = niche
      ? data.filter(o => o.niche_tags?.includes(niche) || o.niche_tags?.includes('all'))
      : data

    return NextResponse.json({
      success: true,
      count: filtered.length,
      offers: filtered,
      seeded: false,
    })
  } catch (error: any) {
    console.error('[Offers API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list offers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      slug,
      description,
      niche_tags = ['all'],
      price_cents,
      billing_interval = 'monthly',
      discount_threshold_percent = 0,
      elevator_pitch,
      features = [],
      stripe_price_id,
      is_active = true,
      sort_order = 999,
    } = body

    // Validate required fields
    if (!name || !slug || price_cents === undefined) {
      return NextResponse.json(
        { error: 'name, slug, and price_cents are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('localreach_offers')
      .insert({
        name,
        slug,
        description,
        niche_tags,
        price_cents,
        billing_interval,
        discount_threshold_percent,
        elevator_pitch,
        features,
        stripe_price_id,
        is_active,
        sort_order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { success: true, offer: data },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Offers API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create offer' },
      { status: 500 }
    )
  }
}
