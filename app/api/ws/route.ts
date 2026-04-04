// F0692: WebSocket connection for real-time dashboard updates
// F0693: Auto-reconnect on disconnect

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// This is a simplified WebSocket setup for Next.js
// In production, consider using a dedicated WebSocket server or Supabase Realtime

// Force dynamic rendering - this route cannot be statically generated
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // For now, we'll use Server-Sent Events (SSE) instead of WebSocket
  // SSE is simpler and works with Next.js edge runtime

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      // Set up a subscription to call updates
      const channel = supabaseAdmin
        .channel('dashboard-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'voice_agent_calls',
          },
          (payload) => {
            // Send update to client
            const message = {
              type: 'call_update',
              data: payload,
              timestamp: new Date().toISOString(),
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`))
          }
        )
        .subscribe()

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`))
        } catch (error) {
          clearInterval(heartbeat)
        }
      }, 30000)

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        channel.unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
