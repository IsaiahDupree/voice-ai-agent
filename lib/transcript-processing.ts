// F0450, F0451, F0463, F0464: Transcript processing with sentiment, summary, and action items

export interface TranscriptSegment {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  sentiment?: 'positive' | 'neutral' | 'negative'
  sentimentScore?: number // -1 to 1
}

export interface TranscriptAnalysis {
  segments: TranscriptSegment[]
  overallSentiment: 'positive' | 'neutral' | 'negative'
  overallSentimentScore: number
  summary?: string
  actionItems?: string[]
  speakerCount?: number // F0468: Count distinct speakers
  wordCount?: number // F0449: Total word count
  talkRatio?: { // F0469: Talk ratio
    agent_ratio: number
    user_ratio: number
    agent_words: number
    user_words: number
  }
  keywords?: string[] // F0452: Extracted keywords
  intent?: string // F0453: Intent classification
  entities?: Array<{ type: string; value: string }> // F0454: Named entities
  qualityScore?: number // F0466: Quality score
  language?: string // F0467: Language detection
  gaps?: Array<{ start: number; duration: number }> // F0462: Silence gaps > 3s
  nextSteps?: string[] // F0465: Suggested next steps
  silenceRatio?: number // F0470: Percentage of silence
  longestMonologue?: { role: string; duration: number; wordCount: number } // F0471: Longest monologue
}

/**
 * F0450: Add sentiment label to each transcript segment
 * Uses simple keyword-based sentiment analysis (can be upgraded to AI later)
 */
export function analyzeSentiment(text: string): {
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number
} {
  const lowerText = text.toLowerCase()

  // Positive keywords
  const positiveWords = [
    'great',
    'excellent',
    'good',
    'perfect',
    'yes',
    'absolutely',
    'definitely',
    'love',
    'wonderful',
    'fantastic',
    'amazing',
    'happy',
    'interested',
    'sounds good',
    'thank you',
    'appreciate',
    'helpful',
  ]

  // Negative keywords
  const negativeWords = [
    'no',
    'not interested',
    'busy',
    'problem',
    'issue',
    'bad',
    'terrible',
    'awful',
    'hate',
    'angry',
    'frustrated',
    'confused',
    'wrong',
    'error',
    'fail',
    'cancel',
    'unsubscribe',
  ]

  // Count matches
  let positiveScore = 0
  let negativeScore = 0

  positiveWords.forEach((word) => {
    if (lowerText.includes(word)) {
      positiveScore++
    }
  })

  negativeWords.forEach((word) => {
    if (lowerText.includes(word)) {
      negativeScore++
    }
  })

  // Calculate net sentiment score
  const netScore = positiveScore - negativeScore
  const maxScore = Math.max(positiveScore + negativeScore, 1) // Avoid division by zero

  // Normalize to -1 to 1 range
  const normalizedScore = netScore / maxScore

  // Determine sentiment label
  let sentiment: 'positive' | 'neutral' | 'negative'
  if (normalizedScore > 0.2) {
    sentiment = 'positive'
  } else if (normalizedScore < -0.2) {
    sentiment = 'negative'
  } else {
    sentiment = 'neutral'
  }

  return { sentiment, score: normalizedScore }
}

/**
 * F0451: Aggregate sentiment across all segments
 */
export function aggregateSentiment(
  segments: TranscriptSegment[]
): {
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number
} {
  if (segments.length === 0) {
    return { sentiment: 'neutral', score: 0 }
  }

  // Calculate average sentiment score
  const totalScore = segments.reduce((sum, seg) => {
    return sum + (seg.sentimentScore || 0)
  }, 0)

  const avgScore = totalScore / segments.length

  // Determine overall sentiment
  let sentiment: 'positive' | 'neutral' | 'negative'
  if (avgScore > 0.2) {
    sentiment = 'positive'
  } else if (avgScore < -0.2) {
    sentiment = 'negative'
  } else {
    sentiment = 'neutral'
  }

  return { sentiment, score: avgScore }
}

/**
 * F0450, F0451: Process transcript with sentiment analysis
 */
