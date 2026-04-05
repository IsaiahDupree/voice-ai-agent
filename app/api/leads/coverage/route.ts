import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const niche = searchParams.get('niche')
    const quarter = searchParams.get('quarter') // e.g. "2026-Q1"

    // Calculate quarterly date range
    let startDate: string
    let endDate: string

    if (quarter) {
      const [year, q] = quarter.split('-Q')
      const quarterNum = parseInt(q)
      const startMonth = (quarterNum - 1) * 3
      startDate = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`
      const endMonth = startMonth + 3
      if (endMonth > 12) {
        endDate = `${parseInt(year) + 1}-01-01`
      } else {
        endDate = `${year}-${String(endMonth + 1).padStart(2, '0')}-01`
      }
    } else {
      // Default to current quarter
      const now = new Date()
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const startMonth = currentQuarter * 3
      startDate = `${now.getFullYear()}-${String(startMonth + 1).padStart(2, '0')}-01`
      const endMonth = startMonth + 3
      if (endMonth > 12) {
        endDate = `${now.getFullYear() + 1}-01-01`
      } else {
        endDate = `${now.getFullYear()}-${String(endMonth + 1).padStart(2, '0')}-01`
      }
    }

    let query = supabaseAdmin
      .from('localreach_geo_coverage')
      .select('*')
      .gte('searched_at', startDate)
      .lt('searched_at', endDate)
      .order('searched_at', { ascending: false })

    if (niche) {
      query = query.eq('niche', niche)
    }

    const { data, error } = await query

    if (error) throw error

    // Aggregate by coverage ring
    const rings = (data || []).map(ring => ({
      id: ring.id,
      lat: ring.lat,
      lng: ring.lng,
      radiusMiles: ring.radius_miles,
      niche: ring.niche,
      businessesFound: ring.businesses_found,
      businessesNew: ring.businesses_new,
      searchedAt: ring.searched_at,
    }))

    // Summary stats
    const totalSearches = rings.length
    const totalBusinessesFound = rings.reduce((sum, r) => sum + (r.businessesFound || 0), 0)
    const totalNewBusinesses = rings.reduce((sum, r) => sum + (r.businessesNew || 0), 0)
    const uniqueNiches = [...new Set(rings.map(r => r.niche))]

    return NextResponse.json({
      success: true,
      quarter: quarter || `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
      summary: {
        totalSearches,
        totalBusinessesFound,
        totalNewBusinesses,
        uniqueNiches,
      },
      rings,
    })
  } catch (error: any) {
    console.error('[Lead Coverage API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve coverage data' },
      { status: 500 }
    )
  }
}
