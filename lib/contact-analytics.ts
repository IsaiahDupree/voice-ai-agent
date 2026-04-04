// Contact Analytics - F0599, F0618, F0619, F0625, F0845

import { supabaseAdmin } from './supabase'

export interface ContactEngagementMetrics {
  contactId: number
  phone: string
  name?: string
  engagementScore: number
  bookingRate: number
  lifetimeValue: number
  needsReengagement: boolean
  lastActivity?: string
  callCount: number
  bookingCount: number
  avgSentiment: number
}

/**
 * F0845: Contact acquisition rate
 * New contacts created per day
 */
export async function getContactAcquisitionRate(options: {
  startDate?: string
  endDate?: string
  orgId?: string
}): Promise<{
  total_new_contacts: number
  days: number
  avg_per_day: number
  by_day: Array<{ date: string; count: number }>
}> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, created_at')
      .order('created_at', { ascending: true })

    if (options.orgId) {
      query = query.eq('org_id', options.orgId)
    }
    if (options.startDate) {
      query = query.gte('created_at', options.startDate)
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate)
    }

    const { data, error } = await query
    if (error) throw error

    if (!data || data.length === 0) {
      return {
        total_new_contacts: 0,
        days: 0,
        avg_per_day: 0,
        by_day: [],
      }
    }

    // Group by day
    const byDayMap: Record<string, number> = {}
    data.forEach((contact) => {
      const date = new Date(contact.created_at).toISOString().split('T')[0]
      byDayMap[date] = (byDayMap[date] || 0) + 1
    })

    const by_day = Object.entries(byDayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const total_new_contacts = data.length
    const days = by_day.length
    const avg_per_day = days > 0 ? total_new_contacts / days : 0

    return {
      total_new_contacts,
      days,
      avg_per_day,
      by_day,
    }
  } catch (error) {
    console.error('Error calculating contact acquisition rate:', error)
    return {
      total_new_contacts: 0,
      days: 0,
      avg_per_day: 0,
      by_day: [],
    }
  }
}

/**
 * F0599: Calculate engagement score for a contact (0-100)
 * Based on: calls, bookings, sentiment, recency
 */
export async function calculateEngagementScore(contactId: number): Promise<number> {
  try {
    const { data: calls, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('sentiment, booking_made, status, started_at')
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false })
      .limit(50)

    if (error) throw error
    if (!calls || calls.length === 0) return 0

    const now = new Date()
    const callCount = calls.length
    const bookingCount = calls.filter((c: any) => c.booking_made).length
    const positiveCalls = calls.filter((c: any) => c.sentiment === 'positive').length

    // Recency score (0-25 points)
    const lastCall = new Date(calls[0].started_at)
    const daysSinceLastCall = Math.floor((now.getTime() - lastCall.getTime()) / (1000 * 60 * 60 * 24))
    let recencyScore = 0
    if (daysSinceLastCall <= 7) recencyScore = 25
    else if (daysSinceLastCall <= 14) recencyScore = 20
    else if (daysSinceLastCall <= 30) recencyScore = 15
    else if (daysSinceLastCall <= 60) recencyScore = 10
    else if (daysSinceLastCall <= 90) recencyScore = 5

    // Frequency score (0-25 points)
    let frequencyScore = Math.min(25, callCount * 2.5)

    // Sentiment score (0-25 points)
    const sentimentRate = callCount > 0 ? (positiveCalls / callCount) * 100 : 0
    const sentimentScore = (sentimentRate / 100) * 25

    // Conversion score (0-25 points)
    const conversionRate = callCount > 0 ? (bookingCount / callCount) * 100 : 0
    const conversionScore = (conversionRate / 100) * 25

    const totalScore = Math.round(recencyScore + frequencyScore + sentimentScore + conversionScore)

    return Math.min(100, Math.max(0, totalScore))
  } catch (error) {
    console.error('Error calculating engagement score:', error)
    return 0
  }
}

/**
 * F0619: Calculate booking rate for a contact (percentage 0-100)
 */
