// F0444: Dashboard shows transcript with speaker labels
// F0450, F0451: Display sentiment per segment and overall
// F0459, F0460, F0461: Real-time transcript streaming
// F0445: Transcript timestamp display on hover
// F0446: Transcript highlight search

'use client'

import { useEffect, useState, useRef } from 'react'
import {
  subscribeToTranscript,
  TranscriptStreamUpdate,
  PartialSegmentBuffer,
} from '@/lib/transcript-stream'

interface TranscriptSegment {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  sentiment?: 'positive' | 'neutral' | 'negative'
  sentimentScore?: number
}

interface TranscriptData {
  id: string
  call_id: string
  transcript: any
  transcript_text: string
  duration?: number
  metadata?: {
    sentiment?: 'positive' | 'neutral' | 'negative'
    sentiment_score?: number
    summary?: string
    action_items?: string[]
    redacted_fields?: string[]
  }
  created_at: string
}

interface TranscriptDisplayProps {
  callId: string
  showMetadata?: boolean
  realtime?: boolean // F0459: Enable real-time streaming
}

export default function TranscriptDisplay({
  callId,
  showMetadata = true,
  realtime = false,
}: TranscriptDisplayProps) {
  const [transcript, setTranscript] = useState<TranscriptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false) // F0459: Live streaming indicator
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>([]) // F0460: Real-time segments
  const partialBuffer = useRef(new PartialSegmentBuffer()) // F0461: Partial segment buffer
  const segmentIdCounter = useRef(0)
  const [searchQuery, setSearchQuery] = useState('') // F0446: Search query
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null) // F0445: Hovered segment for timestamp

  useEffect(() => {
    loadTranscript()
  }, [callId])

  // F0459, F0460: Subscribe to real-time transcript updates
  useEffect(() => {
    if (!realtime || !callId) {
      return
    }

    const unsubscribe = subscribeToTranscript(callId, handleTranscriptUpdate)

    return () => {
      unsubscribe()
    }
  }, [callId, realtime])

  /**
   * F0460: Handle real-time transcript update
   */
  function handleTranscriptUpdate(update: TranscriptStreamUpdate) {
    if (update.status === 'started') {
      setIsLive(true)
      setLiveSegments([])
    } else if (update.status === 'completed') {
      setIsLive(false)
      // Reload full transcript
      loadTranscript()
    } else if (update.segment) {
      // F0461: Handle partial or complete segment
      handleSegmentUpdate(update.segment)
    }
  }

  /**
   * F0461: Handle partial and complete segment updates
   */
  function handleSegmentUpdate(segment: {
    role: 'user' | 'assistant'
    content: string
    timestamp?: number
    partial?: boolean
  }) {
    setLiveSegments((prev) => {
      if (segment.partial) {
        // F0461: Partial segment - update or add to live segments
        const lastSegment = prev[prev.length - 1]
        if (
          lastSegment &&
          lastSegment.role === segment.role &&
          lastSegment.timestamp === segment.timestamp
        ) {
          // Update existing partial segment
          return [
            ...prev.slice(0, -1),
            {
              ...lastSegment,
              content: segment.content,
            },
          ]
        } else {
          // Add new partial segment
          return [
            ...prev,
            {
              role: segment.role,
              content: segment.content,
              timestamp: segment.timestamp || Date.now(),
            },
          ]
        }
      } else {
        // Final segment
        const lastSegment = prev[prev.length - 1]
        if (
          lastSegment &&
          lastSegment.role === segment.role &&
          lastSegment.timestamp === segment.timestamp
        ) {
          // Replace partial with final
          return [
            ...prev.slice(0, -1),
            {
              role: segment.role,
              content: segment.content,
              timestamp: segment.timestamp || Date.now(),
            },
          ]
        } else {
          // Add new final segment
          return [
            ...prev,
            {
              role: segment.role,
              content: segment.content,
              timestamp: segment.timestamp || Date.now(),
            },
          ]
        }
      }
    })
  }

  async function loadTranscript() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/transcripts?call_id=${callId}`)

      if (!res.ok) {
        throw new Error('Failed to load transcript')
      }

      const data = await res.json()

      if (data.transcripts && data.transcripts.length > 0) {
        setTranscript(data.transcripts[0])
      } else {
        setError('No transcript found for this call')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load transcript')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-4 text-gray-400">Loading transcript...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center py-8">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!transcript) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center py-8">
          <p className="text-gray-400">No transcript available</p>
        </div>
      </div>
    )
  }

  // Parse transcript segments
  // F0460: Use live segments if streaming, otherwise use stored transcript
  const segments = isLive && liveSegments.length > 0
    ? liveSegments
    : parseTranscriptSegments(transcript.transcript)

  // F0451: Overall sentiment
  const overallSentiment =
    transcript.metadata?.sentiment || calculateOverallSentiment(segments)
  const overallSentimentScore = transcript.metadata?.sentiment_score || 0

  /**
   * F0446: Highlight search terms in text
   */
  function highlightText(text: string, query: string): React.ReactNode {
    if (!query.trim()) {
      return text
    }

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-400 text-gray-900 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  /**
   * F0445: Format timestamp for display
   */
  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return '0:00'
    const seconds = Math.floor(timestamp / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      {/* Header with overall sentiment */}
      <div className="p-6 border-b border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">Call Transcript</h2>
            {/* F0459: Live streaming indicator */}
            {isLive && (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-900/50 text-red-400 border border-red-700 rounded text-sm animate-pulse">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                LIVE
              </span>
            )}
          </div>
          {/* F0451: Overall sentiment badge */}
          <div className="flex items-center gap-3">
            <SentimentBadge
              sentiment={overallSentiment}
              score={overallSentimentScore}
              size="large"
            />
            {transcript.duration && (
              <span className="text-sm text-gray-400">
                {formatDuration(transcript.duration)}
              </span>
            )}
          </div>
        </div>

        {/* F0446: Search bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* PII Redaction Notice */}
        {transcript.metadata?.redacted_fields &&
          transcript.metadata.redacted_fields.length > 0 && (
            <div className="mt-4 bg-yellow-900/20 border border-yellow-700/50 rounded p-3">
              <p className="text-sm text-yellow-400">
                🔒 Sensitive information redacted:{' '}
                {transcript.metadata.redacted_fields.join(', ')}
              </p>
            </div>
          )}
      </div>

      {/* Metadata section */}
      {showMetadata && (transcript.metadata?.summary || transcript.metadata?.action_items) && (
        <div className="p-6 border-b border-gray-700 bg-gray-750 space-y-4">
          {/* F0463: Summary */}
          {transcript.metadata.summary && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Summary
              </h3>
              <p className="text-gray-200">{transcript.metadata.summary}</p>
            </div>
          )}

          {/* F0464: Action Items */}
          {transcript.metadata.action_items &&
            transcript.metadata.action_items.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">
                  Action Items
                </h3>
                <ul className="space-y-1">
                  {transcript.metadata.action_items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}

      {/* Transcript segments */}
      <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
        {segments.map((segment, idx) => {
          // F0446: Filter segments by search query
          if (searchQuery && !segment.content.toLowerCase().includes(searchQuery.toLowerCase())) {
            return null
          }

          return (
            <div
              key={idx}
              className={`flex gap-4 ${
                segment.role === 'user' ? 'flex-row' : 'flex-row-reverse'
              }`}
              onMouseEnter={() => setHoveredSegmentIndex(idx)} // F0445
              onMouseLeave={() => setHoveredSegmentIndex(null)} // F0445
            >
              {/* F0444: Speaker label */}
              <div
                className={`flex-shrink-0 w-20 text-right ${
                  segment.role === 'user' ? 'text-left' : 'text-right'
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    segment.role === 'user'
                      ? 'text-blue-400'
                      : 'text-purple-400'
                  }`}
                >
                  {segment.role === 'user' ? 'Caller' : 'Agent'}
                </span>
                {/* F0445: Timestamp display on hover */}
                {hoveredSegmentIndex === idx && segment.timestamp && (
                  <div className="text-xs text-gray-400 mt-1">
                    {formatTimestamp(segment.timestamp)}
                  </div>
                )}
                {/* F0450: Sentiment per segment */}
                {segment.sentiment && (
                  <div className="mt-1">
                    <SentimentBadge
                      sentiment={segment.sentiment}
                      score={segment.sentimentScore}
                      size="small"
                    />
                  </div>
                )}
              </div>

              {/* Message content */}
              <div
                className={`flex-1 rounded-lg p-4 ${
                  segment.role === 'user'
                    ? 'bg-blue-900/30 border border-blue-700/50'
                    : 'bg-purple-900/30 border border-purple-700/50'
                }`}
              >
                {/* F0446: Highlighted content */}
                <p className="text-gray-200">{highlightText(segment.content, searchQuery)}</p>
              </div>
            </div>
          )
        })}

        {segments.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            No transcript segments available
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * F0450: Sentiment badge component
 */
function SentimentBadge({
  sentiment,
  score,
  size = 'small',
}: {
  sentiment: 'positive' | 'neutral' | 'negative'
  score?: number
  size?: 'small' | 'large'
}) {
  const colors = {
    positive: 'bg-green-900/50 text-green-400 border-green-700',
    neutral: 'bg-gray-700 text-gray-400 border-gray-600',
    negative: 'bg-red-900/50 text-red-400 border-red-700',
  }

  const icons = {
    positive: '😊',
    neutral: '😐',
    negative: '😞',
  }

  const sizeClasses = size === 'large' ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-xs'

  return (
    <div
      className={`inline-flex items-center gap-2 rounded border ${colors[sentiment]} ${sizeClasses}`}
    >
      <span>{icons[sentiment]}</span>
      <span className="font-semibold capitalize">{sentiment}</span>
      {score !== undefined && (
        <span className="text-xs opacity-75">
          ({score > 0 ? '+' : ''}
          {score.toFixed(2)})
        </span>
      )}
    </div>
  )
}

/**
 * Parse transcript into segments
 */
function parseTranscriptSegments(transcript: any): TranscriptSegment[] {
  if (Array.isArray(transcript)) {
    return transcript.map((msg: any) => ({
      role: msg.role || 'assistant',
      content: msg.content || msg.message || '',
      timestamp: msg.timestamp,
      sentiment: msg.sentiment,
      sentimentScore: msg.sentimentScore,
    }))
  }

  if (typeof transcript === 'string') {
    // Parse "role: content" format
    const lines = transcript.split('\n').filter((line) => line.trim())
    return lines.map((line) => {
      const [rolePart, ...contentParts] = line.split(':')
      const content = contentParts.join(':').trim()
      const role =
        rolePart.toLowerCase().includes('user') ||
        rolePart.toLowerCase().includes('caller')
          ? 'user'
          : 'assistant'

      return {
        role,
        content,
      }
    })
  }

  if (typeof transcript === 'object' && transcript.messages) {
    return parseTranscriptSegments(transcript.messages)
  }

  return []
}

/**
 * Calculate overall sentiment from segments
 */
function calculateOverallSentiment(
  segments: TranscriptSegment[]
): 'positive' | 'neutral' | 'negative' {
  if (segments.length === 0) return 'neutral'

  const sentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
  }

  segments.forEach((seg) => {
    if (seg.sentiment) {
      sentimentCounts[seg.sentiment]++
    }
  })

  // Return the most common sentiment
  if (sentimentCounts.positive > sentimentCounts.negative) {
    return 'positive'
  } else if (sentimentCounts.negative > sentimentCounts.positive) {
    return 'negative'
  }
  return 'neutral'
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}
