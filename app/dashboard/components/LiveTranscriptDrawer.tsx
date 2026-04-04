// F114: LiveTranscriptDrawer component - real-time word stream
'use client'

import { useEffect, useState, useRef } from 'react'

interface TranscriptChunk {
  id: string
  speaker: 'agent' | 'caller'
  text: string
  timestamp: string
  sequenceNum: number
  sentimentScore?: number
  confidence?: number
}

interface LiveTranscriptDrawerProps {
  callId: string
  isOpen: boolean
  onClose: () => void
  tenantId?: string
}

export default function LiveTranscriptDrawer({
  callId,
  isOpen,
  onClose,
  tenantId = 'default',
}: LiveTranscriptDrawerProps) {
  const [chunks, setChunks] = useState<TranscriptChunk[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [callInfo, setCallInfo] = useState<{
    fromNumber?: string
    toNumber?: string
    startedAt?: string
    duration?: number
  } | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chunks])

  // Connect to SSE stream when drawer opens
  useEffect(() => {
    if (isOpen && callId) {
      connectToStream()
      loadCallInfo()
    }

    return () => {
      disconnectFromStream()
    }
  }, [isOpen, callId])

  async function loadCallInfo() {
    try {
      const response = await fetch(`/api/calls/${callId}`)
      if (response.ok) {
        const data = await response.json()
        setCallInfo({
          fromNumber: data.from_number,
          toNumber: data.to_number,
          startedAt: data.started_at,
          duration: data.duration_seconds,
        })
      }
    } catch (err) {
      console.error('[LiveTranscriptDrawer] Error loading call info:', err)
    }
  }

  function connectToStream() {
    try {
      const url = `/api/transcripts/live/${callId}?tenantId=${tenantId}`
      const eventSource = new EventSource(url)

      eventSource.onopen = () => {
        console.log('[LiveTranscriptDrawer] SSE connection opened')
        setIsConnected(true)
        setError(null)
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'connected') {
            console.log('[LiveTranscriptDrawer] Connected to call:', data.callId)
          } else if (data.id) {
            // New transcript chunk
            const chunk: TranscriptChunk = {
              id: data.id,
              speaker: data.speaker,
              text: data.text,
              timestamp: data.timestamp,
              sequenceNum: data.sequenceNum,
              sentimentScore: data.sentimentScore,
              confidence: data.confidence,
            }

            setChunks((prev) => {
              // Avoid duplicates
              if (prev.some((c) => c.id === chunk.id)) {
                return prev
              }
              return [...prev, chunk]
            })
          }
        } catch (err) {
          console.error('[LiveTranscriptDrawer] Error parsing SSE data:', err)
        }
      }

      eventSource.onerror = (err) => {
        console.error('[LiveTranscriptDrawer] SSE error:', err)
        setIsConnected(false)
        setError('Connection to live transcript failed')
        eventSource.close()
      }

      eventSourceRef.current = eventSource
    } catch (err) {
      console.error('[LiveTranscriptDrawer] Error connecting to stream:', err)
      setError('Failed to connect to live transcript stream')
    }
  }

  function disconnectFromStream() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }

  function getSentimentColor(score?: number): string {
    if (!score) return 'text-gray-400'
    if (score > 0.3) return 'text-green-500'
    if (score < -0.3) return 'text-red-500'
    return 'text-yellow-500'
  }

  function getSentimentLabel(score?: number): string {
    if (!score) return 'Neutral'
    if (score > 0.3) return 'Positive'
    if (score < -0.3) return 'Negative'
    return 'Neutral'
  }

  function formatTimestamp(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  function formatPhoneNumber(phone?: string): string {
    if (!phone) return ''
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

      <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-gray-900 shadow-xl">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white">Live Transcript</h2>
              {/* Live indicator */}
              {isConnected && (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <span className="text-green-400 text-sm font-semibold">LIVE</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Call Info Bar */}
          {callInfo && (
            <div className="px-6 py-3 bg-gray-800 border-b border-gray-700 text-sm text-gray-300">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{formatPhoneNumber(callInfo.fromNumber)}</span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>{formatPhoneNumber(callInfo.toNumber)}</span>
                </div>
                {callInfo.startedAt && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatDuration(callInfo.duration || 0)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-900 bg-opacity-30 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Transcript Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chunks.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-block p-3 bg-gray-800 rounded-full mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-400 font-medium">
                  {isConnected ? 'Waiting for transcript...' : 'Connecting to live call...'}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Live transcript will appear here as the conversation happens
                </p>
              </div>
            ) : (
              <>
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className={`flex gap-3 ${
                      chunk.speaker === 'agent' ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        chunk.speaker === 'agent'
                          ? 'bg-blue-900 bg-opacity-30 border border-blue-700'
                          : 'bg-gray-800 border border-gray-700'
                      }`}
                    >
                      {/* Speaker label */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase">
                            {chunk.speaker === 'agent' ? 'Agent' : 'Caller'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(chunk.timestamp)}
                          </span>
                        </div>
                        {chunk.sentimentScore !== undefined && (
                          <span
                            className={`text-xs font-medium ${getSentimentColor(
                              chunk.sentimentScore
                            )}`}
                            title={`Sentiment score: ${chunk.sentimentScore.toFixed(2)}`}
                          >
                            {getSentimentLabel(chunk.sentimentScore)}
                          </span>
                        )}
                      </div>

                      {/* Message text */}
                      <p className="text-gray-100 leading-relaxed">{chunk.text}</p>

                      {/* Confidence indicator */}
                      {chunk.confidence !== undefined && chunk.confidence < 0.8 && (
                        <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Low confidence ({(chunk.confidence * 100).toFixed(0)}%)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Auto-scroll anchor */}
                <div ref={transcriptEndRef} />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700 bg-gray-800 text-sm text-gray-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span>{chunks.length} messages</span>
                {isConnected ? (
                  <span className="text-green-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Connected
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Disconnected
                  </span>
                )}
              </div>
              <span className="text-xs">Call ID: {callId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
