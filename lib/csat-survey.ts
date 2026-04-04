// F0161: Caller satisfaction survey (CSAT) at call end

import { supabaseAdmin } from '@/lib/supabase'

export interface CSATSurveyConfig {
  enabled: boolean
  question: string
  scale: '1-5' | '1-10' | 'nps' // NPS = -10 to +10
  followUpQuestion?: string // Optional: "Why did you give that rating?"
  threshold?: number // If rating below this, trigger alert
}

export const DEFAULT_CSAT_CONFIG: CSATSurveyConfig = {
  enabled: true,
  question: 'On a scale of 1 to 5, how satisfied were you with this call?',
  scale: '1-5',
  followUpQuestion: 'Thank you. Would you like to share any additional feedback?',
  threshold: 3, // Alert if rating is below 3
}

/**
 * F0161: Record CSAT survey response
 */
export async function recordCSATResponse(data: {
  callId: string
  contactId?: string
  rating: number
  feedback?: string
  surveyConfig: CSATSurveyConfig
}): Promise<{ success: boolean; surveyId?: string }> {
  try {
    const { callId, contactId, rating, feedback, surveyConfig } = data

    // Validate rating based on scale
    let isValid = false
    switch (surveyConfig.scale) {
      case '1-5':
        isValid = rating >= 1 && rating <= 5
        break
      case '1-10':
        isValid = rating >= 1 && rating <= 10
        break
      case 'nps':
        isValid = rating >= -10 && rating <= 10
        break
    }

    if (!isValid) {
      throw new Error(`Invalid rating ${rating} for scale ${surveyConfig.scale}`)
    }

    // Save to database
    const { data: survey, error } = await supabaseAdmin
      .from('csat_responses')
      .insert({
        call_id: callId,
        contact_id: contactId,
        rating,
        feedback,
        scale: surveyConfig.scale,
        question: surveyConfig.question,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[CSAT] Failed to save survey response:', error)
      return { success: false }
    }

    // Check if rating is below threshold (indicates dissatisfaction)
    if (surveyConfig.threshold && rating < surveyConfig.threshold) {
      // Trigger alert (could send to Slack, email, etc.)
      console.warn(`[CSAT] Low satisfaction rating detected: ${rating}/${surveyConfig.scale} for call ${callId}`)

      // Update call log with alert flag
      await supabaseAdmin
        .from('call_logs')
        .update({ low_csat: true, csat_rating: rating })
        .eq('id', callId)
    } else {
      // Just update the call log with the rating
      await supabaseAdmin
        .from('call_logs')
        .update({ csat_rating: rating })
        .eq('id', callId)
    }

    console.log(`[CSAT] Recorded survey response: ${rating}/${surveyConfig.scale} for call ${callId}`)

    return {
      success: true,
      surveyId: survey.id,
    }
  } catch (error) {
    console.error('[CSAT] Error recording survey:', error)
    return { success: false }
  }
}

/**
 * F0161: Get CSAT survey configuration for an assistant
 */
export async function getCSATConfig(assistantId: string): Promise<CSATSurveyConfig> {
  try {
    const { data, error } = await supabaseAdmin
      .from('assistant_config')
      .select('csat_config')
      .eq('assistant_id', assistantId)
      .single()

    if (error || !data?.csat_config) {
      return DEFAULT_CSAT_CONFIG
    }

    return data.csat_config as CSATSurveyConfig
  } catch (error) {
    console.error('[CSAT] Error fetching config:', error)
    return DEFAULT_CSAT_CONFIG
  }
}

/**
 * F0161: Update CSAT survey configuration for an assistant
 */
export async function updateCSATConfig(
  assistantId: string,
  config: CSATSurveyConfig
): Promise<{ success: boolean }> {
  try {
    const { error } = await supabaseAdmin
      .from('assistant_config')
      .upsert({
        assistant_id: assistantId,
        csat_config: config,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('[CSAT] Failed to update config:', error)
      return { success: false }
    }

    return { success: true }
  } catch (error) {
    console.error('[CSAT] Error updating config:', error)
    return { success: false }
  }
}

/**
 * F0161: Get CSAT statistics for a time period
 */
export async function getCSATStats(params: {
  assistantId?: string
  dateFrom?: string
  dateTo?: string
}): Promise<{
  averageRating: number
  totalResponses: number
  distribution: Record<number, number>
  lowSatisfactionCount: number
}> {
  try {
    // Build query based on whether we're filtering by assistant
    let query

    if (params.assistantId) {
      // Join with call_logs to filter by assistant
      query = supabaseAdmin
        .from('csat_responses')
        .select('rating, scale, created_at, call_logs!inner(assistant_id)')
        .eq('call_logs.assistant_id', params.assistantId)
    } else {
      query = supabaseAdmin
        .from('csat_responses')
        .select('rating, scale, created_at')
    }

    // Apply date filters
    if (params.dateFrom) {
      query = query.gte('created_at', params.dateFrom)
    }

    if (params.dateTo) {
      query = query.lte('created_at', params.dateTo)
    }

    const { data, error } = await query

    if (error) {
      console.error('[CSAT] Error fetching stats:', error)
      return {
        averageRating: 0,
        totalResponses: 0,
        distribution: {},
        lowSatisfactionCount: 0,
      }
    }

    if (!data || data.length === 0) {
      return {
        averageRating: 0,
        totalResponses: 0,
        distribution: {},
        lowSatisfactionCount: 0,
      }
    }

    // Calculate statistics
    const ratings = data.map((r: any) => r.rating)
    const averageRating = ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length

    // Count distribution
    const distribution: Record<number, number> = {}
    ratings.forEach((r: number) => {
      distribution[r] = (distribution[r] || 0) + 1
    })

    // Count low satisfaction (rating < 3 for 1-5 scale, < 6 for 1-10 scale)
    const lowSatisfactionCount = ratings.filter((r: number) => {
      const scale = data.find((d: any) => d.rating === r)?.scale
      if (scale === '1-5') return r < 3
      if (scale === '1-10') return r < 6
      if (scale === 'nps') return r < 0
      return false
    }).length

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalResponses: data.length,
      distribution,
      lowSatisfactionCount,
    }
  } catch (error) {
    console.error('[CSAT] Error calculating stats:', error)
    return {
      averageRating: 0,
      totalResponses: 0,
      distribution: {},
      lowSatisfactionCount: 0,
    }
  }
}

/**
 * F0161: Generate CSAT survey script for Vapi assistant
 * This returns the text that should be spoken at call end
 */
export function generateCSATScript(config: CSATSurveyConfig): string {
  let script = config.question

  // Add response options
  switch (config.scale) {
    case '1-5':
      script += ' Please say a number from 1 to 5, where 1 is very dissatisfied and 5 is very satisfied.'
      break
    case '1-10':
      script += ' Please say a number from 1 to 10, where 1 is very dissatisfied and 10 is very satisfied.'
      break
    case 'nps':
      script += ' On a scale from 0 to 10, how likely are you to recommend us to a friend or colleague?'
      break
  }

  return script
}