export function processTranscript(transcript: any): TranscriptAnalysis {
  let segments: TranscriptSegment[] = []

  // Parse transcript into segments
  if (typeof transcript === 'string') {
    // Simple string format: split by lines
    const lines = transcript.split('\n').filter((line: string) => line.trim())
    segments = lines.map((line: string) => {
      const [role, ...contentParts] = line.split(':')
      const content = contentParts.join(':').trim()
      const roleNormalized =
        role.toLowerCase().includes('user') ||
        role.toLowerCase().includes('customer')
          ? 'user'
          : 'assistant'

      const { sentiment, score } = analyzeSentiment(content)

      return {
        role: roleNormalized,
        content,
        sentiment,
        sentimentScore: score,
      }
    })
  } else if (Array.isArray(transcript)) {
    // Array of message objects
    segments = transcript.map((msg: any) => {
      const content = msg.content || msg.message || ''
      const { sentiment, score } = analyzeSentiment(content)

      return {
        role: msg.role || 'assistant',
        content,
        timestamp: msg.timestamp,
        sentiment,
        sentimentScore: score,
      }
    })
  } else if (typeof transcript === 'object' && transcript.messages) {
    // Object with messages array
    return processTranscript(transcript.messages)
  }

  // Calculate overall sentiment
  const { sentiment: overallSentiment, score: overallSentimentScore } =
    aggregateSentiment(segments)

  return {
    segments,
    overallSentiment,
    overallSentimentScore,
  }
}

/**
 * F0463: GPT generates 3-sentence summary of transcript
 */
export async function generateTranscriptSummary(
  transcript: string
): Promise<string> {
  if (!transcript || transcript.length < 20) {
    return 'No transcript available'
  }

  // If OpenAI key is available, use AI summary
  if (process.env.OPENAI_API_KEY && transcript.length > 100) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a call center analyst. Summarize phone call transcripts in exactly 3 concise sentences.',
            },
            {
              role: 'user',
              content: `Summarize this call transcript in exactly 3 sentences:\n\n${transcript.substring(
                0,
                3000
              )}`,
            },
          ],
          max_tokens: 150,
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()
      const summary = data.choices[0]?.message?.content?.trim()

      if (summary) {
        return summary
      }
    } catch (error) {
      console.error('[Transcript Summary] AI generation failed:', error)
    }
  }

  // Fallback: extractive summary (first and last exchanges)
  const lines = transcript.split('\n').filter((line: string) => line.trim())
  if (lines.length <= 3) {
    return transcript
  }

  return `${lines[0]} ... ${lines[lines.length - 1]}`
}

/**
 * F0464: GPT extracts action items from transcript
 */
export async function extractActionItems(
  transcript: string
): Promise<string[]> {
  if (!transcript || transcript.length < 20) {
    return []
  }

  // If OpenAI key is available, use AI extraction
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a call center analyst. Extract action items from phone call transcripts. Return ONLY a JSON array of strings, each string being one action item. If there are no action items, return an empty array [].',
            },
            {
              role: 'user',
              content: `Extract all action items from this call transcript:\n\n${transcript.substring(
                0,
                3000
              )}\n\nReturn as JSON array of strings.`,
            },
          ],
          max_tokens: 200,
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content?.trim()

      if (content) {
        // Try to parse as JSON array
        try {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed)) {
            return parsed.filter((item) => typeof item === 'string')
          }
        } catch {
          // If not valid JSON, split by newlines and clean up
          return content
            .split('\n')
            .map((line: string) => line.replace(/^[-*•]\s*/, '').trim())
            .filter((line: string) => line.length > 0)
        }
      }
    } catch (error) {
      console.error('[Action Items] AI extraction failed:', error)
    }
  }

  // Fallback: keyword-based extraction
  const actionKeywords = [
    'will call back',
    'will email',
    'will send',
    'follow up',
    'schedule',
    'book',
    'confirm',
    'send information',
    'contact',
    'reach out',
  ]

  const lines = transcript.toLowerCase().split('\n')
  const actionItems: string[] = []

  lines.forEach((line) => {
    actionKeywords.forEach((keyword) => {
      if (line.includes(keyword) && !actionItems.includes(line.trim())) {
        actionItems.push(line.trim())
      }
    })
  })

  return actionItems.slice(0, 5) // Limit to 5 action items
}

