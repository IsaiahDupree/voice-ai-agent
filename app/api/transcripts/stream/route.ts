/**
 * GET /api/transcripts/stream/:call_id
 *
 * SSE (Server-Sent Events) endpoint for live transcript streaming
 * Streams transcript chunks in real-time as they arrive from Vapi
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callId = searchParams.get('call_id');

  if (!callId) {
    return new Response('Missing call_id parameter', { status: 400 });
  }

  // Set up SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', call_id: callId })}\n\n`)
      );

      // Subscribe to Supabase Realtime for this call's transcripts
      const channel = supabase
        .channel(`live_transcripts:${callId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'live_transcripts',
            filter: `call_id=eq.${callId}`,
          },
          (payload) => {
            const data = {
              type: 'transcript_chunk',
              data: payload.new,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          }
        )
        .subscribe();

      // Keep connection alive with heartbeat every 30s
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        supabase.removeChannel(channel);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
