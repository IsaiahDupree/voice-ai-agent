/**
 * Realtime Transcript
 * Insert transcript chunks into Supabase for real-time streaming
 */

import { supabaseAdmin } from './supabase';

export interface TranscriptChunk {
  callId: string;
  tenantId?: string;
  speaker: 'agent' | 'caller' | 'system';
  text: string;
  timestamp?: Date;
  sequenceNum: number;
  sentimentScore?: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

/**
 * Insert transcript chunk into live_transcripts table
 * Supabase Realtime will automatically broadcast to subscribed clients
 */
export async function insertTranscriptChunk(
  chunk: TranscriptChunk
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('live_transcripts').insert({
      call_id: chunk.callId,
      tenant_id: chunk.tenantId || 'default',
      speaker: chunk.speaker,
      text: chunk.text,
      timestamp: chunk.timestamp || new Date(),
      sequence_num: chunk.sequenceNum,
      sentiment_score: chunk.sentimentScore,
      confidence: chunk.confidence,
      metadata: chunk.metadata || {},
    });

    if (error) {
      console.error('[Insert Transcript Chunk Error]:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Insert Transcript Chunk Exception]:', error);
    return false;
  }
}

/**
 * Insert multiple transcript chunks in batch
 */
export async function insertTranscriptChunksBatch(
  chunks: TranscriptChunk[]
): Promise<number> {
  if (chunks.length === 0) {
    return 0;
  }

  try {
    const rows = chunks.map((chunk) => ({
      call_id: chunk.callId,
      tenant_id: chunk.tenantId || 'default',
      speaker: chunk.speaker,
      text: chunk.text,
      timestamp: chunk.timestamp || new Date(),
      sequence_num: chunk.sequenceNum,
      sentiment_score: chunk.sentimentScore,
      confidence: chunk.confidence,
      metadata: chunk.metadata || {},
    }));

    const { error, count } = await supabaseAdmin
      .from('live_transcripts')
      .insert(rows)
      .select('id');

    if (error) {
      console.error('[Insert Transcript Chunks Batch Error]:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[Insert Transcript Chunks Batch Exception]:', error);
    return 0;
  }
}

/**
 * Get transcript chunks for a call
 */
export async function getCallTranscriptChunks(
  callId: string,
  tenantId: string = 'default'
): Promise<TranscriptChunk[]> {
  const { data, error } = await supabaseAdmin
    .from('live_transcripts')
    .select('*')
    .eq('call_id', callId)
    .eq('tenant_id', tenantId)
    .order('sequence_num', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    callId: row.call_id,
    tenantId: row.tenant_id,
    speaker: row.speaker,
    text: row.text,
    timestamp: new Date(row.timestamp),
    sequenceNum: row.sequence_num,
    sentimentScore: row.sentiment_score,
    confidence: row.confidence,
    metadata: row.metadata || {},
  }));
}

/**
 * Delete transcript chunks for a call (cleanup after call ends)
 */
export async function deleteCallTranscriptChunks(
  callId: string,
  tenantId?: string
): Promise<boolean> {
  const query = supabaseAdmin
    .from('live_transcripts')
    .delete()
    .eq('call_id', callId);

  if (tenantId) {
    query.eq('tenant_id', tenantId);
  }

  const { error } = await query;

  return !error;
}

/**
 * Calculate simple sentiment score from text
 * Returns value between -1 (negative) and 1 (positive)
 * This is a fast heuristic - for production, use GPT-4o-mini or a sentiment model
 */
export function calculateSimpleSentiment(text: string): number {
  const lowerText = text.toLowerCase();

  // Positive words
  const positiveWords = [
    'great',
    'good',
    'excellent',
    'perfect',
    'thanks',
    'thank you',
    'love',
    'wonderful',
    'fantastic',
    'amazing',
    'yes',
    'sure',
    'definitely',
    'absolutely',
  ];

  // Negative words
  const negativeWords = [
    'bad',
    'terrible',
    'awful',
    'hate',
    'no',
    'never',
    'worst',
    'horrible',
    'problem',
    'issue',
    'wrong',
    'disappointed',
    'frustrat',
    'annoyed',
  ];

  let score = 0;
  const words = lowerText.split(/\s+/);

  for (const word of words) {
    if (positiveWords.some((pw) => word.includes(pw))) {
      score += 0.2;
    }
    if (negativeWords.some((nw) => word.includes(nw))) {
      score -= 0.2;
    }
  }

  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, score));
}