/**
 * F0468: Count distinct speakers in transcript
 */
export function countSpeakers(segments: TranscriptSegment[]): number {
  const uniqueRoles = new Set(segments.map((seg) => seg.role))
  return uniqueRoles.size
}

/**
 * F0449: Calculate total word count from transcript text
 */
export function calculateWordCount(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0
  }

  // Remove extra whitespace and split by spaces
  const words = text.trim().split(/\s+/).filter(word => word.length > 0)
  return words.length
}

/**
 * F0469: Calculate talk ratio (agent vs user speaking time)
 * Returns percentage of words spoken by each role
 */
export function calculateTalkRatio(segments: TranscriptSegment[]): {
  agent_ratio: number
  user_ratio: number
  agent_words: number
  user_words: number
} {
  let agentWords = 0
  let userWords = 0

  segments.forEach(seg => {
    const wordCount = calculateWordCount(seg.content)
    if (seg.role === 'assistant') {
      agentWords += wordCount
    } else if (seg.role === 'user') {
      userWords += wordCount
    }
  })

  const totalWords = agentWords + userWords

  if (totalWords === 0) {
    return { agent_ratio: 0, user_ratio: 0, agent_words: 0, user_words: 0 }
  }

  return {
    agent_ratio: Math.round((agentWords / totalWords) * 100),
    user_ratio: Math.round((userWords / totalWords) * 100),
    agent_words: agentWords,
    user_words: userWords,
  }
}

/**
 * F0452: Extract top keywords from transcript
 * Simple TF-based keyword extraction (can be upgraded to TF-IDF later)
 */
export function extractKeywords(text: string, topN: number = 10): string[] {
  if (!text || text.length < 20) {
    return []
  }

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'can', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'them', 'their', 'this', 'that', 'these', 'those',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
    'very', 's', 't', 'just', 'don', 'now', 'user', 'assistant', 'agent'
  ])

  // Tokenize and filter
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))

  // Count frequencies
  const freq: Record<string, number> = {}
  words.forEach(word => {
    freq[word] = (freq[word] || 0) + 1
  })

  // Sort by frequency and take top N
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word)
}

/**
 * F0453: Classify transcript intent
 * Determines the primary purpose of the call
 */
export function classifyIntent(text: string): string {
  const lowerText = text.toLowerCase()

  // Intent patterns
  const intents = [
    { name: 'booking', keywords: ['book', 'schedule', 'appointment', 'meeting', 'calendar', 'available', 'time slot'] },
    { name: 'support', keywords: ['help', 'issue', 'problem', 'broken', 'not working', 'error', 'fix', 'trouble'] },
    { name: 'inquiry', keywords: ['question', 'asking', 'wondering', 'information', 'know more', 'tell me', 'curious'] },
    { name: 'sales', keywords: ['price', 'cost', 'buy', 'purchase', 'interested in', 'demo', 'trial', 'quote'] },
    { name: 'cancellation', keywords: ['cancel', 'refund', 'unsubscribe', 'opt out', 'stop', 'remove'] },
    { name: 'complaint', keywords: ['complaint', 'unhappy', 'disappointed', 'terrible', 'angry', 'frustrated'] },
  ]

  // Score each intent
  const scores: Record<string, number> = {}
  intents.forEach(intent => {
    let score = 0
    intent.keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score++
      }
    })
    scores[intent.name] = score
  })

  // Find highest scoring intent
  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) {
    return 'general'
  }

  const topIntent = Object.entries(scores).find(([_, score]) => score === maxScore)
  return topIntent ? topIntent[0] : 'general'
}

/**
 * F0454: Extract named entities (names, dates, companies)
 * Simple pattern-based extraction (can be upgraded to NER later)
 */
