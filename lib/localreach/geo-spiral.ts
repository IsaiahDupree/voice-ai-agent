/**
 * LocalReach V3 — Geo-Spiral Targeting Algorithm
 * Expands outreach in concentric rings from a center point,
 * advancing one ring per quarter.
 */
import { supabaseAdmin } from '../supabase'
import type { GeoSpiralRing, LocalReachBusiness } from './types'

// ─── Constants ───

export const GEO_RINGS: GeoSpiralRing[] = [
  { inner: 0, outer: 5 },
  { inner: 5, outer: 15 },
  { inner: 15, outer: 30 },
  { inner: 30, outer: 60 },
]

const MILES_TO_METERS = 1609.344
const EARTH_RADIUS_MILES = 3958.8
const SUPPRESSION_WINDOW_DAYS = 90

// ─── Quarter helpers ───

export function getCurrentQuarter(): string {
  const now = new Date()
  const q = Math.ceil((now.getMonth() + 1) / 3)
  return `${now.getFullYear()}-Q${q}`
}

export function getQuarterRingIndex(quarter: string): number {
  const match = quarter.match(/Q(\d)/)
  if (!match) return 0
  const q = parseInt(match[1], 10)
  return (q - 1) % GEO_RINGS.length
}

// ─── Distance / geometry ───

export function milesToMeters(miles: number): number {
  return miles * MILES_TO_METERS
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/**
 * Haversine distance between two lat/lng points in miles
 */
function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = degreesToRadians(lat2 - lat1)
  const dLng = degreesToRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_MILES * c
}

/**
 * Generate points along a spiral pattern from a center point.
 * Useful for systematic area coverage searches.
 */
export function calculateSpiralPoints(
  centerLat: number,
  centerLng: number,
  radiusMiles: number,
  numPoints: number
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = []
  const maxAngle = numPoints * 0.5 // controls how tight the spiral is

  for (let i = 0; i < numPoints; i++) {
    const fraction = i / numPoints
    const angle = fraction * maxAngle
    const distance = fraction * radiusMiles

    // Convert distance and angle to lat/lng offset
    const distRad = distance / EARTH_RADIUS_MILES
    const bearing = angle % (2 * Math.PI)

    const lat1 = degreesToRadians(centerLat)
    const lng1 = degreesToRadians(centerLng)

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distRad) +
        Math.cos(lat1) * Math.sin(distRad) * Math.cos(bearing)
    )
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distRad) * Math.cos(lat1),
        Math.cos(distRad) - Math.sin(lat1) * Math.sin(lat2)
      )

    points.push({
      lat: radiansToDegrees(lat2),
      lng: radiansToDegrees(lng2),
    })
  }

  return points
}

/**
 * Check whether a point falls within a specific geo ring
 */
export function isWithinRing(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  ring: GeoSpiralRing
): boolean {
  const distance = haversineDistanceMiles(lat, lng, centerLat, centerLng)
  return distance >= ring.inner && distance < ring.outer
}

/**
 * Query Supabase for businesses in a specific ring that are ready to call.
 * Uses bounding-box pre-filter for performance, then Haversine for accuracy.
 */
export async function getBusinessesInRing(
  campaignId: string,
  ringIndex: number
): Promise<LocalReachBusiness[]> {
  if (ringIndex < 0 || ringIndex >= GEO_RINGS.length) {
    throw new Error(`Invalid ring index: ${ringIndex}. Must be 0-${GEO_RINGS.length - 1}`)
  }

  // Fetch campaign to get center coordinates
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('localreach_campaigns')
    .select('center_lat, center_lng')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    throw new Error(`Campaign ${campaignId} not found: ${campaignError?.message}`)
  }

  const ring = GEO_RINGS[ringIndex]
  const centerLat = campaign.center_lat as number
  const centerLng = campaign.center_lng as number

  // Bounding box pre-filter (degrees per mile at this latitude)
  const latDegPerMile = 1 / 69.0
  const lngDegPerMile = 1 / (69.0 * Math.cos(degreesToRadians(centerLat)))
  const outerLatDelta = ring.outer * latDegPerMile
  const outerLngDelta = ring.outer * lngDegPerMile

  const { data: businesses, error } = await supabaseAdmin
    .from('localreach_businesses')
    .select('*')
    .eq('campaign_id', campaignId)
    .in('status', ['new', 'enriched', 'queued'])
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', centerLat - outerLatDelta)
    .lte('latitude', centerLat + outerLatDelta)
    .gte('longitude', centerLng - outerLngDelta)
    .lte('longitude', centerLng + outerLngDelta)
    .order('google_rating', { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) {
    throw new Error(`Failed to query businesses in ring ${ringIndex}: ${error.message}`)
  }

  if (!businesses || businesses.length === 0) {
    return []
  }

  // Haversine filter for accurate ring boundaries
  return (businesses as LocalReachBusiness[]).filter((b) => {
    if (b.latitude === null || b.longitude === null) return false
    return isWithinRing(b.latitude, b.longitude, centerLat, centerLng, ring)
  })
}

/**
 * Check if a business is in the 90-day suppression window.
 * Returns true if suppressed (should NOT be called).
 */
export async function checkSuppressionWindow(businessId: string): Promise<boolean> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SUPPRESSION_WINDOW_DAYS)

  const { data, error } = await supabaseAdmin
    .from('localreach_suppression_list')
    .select('id, suppressed_until')
    .eq('business_id', businessId)
    .gte('suppressed_until', new Date().toISOString())
    .limit(1)

  if (error) {
    // Fail safe — treat as suppressed if we can't check
    console.error(`Suppression check failed for business ${businessId}:`, error.message)
    return true
  }

  return data !== null && data.length > 0
}