export async function calculateBookingRate(contactId: number): Promise<number> {
  try {
    const { data: calls, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('booking_made, status')
      .eq('contact_id', contactId)
      .in('status', ['completed', 'in-progress'])

    if (error) throw error
    if (!calls || calls.length === 0) return 0

    const bookings = calls.filter((c: any) => c.booking_made).length
    const rate = (bookings / calls.length) * 100

    return Math.round(rate * 100) / 100
  } catch (error) {
    console.error('Error calculating booking rate:', error)
    return 0
  }
}

/**
 * F0618: Calculate lifetime value for a contact
 */
export async function calculateLifetimeValue(
  contactId: number,
  avgBookingValue: number = 100
): Promise<number> {
  try {
    const { data: calls, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('booking_made, metadata')
      .eq('contact_id', contactId)
      .eq('booking_made', true)

    if (error) throw error
    if (!calls || calls.length === 0) return 0

    let totalValue = 0
    calls.forEach((call: any) => {
      const bookingValue = call.metadata?.booking_value || avgBookingValue
      totalValue += bookingValue
    })

    return Math.round(totalValue * 100) / 100
  } catch (error) {
    console.error('Error calculating lifetime value:', error)
    return 0
  }
}

/**
 * F0625: Check if contact needs re-engagement
 */
export async function needsReengagement(contactId: number): Promise<boolean> {
  try {
    const { data: calls, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('started_at, sentiment, status')
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false })
      .limit(1)

    if (error) throw error
    if (!calls || calls.length === 0) return true

    const lastCall = calls[0]
    const daysSinceLastCall = Math.floor(
      (Date.now() - new Date(lastCall.started_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    return (
      daysSinceLastCall > 30 ||
      lastCall.sentiment === 'negative' ||
      lastCall.status === 'failed' ||
      lastCall.status === 'no-answer'
    )
  } catch (error) {
    console.error('Error checking reengagement:', error)
    return false
  }
}

/**
 * Update all metrics for a contact
 */
export async function updateContactMetrics(
  contactId: number,
  avgBookingValue: number = 100
): Promise<void> {
  try {
    const [engagementScore, bookingRate, lifetimeValue, needsReeng] = await Promise.all([
      calculateEngagementScore(contactId),
      calculateBookingRate(contactId),
      calculateLifetimeValue(contactId, avgBookingValue),
      needsReengagement(contactId),
    ])

    await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        engagement_score: engagementScore,
        booking_rate: bookingRate,
        lifetime_value: lifetimeValue,
        needs_reengagement: needsReeng,
      })
      .eq('id', contactId)
  } catch (error) {
    console.error('Error updating contact metrics:', error)
  }
}

/**
 * Get comprehensive analytics for a contact
 */
export async function getContactEngagementMetrics(contactId: number): Promise<ContactEngagementMetrics | null> {
  try {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, phone, name, engagement_score, booking_rate, lifetime_value, needs_reengagement')
      .eq('id', contactId)
      .single()

    if (contactError) throw contactError
    if (!contact) return null

    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('booking_made, sentiment, started_at')
      .eq('contact_id', contactId)

    if (callsError) throw callsError

    const callCount = calls?.length || 0
    const bookingCount = calls?.filter((c: any) => c.booking_made).length || 0

    const sentimentScores = calls
      ?.map((c: any) => {
        if (c.sentiment === 'positive') return 1
        if (c.sentiment === 'neutral') return 0
        if (c.sentiment === 'negative') return -1
        return 0
      })
      .filter((s: number) => s !== null) || []

    const avgSentiment =
      sentimentScores.length > 0
        ? sentimentScores.reduce((sum: number, s: number) => sum + s, 0) / sentimentScores.length
        : 0

    const lastActivity = calls && calls.length > 0
      ? calls.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0].started_at
      : undefined

    return {
      contactId: contact.id,
      phone: contact.phone,
      name: contact.name,
      engagementScore: contact.engagement_score || 0,
      bookingRate: contact.booking_rate || 0,
      lifetimeValue: contact.lifetime_value || 0,
      needsReengagement: contact.needs_reengagement || false,
      lastActivity,
      callCount,
      bookingCount,
      avgSentiment: Math.round(avgSentiment * 100) / 100,
    }
  } catch (error) {
    console.error('Error getting contact engagement metrics:', error)
    return null
  }
}