export function extractEntities(text: string): Array<{ type: string; value: string }> {
  const entities: Array<{ type: string; value: string }> = []

  // Email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  const emails = text.match(emailRegex) || []
  emails.forEach(email => entities.push({ type: 'email', value: email }))

  // Phone number pattern (various formats)
  const phoneRegex = /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g
  const phones = text.match(phoneRegex) || []
  phones.forEach(phone => entities.push({ type: 'phone', value: phone }))

  // Date patterns (simple formats)
  const dateRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi
  const dates = text.match(dateRegex) || []
  dates.forEach(date => entities.push({ type: 'date', value: date }))

  // Dollar amounts
  const moneyRegex = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
  const amounts = text.match(moneyRegex) || []
  amounts.forEach(amount => entities.push({ type: 'money', value: amount }))

  // Capitalize words (potential names - very basic heuristic)
  const capitalizedRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g
  const names = text.match(capitalizedRegex) || []
  names.slice(0, 5).forEach(name => entities.push({ type: 'name', value: name }))

  return entities
}

/**
 * F0466: Calculate transcript quality score
 * Based on completeness, clarity, and useful data extracted
 */
export function calculateQualityScore(analysis: Partial<TranscriptAnalysis>): number {
  let score = 0

  // Base score: Has content (0-30 points)
  if (analysis.wordCount && analysis.wordCount > 0) {
    score += Math.min(30, analysis.wordCount / 10) // Up to 300 words = 30 points
  }

  // Sentiment analyzed (10 points)
  if (analysis.overallSentiment) {
    score += 10
  }

  // Summary generated (15 points)
  if (analysis.summary && analysis.summary.length > 20) {
    score += 15
  }

  // Action items extracted (15 points)
  if (analysis.actionItems && analysis.actionItems.length > 0) {
    score += 15
  }

  // Keywords extracted (10 points)
  if (analysis.keywords && analysis.keywords.length > 0) {
    score += 10
  }

  // Entities found (10 points)
  if (analysis.entities && analysis.entities.length > 0) {
    score += 10
  }

  // Intent classified (10 points)
  if (analysis.intent && analysis.intent !== 'general') {
    score += 10
  }

  // Normalize to 0-100 scale
  return Math.min(100, Math.round(score))
}

/**
 * F0467: Detect language from transcript text
 * Simple heuristic-based detection (can be upgraded to ML later)
 */
export function detectLanguage(text: string): string {
  if (!text || text.length < 20) {
    return 'unknown'
  }

  const lowerText = text.toLowerCase()

  // Spanish indicators
  const spanishWords = ['el', 'la', 'los', 'las', 'de', 'que', 'es', 'por', 'para', 'con', 'hola', 'gracias', 'señor', 'señora']
  const spanishScore = spanishWords.filter(word => lowerText.includes(` ${word} `)).length

  // French indicators
  const frenchWords = ['le', 'la', 'les', 'de', 'un', 'une', 'est', 'bonjour', 'merci', 'oui', 'non', 'avec']
  const frenchScore = frenchWords.filter(word => lowerText.includes(` ${word} `)).length

  // German indicators
  const germanWords = ['der', 'die', 'das', 'ist', 'und', 'mit', 'ein', 'eine', 'hallo', 'danke', 'gut']
  const germanScore = germanWords.filter(word => lowerText.includes(` ${word} `)).length

  // Default to English if no strong match
  const maxScore = Math.max(spanishScore, frenchScore, germanScore)

  if (maxScore < 2) {
    return 'en' // Default to English
  }

  if (spanishScore === maxScore) return 'es'
  if (frenchScore === maxScore) return 'fr'
  if (germanScore === maxScore) return 'de'

  return 'en'
}

/**
 * F0462: Detect gaps/silences longer than threshold (default 3s)
 */
export function detectGaps(
  segments: TranscriptSegment[],
  threshold: number = 3
): Array<{ start: number; duration: number }> {
  const gaps: Array<{ start: number; duration: number }> = []

  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i]
    const next = segments[i + 1]

    if (current.timestamp !== undefined && next.timestamp !== undefined) {
      // Estimate current segment duration
      const currentDuration = calculateWordCount(current.content) / 2.5 // ~2.5 words/sec
      const currentEnd = current.timestamp + currentDuration
      const gap = next.timestamp - currentEnd

      if (gap > threshold) {
        gaps.push({
          start: currentEnd,
          duration: gap,
        })
      }
    }
  }

  return gaps
}

/**
 * F0465: GPT suggests next steps based on transcript
 */
