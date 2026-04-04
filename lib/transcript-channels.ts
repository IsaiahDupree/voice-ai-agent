// F0484: Transcript channel support - multi-channel audio transcript per channel
// F0485: Transcript timestamps offset - all timestamps relative to call start

export interface TranscriptWord {
  word: string
  start: number // F0485: Seconds from call start
  end: number
  confidence: number
  channel?: number // F0484: Channel 0=agent, channel 1=caller
}

export interface TranscriptSegment {
  speaker: string // 'agent' or 'caller'
  channel: number // F0484: Channel 0=agent, channel 1=caller
  text: string
  start: number // F0485: Seconds from call start (offset = 0 at call start)
  end: number
  words: TranscriptWord[]
}

export interface MultiChannelTranscript {
  callId: string
  callStartedAt: string // ISO timestamp of call start
  channels: {
    0: TranscriptSegment[] // Agent channel
    1: TranscriptSegment[] // Caller channel
  }
  merged: TranscriptSegment[] // Merged timeline, sorted by start time
}

/**
 * F0484, F0485: Parse Deepgram multi-channel transcript
 * Deepgram returns separate channels for agent (0) and caller (1)
 * All timestamps are relative to call start (offset = 0)
 */
export function parseMultiChannelTranscript(
  deepgramResponse: any,
  callStartedAt: string
): MultiChannelTranscript {
  const channels: { 0: TranscriptSegment[]; 1: TranscriptSegment[] } = {
    0: [], // Agent
    1: [], // Caller
  }

  // Parse Deepgram response
  const results = deepgramResponse?.results
  if (!results) {
    return {
      callId: '',
      callStartedAt,
      channels,
      merged: [],
    }
  }

  // Deepgram can return channels in results.channels array
  // Each channel has its own transcript
  if (results.channels) {
    results.channels.forEach((channelData: any, channelIndex: number) => {
      if (channelIndex > 1) return // Only support 2 channels (0 and 1)

      const segments = parseChannelSegments(channelData, channelIndex)
      channels[channelIndex as 0 | 1] = segments
    })
  } else {
    // Fallback: single channel data
    const segments = parseChannelSegments(results, 0)
    channels[0] = segments
  }

  // F0485: Merge channels into timeline, sorted by start time
  const merged = [...channels[0], ...channels[1]].sort((a, b) => a.start - b.start)

  return {
    callId: '',
    callStartedAt,
    channels,
    merged,
  }
}

/**
 * Parse segments from a single channel
 */
function parseChannelSegments(channelData: any, channelIndex: number): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  const speakerLabel = channelIndex === 0 ? 'agent' : 'caller'

  // Deepgram format: alternatives[0].words array
  const alternatives = channelData?.alternatives || []
  if (alternatives.length === 0) return segments

  const words: TranscriptWord[] = alternatives[0].words || []

  // Group words into segments (sentences or pauses)
  let currentSegment: TranscriptSegment | null = null

  words.forEach((word: any, index: number) => {
    const wordData: TranscriptWord = {
      word: word.word || word.punctuated_word || '',
      start: word.start || 0, // F0485: Already offset from call start
      end: word.end || 0,
      confidence: word.confidence || 0,
      channel: channelIndex,
    }

    // Start new segment if:
    // 1. First word
    // 2. Long pause (>1.5s since last word)
    // 3. Sentence boundary (. ! ?)
    const previousWord = index > 0 ? words[index - 1] : null
    const pauseDuration = previousWord ? wordData.start - previousWord.end : 0
    const isPause = pauseDuration > 1.5
    const isSentenceBoundary = /[.!?]$/.test(wordData.word)

    if (!currentSegment || isPause) {
      // Save previous segment
      if (currentSegment) {
        segments.push(currentSegment)
      }

      // Start new segment
      currentSegment = {
        speaker: speakerLabel,
        channel: channelIndex,
        text: wordData.word,
        start: wordData.start,
        end: wordData.end,
        words: [wordData],
      }
    } else {
      // Add to current segment
      currentSegment.text += ' ' + wordData.word
      currentSegment.end = wordData.end
      currentSegment.words.push(wordData)
    }

    // End segment on sentence boundary
    if (isSentenceBoundary && currentSegment) {
      segments.push(currentSegment)
      currentSegment = null
    }
  })

  // Add last segment
  if (currentSegment) {
    segments.push(currentSegment)
  }

  return segments
}

/**
 * F0484: Get transcript for specific channel
 */
export function getChannelTranscript(
  transcript: MultiChannelTranscript,
  channel: 0 | 1
): TranscriptSegment[] {
  return transcript.channels[channel] || []
}

/**
 * F0484: Get agent-only transcript (channel 0)
 */
export function getAgentTranscript(transcript: MultiChannelTranscript): TranscriptSegment[] {
  return getChannelTranscript(transcript, 0)
}

/**
 * F0484: Get caller-only transcript (channel 1)
 */
export function getCallerTranscript(transcript: MultiChannelTranscript): TranscriptSegment[] {
  return getChannelTranscript(transcript, 1)
}

/**
 * F0485: Convert absolute timestamp to relative offset from call start
 * Used when Deepgram returns absolute timestamps instead of relative
 */
export function absoluteToRelativeTimestamp(
  absoluteTimestamp: number,
  callStartedAt: string
): number {
  const callStartMs = new Date(callStartedAt).getTime()
  const absoluteMs = absoluteTimestamp * 1000 // Convert to ms if needed

  const offsetMs = absoluteMs - callStartMs
  return Math.max(0, offsetMs / 1000) // Return seconds, ensure non-negative
}

/**
 * F0485: Normalize all timestamps to be relative to call start
 */
export function normalizeTranscriptTimestamps(
  transcript: MultiChannelTranscript
): MultiChannelTranscript {
  // If timestamps are already relative (start at ~0), return as-is
  const firstSegment = transcript.merged[0]
  if (!firstSegment || firstSegment.start < 10) {
    // Already relative (starts within 10s of call start)
    return transcript
  }

  // Convert all timestamps to relative
  const callStartMs = new Date(transcript.callStartedAt).getTime()

  const normalizeSegment = (seg: TranscriptSegment): TranscriptSegment => ({
    ...seg,
    start: absoluteToRelativeTimestamp(seg.start, transcript.callStartedAt),
    end: absoluteToRelativeTimestamp(seg.end, transcript.callStartedAt),
    words: seg.words.map((word) => ({
      ...word,
      start: absoluteToRelativeTimestamp(word.start, transcript.callStartedAt),
      end: absoluteToRelativeTimestamp(word.end, transcript.callStartedAt),
    })),
  })

  return {
    ...transcript,
    channels: {
      0: transcript.channels[0].map(normalizeSegment),
      1: transcript.channels[1].map(normalizeSegment),
    },
    merged: transcript.merged.map(normalizeSegment),
  }
}

/**
 * Convert multi-channel transcript to plain text
 */
export function transcriptToText(
  transcript: MultiChannelTranscript,
  options: {
    includeTimestamps?: boolean
    includeSpeaker?: boolean
    channelOnly?: 0 | 1
  } = {}
): string {
  const segments = options.channelOnly !== undefined
    ? transcript.channels[options.channelOnly]
    : transcript.merged

  return segments
    .map((seg) => {
      let line = ''

      if (options.includeTimestamps) {
        line += `[${seg.start.toFixed(2)}s] `
      }

      if (options.includeSpeaker) {
        line += `${seg.speaker}: `
      }

      line += seg.text

      return line
    })
    .join('\n')
}
