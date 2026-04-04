// F0867: Transcript analytics - keyword extraction, topic analysis, pattern detection

import { supabaseAdmin } from './supabase'

export interface KeywordFrequency {
  keyword: string
  count: number
  percentage: number
}

export interface ObjectionPattern {
  objection: string
  count: number
  percentage: number
  sentiment: 'negative' | 'neutral'
}

export interface TranscriptInsights {
  totalWords: number
  avgWordsPerCall: number
  topKeywords: KeywordFrequency[]
  commonObjections: ObjectionPattern[]
  conversationPatterns: {
    avgTurns: number
    avgAgentTalkTime: number
    avgCustomerTalkTime: number
  }
}

// Common objection phrases to track
const OBJECTION_PATTERNS = [
  { pattern: /not interested/gi, label: 'not interested' },
  { pattern: /no thanks/gi, label: 'no thanks' },
  { pattern: /too expensive/gi, label: 'too expensive' },
  { pattern: /not right now/gi, label: 'not right now' },
  { pattern: /call me back/gi, label: 'call me back' },
  { pattern: /already have/gi, label: 'already have solution' },
  { pattern: /need to think/gi, label: 'need to think' },
  { pattern: /talk to (my )?partner|spouse|wife|husband/gi, label: 'need to consult' },
  { pattern: /don't have time/gi, label: 'no time' },
  { pattern: /remove.*(list|number)|stop calling|don't call/gi, label: 'do not call' },
]

// Common filler words to exclude from keyword analysis
const FILLER_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'so',
  'um', 'uh', 'like', 'yeah', 'yes', 'no', 'okay', 'ok', 'well', 'just',
  'really', 'very', 'quite', 'actually', 'basically', 'literally',
])

/**
 * F0868: Extract keyword frequency from transcripts
 */
export async function getKeywordFrequency(
  startDate?: string,
  endDate?: string,
  personaId?: string,
  limit: number = 50
): Promise<KeywordFrequency[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_transcripts')
      .select('text, call_id')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: transcripts, error } = await query

    if (error) throw error
    if (!transcripts || transcripts.length === 0) return []

    // If persona filter, join with calls table
    let filteredTranscripts = transcripts
    if (personaId) {
      const callIds = new Set(transcripts.map(t => t.call_id))
      const { data: calls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('call_id')
        .eq('vapi_assistant_id', personaId)
        .in('call_id', Array.from(callIds))

      const personaCallIds = new Set(calls?.map(c => c.call_id) || [])
      filteredTranscripts = transcripts.filter(t => personaCallIds.has(t.call_id))
    }

    // Extract and count keywords
    const wordCounts = new Map<string, number>()
    let totalWords = 0

    filteredTranscripts.forEach((transcript: any) => {
      const words = transcript.text
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter((w: string) => w.length > 3 && !FILLER_WORDS.has(w))

      words.forEach((word: string) => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
        totalWords++
      })
    })

    // Sort by frequency and return top N
    const keywords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([keyword, count]) => ({
        keyword,
        count,
        percentage: totalWords > 0 ? (count / totalWords) * 100 : 0,
      }))

    return keywords
  } catch (error) {
    console.error('Error extracting keywords:', error)
    return []
  }
}

/**
 * F0869: Detect and count objection patterns in transcripts
 */
export async function getObjectionFrequency(
  startDate?: string,
  endDate?: string,
  personaId?: string
): Promise<ObjectionPattern[]> {
  try {
    let query = supabaseAdmin
      .from('voice_agent_transcripts')
      .select('text, call_id, speaker')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: transcripts, error } = await query

    if (error) throw error
    if (!transcripts || transcripts.length === 0) return []

    // Filter by persona if provided
    let filteredTranscripts = transcripts
    if (personaId) {
      const callIds = new Set(transcripts.map(t => t.call_id))
      const { data: calls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('call_id')
        .eq('vapi_assistant_id', personaId)
        .in('call_id', Array.from(callIds))

      const personaCallIds = new Set(calls?.map(c => c.call_id) || [])
      filteredTranscripts = transcripts.filter(t => personaCallIds.has(t.call_id))
    }

    // Only look at customer/user transcripts (not agent)
    const customerTranscripts = filteredTranscripts.filter(
      (t: any) => t.speaker === 'user' || t.speaker === 'customer'
    )

    // Count objection patterns
    const objectionCounts = new Map<string, number>()
    let totalTranscripts = customerTranscripts.length

    customerTranscripts.forEach((transcript: any) => {
      OBJECTION_PATTERNS.forEach(({ pattern, label }) => {
        if (pattern.test(transcript.text)) {
          objectionCounts.set(label, (objectionCounts.get(label) || 0) + 1)
        }
      })
    })

    // Sort by frequency
    const objections = Array.from(objectionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([objection, count]) => ({
        objection,
        count,
        percentage: totalTranscripts > 0 ? (count / totalTranscripts) * 100 : 0,
        sentiment: objection === 'need to think' || objection === 'need to consult'
          ? 'neutral' as const
          : 'negative' as const,
      }))

    return objections
  } catch (error) {
    console.error('Error detecting objections:', error)
    return []
  }
}