export async function suggestNextSteps(transcript: string): Promise<string[]> {
  if (!transcript || transcript.length < 20) {
    return []
  }

  // If OpenAI key is available, use AI
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a call center analyst. Based on call transcripts, suggest next steps for follow-up. Return ONLY a JSON array of 2-4 specific next steps. Each should be actionable and specific to the call.',
            },
            {
              role: 'user',
              content: `Based on this call transcript, what are the recommended next steps?\n\n${transcript.substring(
                0,
                3000
              )}\n\nReturn as JSON array of strings.`,
            },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content?.trim()

      if (content) {
        try {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed)) {
            return parsed.filter((item) => typeof item === 'string')
          }
        } catch {
          return content
            .split('\n')
            .map((line: string) => line.replace(/^[-*•]\s*/, '').trim())
            .filter((line: string) => line.length > 0)
            .slice(0, 4)
        }
      }
    } catch (error) {
      console.error('[Next Steps] AI generation failed:', error)
    }
  }

  // Fallback: extract from action items or suggest generic next steps
  return [
    'Follow up within 24 hours',
    'Send confirmation email',
    'Update CRM with call notes',
  ]
}

/**
 * F0470: Calculate silence ratio
 * Returns percentage of call that was silence
 */
export function calculateSilenceRatio(
  segments: TranscriptSegment[],
  totalDuration: number
): number {
  if (!totalDuration || totalDuration === 0) {
    return 0
  }

  // Calculate total speaking time
  let speakingTime = 0
  segments.forEach((seg) => {
    const wordCount = calculateWordCount(seg.content)
    const duration = wordCount / 2.5 // ~2.5 words/sec
    speakingTime += duration
  })

  const silenceTime = Math.max(0, totalDuration - speakingTime)
  return Math.round((silenceTime / totalDuration) * 100)
}

/**
 * F0471: Find longest continuous monologue by one speaker
 */
export function findLongestMonologue(segments: TranscriptSegment[]): {
  role: string
  duration: number
  wordCount: number
} | undefined {
  if (segments.length === 0) {
    return undefined
  }

  let longestMonologue: { role: string; duration: number; wordCount: number } | undefined = undefined
  let currentMonologue: { role: string; words: number } = { role: '', words: 0 }

  segments.forEach((seg, index) => {
    const wordCount = calculateWordCount(seg.content)

    if (seg.role === currentMonologue.role) {
      // Continue current monologue
      currentMonologue.words += wordCount
    } else {
      // Check if previous monologue was longest
      if (currentMonologue.words > 0) {
        const duration = currentMonologue.words / 2.5 // ~2.5 words/sec

        if (!longestMonologue || currentMonologue.words > longestMonologue.wordCount) {
          longestMonologue = {
            role: currentMonologue.role,
            duration,
            wordCount: currentMonologue.words,
          }
        }
      }

      // Start new monologue
      currentMonologue = { role: seg.role, words: wordCount }
    }

    // Check last segment
    if (index === segments.length - 1 && currentMonologue.words > 0) {
      const duration = currentMonologue.words / 2.5

      if (!longestMonologue || currentMonologue.words > longestMonologue.wordCount) {
        longestMonologue = {
          role: currentMonologue.role,
          duration,
          wordCount: currentMonologue.words,
        }
      }
    }
  })

  return longestMonologue
}

/**
 * F0450, F0451, F0463, F0464, F0468: Full transcript analysis
 */
