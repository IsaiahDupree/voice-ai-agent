// F0491-F0497: Transcript analysis features

import { supabaseAdmin } from '@/lib/supabase'

export interface TranscriptAnalysis {
  transcript_id: number
  agent_turn_count: number // F0491
  caller_turn_count: number // F0492
  questions_detected: string[] // F0493
  objections_detected: string[] // F0494
  calls_to_action: string[] // F0495
  competitor_mentions: string[] // F0496
  topic_segments: TopicSegment[] // F0497
  analyzed_at: string
}

export interface TopicSegment {
  start_turn: number
  end_turn: number
  topic: string
  keywords: string[]
}

// F0494: Common objection patterns
const OBJECTION_PATTERNS = [
  /too expensive|too costly|can't afford|too much money|budget/i,
  /not interested|no thanks|not right now/i,
  /already have|working with|using another/i,
  /need to think|talk to|discuss with/i,
  /not sure|uncertain|hesitant/i,
  /just looking|just browsing/i,
]

// F0495: Call-to-action patterns
const CTA_PATTERNS = [
  /book a call|schedule a meeting|set up a time/i,
  /sign up|register|join/i,
  /buy now|purchase|order/i,
  /get started|start now/i,
  /free trial|demo/i,
  /contact us|reach out/i,
]

// F0496: Common competitors (customizable per campaign)
const DEFAULT_COMPETITORS = [
  'competitor',
  'alternative',
  'other company',
  'other service',
]

/**
 * F0491-F0497: Analyze transcript and extract metrics
 */
export async function analyzeTranscript(
  transcriptId: number,
  transcriptContent: string,
  competitors?: string[]
): Promise<TranscriptAnalysis> {
  // Split transcript into turns (assuming format like "Agent: ..." and "Caller: ...")
  const turns = parseTranscriptTurns(transcriptContent)

  // F0491: Count agent turns
  const agentTurns = turns.filter(t => t.speaker === 'agent')
  const agentTurnCount = agentTurns.length

  // F0492: Count caller turns
  const callerTurns = turns.filter(t => t.speaker === 'caller')
  const callerTurnCount = callerTurns.length

  // F0493: Detect questions
  const questionsDetected = detectQuestions(turns)

  // F0494: Detect objections
  const objectionsDetected = detectObjections(turns)

  // F0495: Detect calls-to-action
  const callsToAction = detectCallsToAction(turns)

  // F0496: Detect competitor mentions
  const competitorMentions = detectCompetitorMentions(turns, competitors || DEFAULT_COMPETITORS)

  // F0497: Segment by topics
  const topicSegments = segmentByTopics(turns)

  const analysis: TranscriptAnalysis = {
    transcript_id: transcriptId,
    agent_turn_count: agentTurnCount,
    caller_turn_count: callerTurnCount,
    questions_detected: questionsDetected,
    objections_detected: objectionsDetected,
    calls_to_action: callsToAction,
    competitor_mentions: competitorMentions,
    topic_segments: topicSegments,
    analyzed_at: new Date().toISOString(),
  }

  // Store analysis
  await storeAnalysis(analysis)

  return analysis
}

/**
 * Parse transcript into turns
 */
interface TranscriptTurn {
  speaker: 'agent' | 'caller'
  text: string
  turn_index: number
}

function parseTranscriptTurns(transcript: string): TranscriptTurn[] {
  const lines = transcript.split('\n').filter(l => l.trim())
  const turns: TranscriptTurn[] = []
  let turnIndex = 0

  for (const line of lines) {
    const agentMatch = line.match(/^(Agent|Assistant|AI):\s*(.+)/i)
    const callerMatch = line.match(/^(Caller|Customer|User):\s*(.+)/i)

    if (agentMatch) {
      turns.push({
        speaker: 'agent',
        text: agentMatch[2].trim(),
        turn_index: turnIndex++,
      })
    } else if (callerMatch) {
      turns.push({
        speaker: 'caller',
        text: callerMatch[2].trim(),
        turn_index: turnIndex++,
      })
    }
  }

  return turns
}

/**
 * F0493: Detect questions in transcript
 */
function detectQuestions(turns: TranscriptTurn[]): string[] {
  const questions: string[] = []

  for (const turn of turns) {
    // Look for sentences ending with "?"
    const questionMatches = turn.text.match(/[^.!?]*\?/g)
    if (questionMatches) {
      questions.push(...questionMatches.map(q => `[${turn.speaker}] ${q.trim()}`))
    }
  }

  return questions
}

