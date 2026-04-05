import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!

interface PlaceResult {
  name: string
  formatted_address: string
  formatted_phone_number?: string
  international_phone_number?: string
  website?: string
  place_id: string
  geometry: { location: { lat: number; lng: number } }
  rating?: number
  user_ratings_total?: number
  business_status?: string
  types?: string[]
  opening_hours?: { open_now?: boolean }
}

/**
 * Generate radius rings for spiral outward search.
 * Returns an array of { lat, lng, radius } objects covering the area.
 */
function generateRadiusRings(
  lat: number,
  lng: number,
  radiusMiles: number,
  ringCount: number = 3
): Array<{ lat: number; lng: number; radiusMeters: number }> {
  const rings: Array<{ lat: number; lng: number; radiusMeters: number }> = []
  const totalRadiusMeters = radiusMiles * 1609.34

  for (let i = 1; i <= ringCount; i++) {
    const ringRadius = (totalRadiusMeters / ringCount) * i
    rings.push({ lat, lng, radiusMeters: ringRadius })
  }

  return rings
}

async function searchPlaces(
  query: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  pageToken?: string
): Promise<{ results: PlaceResult[]; nextPageToken?: string }> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  url.searchParams.set('query', query)
  url.searchParams.set('location', `${lat},${lng}`)
  url.searchParams.set('radius', String(Math.round(radiusMeters)))
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY)

  if (pageToken) {
    url.searchParams.set('pagetoken', pageToken)
  }

  const res = await fetch(url.toString())
  const data = await res.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message || ''}`)
  }

  return {
    results: data.results || [],
    nextPageToken: data.next_page_token,
  }
}

async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,international_phone_number,website,place_id,geometry,rating,user_ratings_total,business_status,types,opening_hours')
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY)

  const res = await fetch(url.toString())
  const data = await res.json()

  if (data.status !== 'OK') return null
  return data.result
}

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length > 7) return `+${digits}`
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { niche, lat, lng, radiusMiles = 10, maxResults = 50 } = body

    if (!niche || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'niche, lat, and lng are required' },
        { status: 400 }
      )
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json(
        { error: 'GOOGLE_MAPS_API_KEY not configured' },
        { status: 503 }
      )
    }

    const rings = generateRadiusRings(lat, lng, radiusMiles)
    const allPlaces: PlaceResult[] = []
    const seenPlaceIds = new Set<string>()

    // Spiral outward through radius rings
    for (const ring of rings) {
      if (allPlaces.length >= maxResults) break

      let pageToken: string | undefined
      let pageCount = 0

      do {
        const { results, nextPageToken } = await searchPlaces(
          niche,
          ring.lat,
          ring.lng,
          ring.radiusMeters,
          pageToken
        )

        for (const place of results) {
          if (!seenPlaceIds.has(place.place_id) && allPlaces.length < maxResults) {
            seenPlaceIds.add(place.place_id)
            allPlaces.push(place)
          }
        }

        pageToken = nextPageToken
        pageCount++

        // Google requires a short delay before using nextPageToken
        if (pageToken) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } while (pageToken && pageCount < 3 && allPlaces.length < maxResults)
    }

    // Enrich with phone numbers via Place Details
    const enrichedPlaces: PlaceResult[] = []
    for (const place of allPlaces) {
      const details = await getPlaceDetails(place.place_id)
      if (details) {
        enrichedPlaces.push({ ...place, ...details })
      } else {
        enrichedPlaces.push(place)
      }
    }

    // Deduplicate against existing businesses by phone number
    const phonesToCheck = enrichedPlaces
      .map(p => normalizePhone(p.international_phone_number || p.formatted_phone_number))
      .filter((p): p is string => p !== null)

    let existingPhones = new Set<string>()
    if (phonesToCheck.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from('localreach_businesses')
        .select('phone')
        .in('phone', phonesToCheck)

      if (existing) {
        existingPhones = new Set(existing.map((r: { phone: string }) => r.phone))
      }
    }

    // Insert new businesses
    const newBusinesses: Array<{
      name: string
      phone: string | null
      address: string
      website: string | null
      google_place_id: string
      lat: number
      lng: number
      niche: string
      rating: number | null
      review_count: number | null
      business_status: string | null
      types: string[] | null
      source: string
      sourced_at: string
    }> = []

    for (const place of enrichedPlaces) {
      const phone = normalizePhone(place.international_phone_number || place.formatted_phone_number)

      if (phone && existingPhones.has(phone)) continue // dedupe

      newBusinesses.push({
        name: place.name,
        phone,
        address: place.formatted_address,
        website: place.website || null,
        google_place_id: place.place_id,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        niche,
        rating: place.rating || null,
        review_count: place.user_ratings_total || null,
        business_status: place.business_status || null,
        types: place.types || null,
        source: 'google_places',
        sourced_at: new Date().toISOString(),
      })
    }

    let inserted: any[] = []
    if (newBusinesses.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('localreach_businesses')
        .upsert(newBusinesses, { onConflict: 'google_place_id' })
        .select()

      if (error) throw error
      inserted = data || []
    }

    // Log geo coverage
    await supabaseAdmin.from('localreach_geo_coverage').insert({
      lat,
      lng,
      radius_miles: radiusMiles,
      niche,
      businesses_found: allPlaces.length,
      businesses_new: newBusinesses.length,
      searched_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      summary: {
        totalFound: allPlaces.length,
        newBusinesses: newBusinesses.length,
        duplicatesSkipped: allPlaces.length - newBusinesses.length,
        radiusMiles,
        ringsSearched: rings.length,
      },
      businesses: inserted,
    })
  } catch (error: any) {
    console.error('[Lead Source API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to source leads' },
      { status: 500 }
    )
  }
}
