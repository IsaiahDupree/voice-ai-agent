// F0692: WebSocket connection hook
// F0693: Auto-reconnect on disconnect
// F0694: Call end removal - auto-update when calls end

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface CallUpdate {
  type: 'call_update' | 'connected' | 'heartbeat'
  data?: any
  timestamp: string
}

export function useRealtimeCalls() {
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)

  const connect = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Create new EventSource connection
    const eventSource = new EventSource('/api/ws')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('[Realtime] Connected to SSE stream')
      setConnected(true)
      reconnectAttempts.current = 0
    }

    eventSource.onmessage = (event) => {
      try {
        const update: CallUpdate = JSON.parse(event.data)

        if (update.type === 'connected') {
          setConnected(true)
        } else if (update.type === 'call_update') {
          setLastUpdate(new Date())
          // Trigger custom event for components to listen to
          window.dispatchEvent(new CustomEvent('call-update', { detail: update.data }))
        } else if (update.type === 'heartbeat') {
          // Connection is alive
        }
      } catch (error) {
        console.error('[Realtime] Error parsing message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('[Realtime] Connection error:', error)
      setConnected(false)
      eventSource.close()

      // F0693: Auto-reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000) // Max 30s
      reconnectAttempts.current++

      console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`)

      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, delay)
    }

    return eventSource
  }, [])

  // Initial connection
  useEffect(() => {
    const eventSource = connect()

    // Cleanup on unmount
    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  return {
    connected,
    lastUpdate,
    reconnect: connect,
  }
}
