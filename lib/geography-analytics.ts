// F0863: Geography map analytics - calls by location, conversion by region

import { supabaseAdmin } from './supabase'

export interface GeographyData {
  state?: string
  city?: string
  country?: string
  areaCode?: string
  callCount: number
  bookingCount: number
  conversionRate: number
  avgDuration: number
  sentiment: {
    positive: number
    neutral: number
    negative: number
  }
}

export interface GeographyInsights {
  byState: GeographyData[]
  byAreaCode: GeographyData[]
  topPerformingRegions: GeographyData[]
  underperformingRegions: GeographyData[]
}

/**
 * F0863: Get call analytics by geography
 */
export async function getGeographyAnalytics(
  startDate?: string,
  endDate?: string,
  personaId?: string
): Promise<GeographyInsights> {
  try {
    // Build query
    let query = supabaseAdmin
      .from('voice_agent_calls')
      .select('phone_number, status, booking_made, duration_seconds, sentiment, metadata')

    if (startDate) {
      query = query.gte('started_at', startDate)
    }
    if (endDate) {
      query = query.lte('started_at', endDate)
    }
    if (personaId) {
      query = query.eq('vapi_assistant_id', personaId)
    }

    const { data: calls, error } = await query

    if (error) throw error
    if (!calls || calls.length === 0) {
      return {
        byState: [],
        byAreaCode: [],
        topPerformingRegions: [],
        underperformingRegions: [],
      }
    }

    // Extract area code and group by it
    const stateMap = new Map<string, any>()
    const areaCodeMap = new Map<string, any>()

    calls.forEach((call: any) => {
      // Extract area code from phone number (first 3 digits after +1)
      const phoneMatch = call.phone_number?.match(/\+?1?(\d{3})/)
      const areaCode = phoneMatch ? phoneMatch[1] : 'unknown'

      // Try to get state from metadata if available
      const state = call.metadata?.state || call.metadata?.caller_state || mapAreaCodeToState(areaCode)

      // Initialize or update state data
      if (state && state !== 'unknown') {
        if (!stateMap.has(state)) {
          stateMap.set(state, {
            state,
            callCount: 0,
            bookingCount: 0,
            totalDuration: 0,
            positive: 0,
            neutral: 0,
            negative: 0,
          })
        }
        const stateData = stateMap.get(state)!
        stateData.callCount++
        if (call.booking_made) stateData.bookingCount++
        stateData.totalDuration += call.duration_seconds || 0
        if (call.sentiment === 'positive') stateData.positive++
        else if (call.sentiment === 'neutral') stateData.neutral++
        else if (call.sentiment === 'negative') stateData.negative++
      }

      // Update area code data
      if (!areaCodeMap.has(areaCode)) {
        areaCodeMap.set(areaCode, {
          areaCode,
          callCount: 0,
          bookingCount: 0,
          totalDuration: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
        })
      }
      const areaCodeData = areaCodeMap.get(areaCode)!
      areaCodeData.callCount++
      if (call.booking_made) areaCodeData.bookingCount++
      areaCodeData.totalDuration += call.duration_seconds || 0
      if (call.sentiment === 'positive') areaCodeData.positive++
      else if (call.sentiment === 'neutral') areaCodeData.neutral++
      else if (call.sentiment === 'negative') areaCodeData.negative++
    })

    // Convert maps to arrays with calculated metrics
    const byState = Array.from(stateMap.values()).map(data => ({
      state: data.state,
      callCount: data.callCount,
      bookingCount: data.bookingCount,
      conversionRate: data.callCount > 0 ? (data.bookingCount / data.callCount) * 100 : 0,
      avgDuration: data.callCount > 0 ? Math.round(data.totalDuration / data.callCount) : 0,
      sentiment: {
        positive: data.positive,
        neutral: data.neutral,
        negative: data.negative,
      },
    }))

    const byAreaCode = Array.from(areaCodeMap.values())
      .filter(data => data.areaCode !== 'unknown')
      .map(data => ({
        areaCode: data.areaCode,
        callCount: data.callCount,
        bookingCount: data.bookingCount,
        conversionRate: data.callCount > 0 ? (data.bookingCount / data.callCount) * 100 : 0,
        avgDuration: data.callCount > 0 ? Math.round(data.totalDuration / data.callCount) : 0,
        sentiment: {
          positive: data.positive,
          neutral: data.neutral,
          negative: data.negative,
        },
      }))

    // Sort by conversion rate
    const sortedByConversion = [...byState].sort((a, b) => b.conversionRate - a.conversionRate)

    // Top performers (high conversion, min 5 calls)
    const topPerformingRegions = sortedByConversion
      .filter(r => r.callCount >= 5)
      .slice(0, 10)

    // Underperformers (low conversion, min 10 calls)
    const underperformingRegions = sortedByConversion
      .filter(r => r.callCount >= 10)
      .slice(-10)
      .reverse()

    return {
      byState: byState.sort((a, b) => b.callCount - a.callCount),
      byAreaCode: byAreaCode.sort((a, b) => b.callCount - a.callCount),
      topPerformingRegions,
      underperformingRegions,
    }
  } catch (error) {
    console.error('Error getting geography analytics:', error)
    return {
      byState: [],
      byAreaCode: [],
      topPerformingRegions: [],
      underperformingRegions: [],
    }
  }
}

