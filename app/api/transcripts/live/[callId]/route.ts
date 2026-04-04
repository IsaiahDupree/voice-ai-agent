/**
 * GET /api/transcripts/live/:callId
 * Server-Sent Events (SSE) endpoint for streaming live transcripts
 */

import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  const callId = params.callId;
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'default';

  // Create a TransformStream to handle SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send SSE headers
  const responseHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Subscribe to Supabase Realtime channel for this call
  const channel = supabase
    .channel(`live-transcript:${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'live_transcripts',
        filter: `call_id=eq.${callId}`,
      },
      (payload) => {
        // Send new transcript chunk to client
        const chunk = payload.new;
        const data = JSON.stringify({
          id: chunk.id,
          speaker: chunk.speaker,
          text: chunk.text,
          timestamp: chunk.timestamp,
          sequenceNum: chunk.sequence_num,
          sentimentScore: chunk.sentiment_score,
          confidence: chunk.confidence,
        });

        writer
          .write(encoder.encode(`data: ${data}\n\n`))
          .catch((error) => {
            console.error('[SSE Write Error]:', error);
          });
      }
    )
    .subscribe();

  // Send initial connection message
  writer
    .write(encoder.encode(`data: {"type":"connected","callId":"${callId}"}\n\n`))
    .catch((error) => {
      console.error('[SSE Initial Write Error]:', error);
    });

  // Clean up on connection close
  request.signal.addEventListener('abort', () => {
    channel.unsubscribe();
    writer.close();
  });

  // Keep connection alive with heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    writer
      .write(encoder.encode(`: heartbeat\n\n`))
      .catch((error) => {
        console.error('[SSE Heartbeat Error]:', error);
        clearInterval(heartbeat);
      });
  }, 30000);

  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeat);
  });

  return new Response(stream.readable, {
    headers: responseHeaders,
  });
}