/**
 * F0494: Detect objections
 */
function detectObjections(turns: TranscriptTurn[]): string[] {
  const objections: string[] = []

  for (const turn of turns) {
    if (turn.speaker === 'caller') {
      for (const pattern of OBJECTION_PATTERNS) {
        if (pattern.test(turn.text)) {
          objections.push(turn.text)
          break // Only add once per turn
        }
      }
    }
  }

  return objections
}

/**
 * F0495: Detect calls-to-action
 */
function detectCallsToAction(turns: TranscriptTurn[]): string[] {
  const ctas: string[] = []

  for (const turn of turns) {
    if (turn.speaker === 'agent') {
      for (const pattern of CTA_PATTERNS) {
        if (pattern.test(turn.text)) {
          ctas.push(turn.text)
          break
        }
      }
    }
  }

  return ctas
}

/**
 * F0496: Detect competitor mentions
 */
function detectCompetitorMentions(turns: TranscriptTurn[], competitors: string[]): string[] {
  const mentions: string[] = []

  for (const turn of turns) {
    const lowerText = turn.text.toLowerCase()
    for (const competitor of competitors) {
      if (lowerText.includes(competitor.toLowerCase())) {
        mentions.push(`[${turn.speaker}] mentioned "${competitor}": ${turn.text}`)
      }
    }
  }

  return mentions
}

/**
 * F0497: Segment transcript by topics
 */
function segmentByTopics(turns: TranscriptTurn[]): TopicSegment[] {
  const segments: TopicSegment[] = []
  let currentSegment: Partial<TopicSegment> | null = null

  // Simple topic detection based on keywords
  const topicKeywords: Record<string, string[]> = {
    pricing: ['price', 'cost', 'expensive', 'budget', 'payment', 'fee'],
    features: ['feature', 'capability', 'function', 'does it', 'can it'],
    onboarding: ['start', 'setup', 'onboard', 'begin', 'implement'],
    support: ['support', 'help', 'assistance', 'contact'],
    scheduling: ['schedule', 'book', 'calendar', 'appointment', 'meeting'],
  }

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    const lowerText = turn.text.toLowerCase()

    // Determine topic of this turn
    let detectedTopic = 'general'
    let matchedKeywords: string[] = []

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const matched = keywords.filter(kw => lowerText.includes(kw))
      if (matched.length > 0) {
        detectedTopic = topic
        matchedKeywords = matched
        break
      }
    }

    // Start new segment or continue current
    if (!currentSegment || currentSegment.topic !== detectedTopic) {
      // Close previous segment
      if (currentSegment) {
        currentSegment.end_turn = i - 1
        segments.push(currentSegment as TopicSegment)
      }

      // Start new segment
      currentSegment = {
        start_turn: i,
        topic: detectedTopic,
        keywords: matchedKeywords,
      }
    } else {
      // Add keywords to current segment
      const allKeywords = (currentSegment.keywords || []).concat(matchedKeywords)
      currentSegment.keywords = Array.from(new Set(allKeywords))
    }
  }

  // Close final segment
  if (currentSegment) {
    currentSegment.end_turn = turns.length - 1
    segments.push(currentSegment as TopicSegment)
  }

  return segments
}

/**
 * Store analysis in database
 */
async function storeAnalysis(analysis: TranscriptAnalysis): Promise<void> {
  await supabaseAdmin
    .from('transcript_analysis')
    .upsert({
      transcript_id: analysis.transcript_id,
      agent_turn_count: analysis.agent_turn_count,
      caller_turn_count: analysis.caller_turn_count,
      questions_detected: analysis.questions_detected,
      objections_detected: analysis.objections_detected,
      calls_to_action: analysis.calls_to_action,
      competitor_mentions: analysis.competitor_mentions,
      topic_segments: analysis.topic_segments,
      analyzed_at: analysis.analyzed_at,
    }, { onConflict: 'transcript_id' })
}

/**
 * Get analysis for a transcript
 */
export async function getTranscriptAnalysis(transcriptId: number): Promise<TranscriptAnalysis | null> {
  const { data, error } = await supabaseAdmin
    .from('transcript_analysis')
    .select('*')
    .eq('transcript_id', transcriptId)
    .single()

  if (error || !data) return null

  return data as TranscriptAnalysis
}