/**
 * Simple area code to state mapping (sample - would need full lookup table)
 */
function mapAreaCodeToState(areaCode: string): string {
  const areaCodeMap: Record<string, string> = {
    // Northeast
    '212': 'NY', '646': 'NY', '917': 'NY', '718': 'NY', '347': 'NY',
    '516': 'NY', '631': 'NY', '914': 'NY',
    '201': 'NJ', '551': 'NJ', '609': 'NJ', '732': 'NJ', '848': 'NJ', '908': 'NJ', '973': 'NJ',
    '215': 'PA', '267': 'PA', '445': 'PA', '484': 'PA', '610': 'PA', '717': 'PA', '814': 'PA',
    '617': 'MA', '774': 'MA', '781': 'MA', '857': 'MA', '978': 'MA',
    '203': 'CT', '475': 'CT', '860': 'CT', '959': 'CT',

    // Southeast
    '305': 'FL', '786': 'FL', '954': 'FL', '754': 'FL', '561': 'FL', '727': 'FL',
    '813': 'FL', '941': 'FL', '239': 'FL', '407': 'FL', '321': 'FL', '689': 'FL',
    '404': 'GA', '470': 'GA', '678': 'GA', '770': 'GA', '912': 'GA',
    '704': 'NC', '980': 'NC', '828': 'NC', '910': 'NC', '919': 'NC', '252': 'NC',
    '803': 'SC', '843': 'SC', '864': 'SC',

    // Midwest
    '312': 'IL', '773': 'IL', '872': 'IL', '847': 'IL', '224': 'IL', '630': 'IL',
    '313': 'MI', '734': 'MI', '810': 'MI', '248': 'MI', '586': 'MI', '616': 'MI',
    '216': 'OH', '330': 'OH', '419': 'OH', '440': 'OH', '513': 'OH', '614': 'OH', '937': 'OH',

    // Southwest
    '214': 'TX', '469': 'TX', '972': 'TX', '682': 'TX', '817': 'TX',
    '713': 'TX', '281': 'TX', '832': 'TX', '346': 'TX',
    '512': 'TX', '737': 'TX', '210': 'TX', '726': 'TX',
    '602': 'AZ', '480': 'AZ', '520': 'AZ', '623': 'AZ', '928': 'AZ',

    // West
    '213': 'CA', '310': 'CA', '323': 'CA', '424': 'CA', '562': 'CA', '626': 'CA', '747': 'CA',
    '415': 'CA', '628': 'CA', '510': 'CA', '341': 'CA', '408': 'CA', '669': 'CA',
    '619': 'CA', '858': 'CA', '760': 'CA', '442': 'CA',
    '916': 'CA', '279': 'CA', '209': 'CA',
    '206': 'WA', '253': 'WA', '425': 'WA', '564': 'WA', '509': 'WA',
    '503': 'OR', '971': 'OR', '458': 'OR', '541': 'OR',
    '702': 'NV', '725': 'NV', '775': 'NV',
    '303': 'CO', '720': 'CO', '970': 'CO',
  }

  return areaCodeMap[areaCode] || 'unknown'
}
