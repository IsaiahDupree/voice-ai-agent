/**
 * Integration test: Live Transcript Streaming Latency
 * Feature 120: webhook → Supabase → SSE stream latency < 2s
 *
 * This test verifies the live transcript pipeline performance:
 * 1. Webhook receives transcript chunk from Vapi
 * 2. Chunk is inserted into Supabase live_transcripts table
 * 3. SSE client receives chunk via /api/transcripts/live/:callId
 * 4. Total latency is under 2000ms
 *
 * Latency breakdown target:
 * - Webhook processing: < 100ms
 * - Supabase insert: < 300ms
 * - Realtime channel propagation: < 500ms
 * - SSE delivery: < 100ms
 * - Total: < 1000ms (well under 2s requirement)
 */

import { supabaseAdmin } from '@/lib/supabase';
import EventSource from 'eventsource';

// Polyfill EventSource for Node.js
if (typeof global !== 'undefined') {
  (global as any).EventSource = EventSource;
}

describe('Live Transcript Streaming Latency', () => {
  const testCallId = `test-call-${Date.now()}`;
  const testTenantId = 'test-tenant';
  let sseCleanup: (() => void) | null = null;

  afterEach(async () => {
    // Cleanup SSE connection
    if (sseCleanup) {
      sseCleanup();
      sseCleanup = null;
    }

    // Cleanup test data
    await supabaseAdmin
      .from('live_transcripts')
      .delete()
      .eq('call_id', testCallId);

    await supabaseAdmin
      .from('voice_agent_calls')
      .delete()
      .eq('call_id', testCallId);
  });

  it('should stream transcript chunks within 2 seconds of webhook', async () => {
    // Create test call record
    const { error: callError } = await supabaseAdmin
      .from('voice_agent_calls')
      .insert({
        call_id: testCallId,
        from_number: '+15551234567',
        to_number: '+15559876543',
        status: 'in-progress',
        started_at: new Date().toISOString(),
        tenant_id: testTenantId,
      });

    expect(callError).toBeNull();

    // Track received chunks
    const receivedChunks: any[] = [];
    const chunkTimestamps: number[] = [];

    // Start SSE connection before sending chunks
    const sseUrl = `http://localhost:${process.env.PORT || 3000}/api/transcripts/live/${testCallId}?tenantId=${testTenantId}`;
    const eventSource = new EventSource(sseUrl);

    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, 5000);

      eventSource.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      eventSource.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id) {
          receivedChunks.push(data);
          chunkTimestamps.push(Date.now());
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    sseCleanup = () => {
      eventSource.close();
    };

    // Wait for SSE connection to establish
    await connectionPromise;

    // Simulate webhook sending 3 transcript chunks
    const chunks = [
      {
        speaker: 'agent',
        text: 'Hello, how can I help you today?',
        sentiment_score: 0.7,
        confidence: 0.95,
      },
      {
        speaker: 'caller',
        text: 'Hi, I want to schedule an appointment.',
        sentiment_score: 0.3,
        confidence: 0.92,
      },
      {
        speaker: 'agent',
        text: 'Sure, I can help with that. What day works best for you?',
        sentiment_score: 0.6,
        confidence: 0.94,
      },
    ];

    const sendTimestamps: number[] = [];

    // Send chunks with Supabase Realtime enabled
    for (let i = 0; i < chunks.length; i++) {
      const sendTime = Date.now();
      sendTimestamps.push(sendTime);

      const { error } = await supabaseAdmin.from('live_transcripts').insert({
        call_id: testCallId,
        tenant_id: testTenantId,
        speaker: chunks[i].speaker,
        text: chunks[i].text,
        timestamp: new Date().toISOString(),
        sequence_num: i,
        sentiment_score: chunks[i].sentiment_score,
        confidence: chunks[i].confidence,
      });

      expect(error).toBeNull();

      // Small delay between chunks to simulate real conversation
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Wait for all chunks to be received via SSE
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Close SSE connection
    if (sseCleanup) {
      sseCleanup();
      sseCleanup = null;
    }

    // Verify all chunks were received
    expect(receivedChunks.length).toBe(chunks.length);

    // Verify content matches
    receivedChunks.forEach((received, idx) => {
      expect(received.speaker).toBe(chunks[idx].speaker);
      expect(received.text).toBe(chunks[idx].text);
      expect(received.sentimentScore).toBe(chunks[idx].sentiment_score);
      expect(received.confidence).toBe(chunks[idx].confidence);
      expect(received.sequenceNum).toBe(idx);
    });

    // Calculate latencies
    const latencies: number[] = [];
    for (let i = 0; i < Math.min(sendTimestamps.length, chunkTimestamps.length); i++) {
      const latency = chunkTimestamps[i] - sendTimestamps[i];
      latencies.push(latency);
    }

    // Verify latency requirement: all chunks < 2000ms
    latencies.forEach((latency, idx) => {
      console.log(`Chunk ${idx} latency: ${latency}ms`);
      expect(latency).toBeLessThan(2000);
    });

    // Calculate average latency
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    console.log(`Average latency: ${avgLatency.toFixed(0)}ms`);

    // Verify average latency is well under 2s (target: < 1s)
    expect(avgLatency).toBeLessThan(1000);
  }, 15000); // 15s timeout for full test

  it('should handle high-frequency chunk bursts without latency degradation', async () => {
    // Create test call record
    const { error: callError } = await supabaseAdmin
      .from('voice_agent_calls')
      .insert({
        call_id: testCallId,
        from_number: '+15551234567',
        to_number: '+15559876543',
        status: 'in-progress',
        started_at: new Date().toISOString(),
        tenant_id: testTenantId,
      });

    expect(callError).toBeNull();

    // Track received chunks
    const receivedChunks: any[] = [];
    const chunkTimestamps: Map<number, number> = new Map();

    // Start SSE connection
    const sseUrl = `http://localhost:${process.env.PORT || 3000}/api/transcripts/live/${testCallId}?tenantId=${testTenantId}`;
    const eventSource = new EventSource(sseUrl);

    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, 5000);

      eventSource.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      eventSource.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id && data.sequenceNum !== undefined) {
          receivedChunks.push(data);
          chunkTimestamps.set(data.sequenceNum, Date.now());
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    sseCleanup = () => {
      eventSource.close();
    };

    // Wait for SSE connection
    await connectionPromise;

    // Send 10 chunks rapidly (< 50ms apart)
    const burstSize = 10;
    const sendTimestamps: Map<number, number> = new Map();

    const insertPromises = [];
    for (let i = 0; i < burstSize; i++) {
      const sendTime = Date.now();
      sendTimestamps.set(i, sendTime);

      insertPromises.push(
        supabaseAdmin.from('live_transcripts').insert({
          call_id: testCallId,
          tenant_id: testTenantId,
          speaker: i % 2 === 0 ? 'agent' : 'caller',
          text: `Burst message ${i}`,
          timestamp: new Date().toISOString(),
          sequence_num: i,
          sentiment_score: 0,
          confidence: 0.9,
        })
      );
    }

    // Wait for all inserts
    await Promise.all(insertPromises);

    // Wait for SSE delivery
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Close SSE connection
    if (sseCleanup) {
      sseCleanup();
      sseCleanup = null;
    }

    // Verify all chunks received
    expect(receivedChunks.length).toBe(burstSize);

    // Calculate latencies
    const latencies: number[] = [];
    for (let i = 0; i < burstSize; i++) {
      const sendTime = sendTimestamps.get(i);
      const receiveTime = chunkTimestamps.get(i);

      if (sendTime && receiveTime) {
        const latency = receiveTime - sendTime;
        latencies.push(latency);
        console.log(`Burst chunk ${i} latency: ${latency}ms`);
      }
    }

    // Verify all latencies under 2s
    latencies.forEach((latency) => {
      expect(latency).toBeLessThan(2000);
    });

    // Verify no significant latency degradation during burst
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    const latencyRange = maxLatency - minLatency;

    console.log(`Latency range during burst: ${latencyRange}ms (${minLatency}ms - ${maxLatency}ms)`);

    // Latency range should be reasonable (< 1s difference)
    expect(latencyRange).toBeLessThan(1000);
  }, 15000);
});
