// F113: LiveCallsPanel component - active calls with green indicator
'use client'

import { useEffect, useState } from 'react'

interface ActiveCall {
  callId: string
  fromNumber: string
  toNumber: string
  startedAt: string
  assistantId: string
  duration: number
  metadata: Record<string, any>
}

interface LiveCallsPanelProps {
  onCallClick?: (callId: string) => void
  refreshInterval?: number // milliseconds, default 2000 (2 seconds)
  tenantId?: string
}

export default function LiveCallsPanel({
  onCallClick,
  refreshInterval = 2000,
  tenantId = 'default',
}: LiveCallsPanelProps) {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActiveCalls()

    // Poll for active calls
    const interval = setInterval(() => {
      fetchActiveCalls()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval, tenantId])

  async function fetchActiveCalls() {
    try {
      const response = await fetch(`/api/calls/active?tenantId=${tenantId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch active calls: ${response.statusText}`)
      }

      const data = await response.json()
      if (data.success) {
        setActiveCalls(data.calls || [])
        setError(null)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (err) {
      console.error('[LiveCallsPanel] Error fetching active calls:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch active calls')
    } finally {
      setLoading(false)
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatPhoneNumber(phone: string): string {
    // Format phone number: +12345678901 -> +1 (234) 567-8901
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  if (loading && activeCalls.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-semibold mb-4">Live Calls</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <span className="ml-3 text-gray-400">Loading active calls...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Live Calls</h2>
        <div className="flex items-center gap-2">
          {/* Active call count badge */}
          {activeCalls.length > 0 && (
            <span className="px-3 py-1 bg-green-600 rounded-full text-sm font-semibold">
              {activeCalls.length} active
            </span>
          )}
          {/* Refresh indicator - show when loading */}
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {activeCalls.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-block p-3 bg-gray-700 rounded-full mb-3">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </div>
          <p className="text-gray-400 font-medium">No active calls</p>
          <p className="text-gray-500 text-sm mt-1">Active calls will appear here in real-time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCalls.map((call) => (
            <div
              key={call.callId}
              className="bg-gray-700 rounded p-4 hover:bg-gray-650 transition cursor-pointer border border-transparent hover:border-green-500"
              onClick={() => onCallClick?.(call.callId)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Green pulsing indicator */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-green-400 font-semibold text-sm">LIVE</span>
                    <span className="text-gray-400 text-sm">
                      {formatDuration(call.duration)}
                    </span>
                  </div>

                  {/* Call details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-gray-300">{formatPhoneNumber(call.fromNumber)}</span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-gray-300">{formatPhoneNumber(call.toNumber)}</span>
                    </div>

                    {call.metadata?.caller_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-gray-400">{call.metadata.caller_name}</span>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 mt-1">
                      Started {new Date(call.startedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* View transcript arrow */}
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