export async function analyzeTranscriptFull(
  transcript: any,
  callDuration?: number
): Promise<TranscriptAnalysis> {
  // Get transcript as plain text
  let transcriptText = ''
  if (typeof transcript === 'string') {
    transcriptText = transcript
  } else if (Array.isArray(transcript)) {
    transcriptText = transcript
      .map((msg: any) => {
        const role = msg.role || 'assistant'
        const content = msg.content || msg.message || ''
        return `${role}: ${content}`
      })
      .join('\n')
  } else if (typeof transcript === 'object' && transcript.messages) {
    transcriptText = JSON.stringify(transcript.messages)
  } else {
    transcriptText = JSON.stringify(transcript)
  }

  // Process with sentiment
  const analysis = processTranscript(transcript)

  // F0468: Count speakers
  const speakerCount = countSpeakers(analysis.segments)

  // F0449: Word count
  const wordCount = calculateWordCount(transcriptText)

  // F0469: Talk ratio
  const talkRatio = calculateTalkRatio(analysis.segments)

  // F0452: Keywords
  const keywords = extractKeywords(transcriptText)

  // F0453: Intent classification
  const intent = classifyIntent(transcriptText)

  // F0454: Entity extraction
  const entities = extractEntities(transcriptText)

  // F0467: Language detection
  const language = detectLanguage(transcriptText)

  // F0462: Gap detection
  const gaps = detectGaps(analysis.segments)

  // F0470: Silence ratio (if duration provided)
  const silenceRatio = callDuration ? calculateSilenceRatio(analysis.segments, callDuration) : undefined

  // F0471: Longest monologue
  const longestMonologue = findLongestMonologue(analysis.segments)

  // Add summary, action items, and next steps (async)
  const [summary, actionItems, nextSteps] = await Promise.all([
    generateTranscriptSummary(transcriptText),
    extractActionItems(transcriptText),
    suggestNextSteps(transcriptText), // F0465
  ])

  // Build analysis result
  const fullAnalysis: TranscriptAnalysis = {
    ...analysis,
    summary,
    actionItems,
    speakerCount, // F0468
    wordCount, // F0449
    talkRatio, // F0469
    keywords, // F0452
    intent, // F0453
    entities, // F0454
    language, // F0467
    gaps, // F0462
    nextSteps, // F0465
    silenceRatio, // F0470
    longestMonologue, // F0471
  }

  // F0466: Quality score (calculated last after all analysis complete)
  fullAnalysis.qualityScore = calculateQualityScore(fullAnalysis)

  return fullAnalysis
}

/**
 * F0436, F0489: Remove disfluencies and filler words from transcript
 * Filters out "um", "uh", "er", "ah", "like", "you know", etc.
 *
 * @param text - The transcript text to clean
 * @param custom - Custom filler words to remove (optional)
 * @returns Cleaned text with filler words removed
 */
