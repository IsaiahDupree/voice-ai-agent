// F0599: Contact engagement score - calculate from calls, SMS, bookings

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface ContactEngagement {
  contact_id: string
  phone: string
  name: string
  engagement_score: number
  total_calls: number
  completed_calls: number
  bookings_made: number
  sms_sent: number
  last_interaction: string
}

/**
 * Calculate engagement score based on:
 * - Completed calls: 10 points each
 * - Bookings made: 50 points each
 * - SMS sent: 5 points each
 * - Recency bonus: up to 20 points if contacted in last 7 days
 */
function calculateEngagementScore(metrics: {
  completed_calls: number
  bookings_made: number
  sms_sent: number
  last_interaction: string | null
}): number {
  let score = 0

  // Call engagement
  score += metrics.completed_calls * 10

  // Booking engagement (high value)
  score += metrics.bookings_made * 50

  // SMS engagement
  score += metrics.sms_sent * 5

  // Recency bonus
  if (metrics.last_interaction) {
    const daysSinceLastInteraction =
      (Date.now() - new Date(metrics.last_interaction).getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceLastInteraction <= 7) {
      score += 20
    } else if (daysSinceLastInteraction <= 30) {
      score += 10
    }
  }

  return score
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contact_id')
    const minScore = parseInt(searchParams.get('min_score') || '0')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (contactId) {
      // Get engagement for single contact
      const { data: contact, error: contactError } = await supabaseAdmin
        .from('voice_agent_contacts')
        .select('id, phone, name')
        .eq('id', contactId)
        .single()

      if (contactError || !contact) {
        return apiError(ErrorCodes.NOT_FOUND, 'Contact not found', 404)
      }

      // Get metrics
      const { data: calls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('status, booking_made, created_at')
        .eq('customer_phone', contact.phone)

      const { data: sms } = await supabaseAdmin
        .from('voice_agent_sms_logs')
        .select('id, created_at')
        .eq('to_phone', contact.phone)

      const completedCalls = calls?.filter((c) => c.status === 'completed').length || 0
      const bookingsMade = calls?.filter((c) => c.booking_made).length || 0
      const smsSent = sms?.length || 0

      const allInteractions = [
        ...(calls?.map((c) => c.created_at) || []),
        ...(sms?.map((s) => s.created_at) || []),
      ].sort()

      const lastInteraction = allInteractions.length > 0 ? allInteractions[allInteractions.length - 1] : null

      const engagementScore = calculateEngagementScore({
        completed_calls: completedCalls,
        bookings_made: bookingsMade,
        sms_sent: smsSent,
        last_interaction: lastInteraction,
      })

      const result: ContactEngagement = {
        contact_id: contact.id,
        phone: contact.phone,
        name: contact.name || 'Unknown',
        engagement_score: engagementScore,
        total_calls: calls?.length || 0,
        completed_calls: completedCalls,
        bookings_made: bookingsMade,
        sms_sent: smsSent,
        last_interaction: lastInteraction || '',
      }

      return apiSuccess(result)
    }

    // Get engagement scores for all contacts
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, phone, name')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (contactsError) {
      throw contactsError
    }

    const engagementData: ContactEngagement[] = []

    for (const contact of contacts || []) {
      // Get metrics for each contact
      const { data: calls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('status, booking_made, created_at')
        .eq('customer_phone', contact.phone)

      const { data: sms } = await supabaseAdmin
        .from('voice_agent_sms_logs')
        .select('id, created_at')
        .eq('to_phone', contact.phone)

      const completedCalls = calls?.filter((c) => c.status === 'completed').length || 0
      const bookingsMade = calls?.filter((c) => c.booking_made).length || 0
      const smsSent = sms?.length || 0

      const allInteractions = [
        ...(calls?.map((c) => c.created_at) || []),
        ...(sms?.map((s) => s.created_at) || []),
      ].sort()

      const lastInteraction = allInteractions.length > 0 ? allInteractions[allInteractions.length - 1] : null

      const engagementScore = calculateEngagementScore({
        completed_calls: completedCalls,
        bookings_made: bookingsMade,
        sms_sent: smsSent,
        last_interaction: lastInteraction,
      })

      // Only include if meets min score threshold
      if (engagementScore >= minScore) {
        engagementData.push({
          contact_id: contact.id,
          phone: contact.phone,
          name: contact.name || 'Unknown',
          engagement_score: engagementScore,
          total_calls: calls?.length || 0,
          completed_calls: completedCalls,
          bookings_made: bookingsMade,
          sms_sent: smsSent,
          last_interaction: lastInteraction || '',
        })
      }
    }

    // Sort by engagement score descending
    engagementData.sort((a, b) => b.engagement_score - a.engagement_score)

    return apiSuccess({
      contacts: engagementData,
      total: engagementData.length,
    })
  } catch (error: any) {
    console.error('Contact engagement error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to calculate engagement: ${error.message}`,
      500
    )
  }
}
