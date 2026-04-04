// F0262: Outbound call log stream
// Stream outbound call events to dashboard in real-time using Server-Sent Events

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/campaigns/:id/stream
 * Server-Sent Events endpoint for real-time call log streaming
 * F0262: Real-time call event stream
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const campaignId = parseInt(params.id, 10);

  if (isNaN(campaignId)) {
    return new Response('Invalid campaign ID', { status: 400 });
  }

  // Create ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE message
      const sendEvent = (eventData: any) => {
        const message = `data: ${JSON.stringify(eventData)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection event
      sendEvent({
        type: 'connected',
        campaign_id: campaignId,
        timestamp: new Date().toISOString()
      });

      // Query database for recent call events every 2 seconds
      const intervalId = setInterval(async () => {
        try {
          // Get recent campaign activity (last 30 seconds)
          const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

          const { data: activities, error } = await supabaseAdmin
            .from('voice_agent_campaign_activity')
            .select('*')
            .eq('campaign_id', campaignId)
            .gte('timestamp', thirtySecondsAgo)
            .order('timestamp', { ascending: false });

          if (error) {
            console.error('[Stream] Error fetching activity:', error);
            return;
          }

          // Send activity events
          if (activities && activities.length > 0) {
            for (const activity of activities) {
              sendEvent({
                type: 'call_event',
                event_type: activity.event_type,
                details: activity.details,
                timestamp: activity.timestamp
              });
            }
          }

          // Also get recent call completions
          const { data: recentCalls } = await supabaseAdmin
            .from('voice_agent_calls')
            .select('call_id, status, duration_seconds, end_reason, ended_at')
            .eq('campaign_id', campaignId)
            .gte('ended_at', thirtySecondsAgo)
            .order('ended_at', { ascending: false });

          if (recentCalls && recentCalls.length > 0) {
            for (const call of recentCalls) {
              sendEvent({
                type: 'call_completed',
                call_id: call.call_id,
                duration: call.duration_seconds,
                outcome: call.end_reason,
                timestamp: call.ended_at
              });
            }
          }

          // Send heartbeat to keep connection alive
          sendEvent({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          console.error('[Stream] Polling error:', err);
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    }
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
}