export function removeDisfluencies(text: string, custom: string[] = []): string {
  // Default disfluencies from Deepgram and common speech patterns
  const defaultFillers = [
    'um', 'uh', 'er', 'ah', 'mm', 'hmm',
    'like', 'you know', 'i mean', 'kind of', 'sort of',
    'actually', 'basically', 'literally', 'seriously',
    'right', 'okay', 'alright', 'well'
  ]

  const allFillers = [...defaultFillers, ...custom]

  // Build regex pattern
  const pattern = allFillers.map(filler => {
    // Escape special regex characters
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return `\\b${escaped}\\b`
  }).join('|')

  const regex = new RegExp(pattern, 'gi')

  // Remove fillers and clean up extra spaces
  return text
    .replace(regex, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * F0489: Alias for removeDisfluencies
 */
export const filterFillerWords = removeDisfluencies

/**
 * F0488: Group transcript segments into paragraphs
 * Combines consecutive segments from the same speaker into paragraphs
 * with natural break detection (pauses > 2s, topic shifts)
 *
 * @param segments - Array of transcript segments
 * @returns Array of paragraphs with speaker and combined text
 */
export function groupIntoParagraphs(
  segments: TranscriptSegment[]
): Array<{ speaker: string; text: string; startTime?: number; endTime?: number }> {
  if (!segments || segments.length === 0) {
    return []
  }

  const paragraphs: Array<{ speaker: string; text: string; startTime?: number; endTime?: number }> = []
  let currentParagraph: {
    speaker: string
    texts: string[]
    startTime?: number
    endTime?: number
  } | null = null

  segments.forEach((segment, index) => {
    const speaker = segment.role || 'assistant'
    const text = segment.content?.trim() || ''
    const timestamp = segment.timestamp

    if (!text) return // Skip empty segments

    // Start new paragraph if speaker changes
    if (!currentParagraph || currentParagraph.speaker !== speaker) {
      if (currentParagraph) {
        paragraphs.push({
          speaker: currentParagraph.speaker,
          text: currentParagraph.texts.join(' '),
          startTime: currentParagraph.startTime,
          endTime: currentParagraph.endTime,
        })
      }
      currentParagraph = {
        speaker,
        texts: [text],
        startTime: timestamp,
        endTime: timestamp,
      }
    } else {
      // Same speaker - check for pause > 2 seconds
      const prevSegment = segments[index - 1]
      const prevTimestamp = prevSegment?.timestamp
      const pauseDuration = timestamp && prevTimestamp ? timestamp - prevTimestamp : 0

      if (pauseDuration > 2) {
        // Long pause - start new paragraph
        paragraphs.push({
          speaker: currentParagraph.speaker,
          text: currentParagraph.texts.join(' '),
          startTime: currentParagraph.startTime,
          endTime: currentParagraph.endTime,
        })
        currentParagraph = {
          speaker,
          texts: [text],
          startTime: timestamp,
          endTime: timestamp,
        }
      } else {
        // Continue current paragraph
        currentParagraph.texts.push(text)
        currentParagraph.endTime = timestamp
      }
    }
  })

  // Add final paragraph
  if (currentParagraph) {
    const p = currentParagraph as { speaker: string; texts: string[]; startTime?: number; endTime?: number }
    paragraphs.push({
      speaker: p.speaker,
      text: p.texts.join(' '),
      startTime: p.startTime,
      endTime: p.endTime,
    })
  }

  return paragraphs
}

/**
 * F0486: Merge consecutive utterances from the same speaker
 * Simplifies transcripts by combining multiple consecutive segments
 * from the same speaker into single segments
 *
 * @param segments - Array of transcript segments
 * @returns Array of merged segments
 */
export function mergeConsecutiveUtterances(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (!segments || segments.length === 0) {
    return []
  }

  const merged: TranscriptSegment[] = []
  let current: TranscriptSegment | null = null

  segments.forEach(segment => {
    if (!current) {
      current = { ...segment }
    } else if (current.role === segment.role) {
      // Same speaker - merge content
      current.content = `${current.content} ${segment.content}`.trim()
      // Keep earliest timestamp
      if (segment.timestamp && (!current.timestamp || segment.timestamp < current.timestamp)) {
        current.timestamp = segment.timestamp
      }
      // Combine sentiment scores (average)
      if (segment.sentimentScore !== undefined && current.sentimentScore !== undefined) {
        current.sentimentScore = (current.sentimentScore + segment.sentimentScore) / 2
      }
    } else {
      // Different speaker - save current and start new
      merged.push(current)
      current = { ...segment }
    }
  })

  // Add final segment
  if (current) {
    merged.push(current)
  }

  return merged
}

/**
 * F0490: Apply custom vocabulary substitutions
 * Replaces domain-specific terms, product names, or technical jargon
 * with standardized versions
 *
 * @param text - The transcript text
 * @param vocabulary - Map of terms to replace { "original": "replacement" }
 * @param caseSensitive - Whether replacements are case-sensitive (default: false)
 * @returns Text with vocabulary substitutions applied
 */
export function applyCustomVocabulary(
  text: string,
  vocabulary: Record<string, string>,
  caseSensitive: boolean = false
): string {
  let result = text

  Object.entries(vocabulary).forEach(([original, replacement]) => {
    const flags = caseSensitive ? 'g' : 'gi'
    const regex = new RegExp(`\\b${original}\\b`, flags)
    result = result.replace(regex, replacement)
  })

  return result
}

/**
 * F0490: Common custom vocabulary presets
 */
export const VocabularyPresets = {
  /**
   * Medical/Healthcare vocabulary
   */
  medical: {
    'doc': 'doctor',
    'meds': 'medications',
    'appt': 'appointment',
    'bp': 'blood pressure',
    'rx': 'prescription',
  },

  /**
   * Business/SaaS vocabulary
   */
  business: {
    'api': 'API',
    'crm': 'CRM',
    'roi': 'ROI',
    'saas': 'SaaS',
    'b2b': 'B2B',
    'kpi': 'KPI',
  },

  /**
   * Real estate vocabulary
   */
  realEstate: {
    'sqft': 'square feet',
    'ba': 'bathroom',
    'br': 'bedroom',
    'hoa': 'HOA',
    'mls': 'MLS',
  },
}
