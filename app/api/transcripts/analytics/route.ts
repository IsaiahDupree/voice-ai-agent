// F0479: Transcript analytics - aggregate analytics across all transcripts

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes, parsePaginationParams } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = supabaseAdmin

    // Parse filters
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const sentiment = searchParams.get('sentiment')
    const intent = searchParams.get('intent')
    const minQuality = searchParams.get('min_quality')

    // Build query
    let query = supabase.from('transcripts').select('*', { count: 'exact' })

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (sentiment) {
      query = query.eq('sentiment', sentiment)
    }
    if (intent) {
      query = query.eq('intent', intent)
    }
    if (minQuality) {
      query = query.gte('quality_score', parseInt(minQuality, 10))
    }

    const { data: transcripts, error, count } = await query

    if (error) {
      return apiError(ErrorCodes.DATABASE_ERROR, `Failed to fetch transcripts: ${error.message}`, 500)
    }

    if (!transcripts || transcripts.length === 0) {
      return apiSuccess({
        total_transcripts: 0,
        avg_quality_score: 0,
        avg_word_count: 0,
        sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
        intent_distribution: {},
        top_keywords: [],
        avg_talk_ratio: { agent: 0, user: 0 },
        language_distribution: {},
      })
    }

    // Calculate aggregate metrics
    const totalQuality = transcripts.reduce((sum, t) => sum + (t.quality_score || 0), 0)
    const totalWords = transcripts.reduce((sum, t) => sum + (t.word_count || 0), 0)

    // Sentiment distribution
    const sentimentDist = {
      positive: transcripts.filter(t => t.sentiment === 'positive').length,
      neutral: transcripts.filter(t => t.sentiment === 'neutral').length,
      negative: transcripts.filter(t => t.sentiment === 'negative').length,
    }

    // Intent distribution
    const intentDist: Record<string, number> = {}
    transcripts.forEach(t => {
      if (t.intent) {
        intentDist[t.intent] = (intentDist[t.intent] || 0) + 1
      }
    })

    // Language distribution
    const langDist: Record<string, number> = {}
    transcripts.forEach(t => {
      if (t.language) {
        langDist[t.language] = (langDist[t.language] || 0) + 1
      }
    })

    // Top keywords (flatten all keywords and count)
    const allKeywords: Record<string, number> = {}
    transcripts.forEach(t => {
      if (Array.isArray(t.keywords)) {
        t.keywords.forEach((kw: string) => {
          allKeywords[kw] = (allKeywords[kw] || 0) + 1
        })
      }
    })
    const topKeywords = Object.entries(allKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }))

    // Average talk ratio
    let totalAgentRatio = 0
    let totalUserRatio = 0
    let ratioCount = 0

    transcripts.forEach(t => {
      if (t.talk_ratio) {
        totalAgentRatio += t.talk_ratio.agent_ratio || 0
        totalUserRatio += t.talk_ratio.user_ratio || 0
        ratioCount++
      }
    })

    const analytics = {
      total_transcripts: count || transcripts.length,
      avg_quality_score: transcripts.length > 0 ? Math.round(totalQuality / transcripts.length) : 0,
      avg_word_count: transcripts.length > 0 ? Math.round(totalWords / transcripts.length) : 0,
      sentiment_distribution: sentimentDist,
      intent_distribution: intentDist,
      language_distribution: langDist,
      top_keywords: topKeywords,
      avg_talk_ratio: {
        agent: ratioCount > 0 ? Math.round(totalAgentRatio / ratioCount) : 0,
        user: ratioCount > 0 ? Math.round(totalUserRatio / ratioCount) : 0,
      },
      filters: {
        start_date: startDate,
        end_date: endDate,
        sentiment,
        intent,
        min_quality: minQuality,
      },
    }

    return apiSuccess(analytics)
  } catch (error: any) {
    console.error('Transcript analytics error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to generate analytics: ${error.message}`,
      500
    )
  }
}