/**
 * F0867: Get comprehensive transcript analytics
 */
export async function getTranscriptInsights(
  startDate?: string,
  endDate?: string,
  personaId?: string
): Promise<TranscriptInsights> {
  try {
    // Get all transcripts with call info
    let query = supabaseAdmin
      .from('voice_agent_transcripts')
      .select('text, call_id, speaker, created_at')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: transcripts, error } = await query

    if (error) throw error
    if (!transcripts || transcripts.length === 0) {
      return {
        totalWords: 0,
        avgWordsPerCall: 0,
        topKeywords: [],
        commonObjections: [],
        conversationPatterns: {
          avgTurns: 0,
          avgAgentTalkTime: 0,
          avgCustomerTalkTime: 0,
        },
      }
    }

    // Filter by persona if provided
    let filteredTranscripts = transcripts
    if (personaId) {
      const callIds = new Set(transcripts.map(t => t.call_id))
      const { data: calls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('call_id')
        .eq('vapi_assistant_id', personaId)
        .in('call_id', Array.from(callIds))

      const personaCallIds = new Set(calls?.map(c => c.call_id) || [])
      filteredTranscripts = transcripts.filter(t => personaCallIds.has(t.call_id))
    }

    // Group by call
    const callMap = new Map<string, any[]>()
    filteredTranscripts.forEach((t: any) => {
      if (!callMap.has(t.call_id)) {
        callMap.set(t.call_id, [])
      }
      callMap.get(t.call_id)!.push(t)
    })

    // Calculate conversation patterns
    let totalTurns = 0
    let totalAgentWords = 0
    let totalCustomerWords = 0
    let totalWords = 0

    callMap.forEach((callTranscripts) => {
      totalTurns += callTranscripts.length

      callTranscripts.forEach((t: any) => {
        const wordCount = t.text.split(/\s+/).length
        totalWords += wordCount

        if (t.speaker === 'assistant' || t.speaker === 'agent') {
          totalAgentWords += wordCount
        } else {
          totalCustomerWords += wordCount
        }
      })
    })

    const totalCalls = callMap.size
    const avgTurns = totalCalls > 0 ? totalTurns / totalCalls : 0
    const avgWordsPerCall = totalCalls > 0 ? totalWords / totalCalls : 0

    // Get top keywords and objections
    const [topKeywords, commonObjections] = await Promise.all([
      getKeywordFrequency(startDate, endDate, personaId, 20),
      getObjectionFrequency(startDate, endDate, personaId),
    ])

    return {
      totalWords,
      avgWordsPerCall: Math.round(avgWordsPerCall),
      topKeywords,
      commonObjections,
      conversationPatterns: {
        avgTurns: Math.round(avgTurns * 10) / 10,
        avgAgentTalkTime: totalWords > 0 ? (totalAgentWords / totalWords) * 100 : 0,
        avgCustomerTalkTime: totalWords > 0 ? (totalCustomerWords / totalWords) * 100 : 0,
      },
    }
  } catch (error) {
    console.error('Error calculating transcript insights:', error)
    return {
      totalWords: 0,
      avgWordsPerCall: 0,
      topKeywords: [],
      commonObjections: [],
      conversationPatterns: {
        avgTurns: 0,
        avgAgentTalkTime: 0,
        avgCustomerTalkTime: 0,
      },
    }
  }
}
