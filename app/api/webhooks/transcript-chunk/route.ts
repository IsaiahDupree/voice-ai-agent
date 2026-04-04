/**
 * POST /api/webhooks/transcript-chunk
 * Receives partial transcript events from Vapi and inserts into Supabase for real-time streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  insertTranscriptChunk,
  calculateSimpleSentiment,
} from '@/lib/realtime-transcript';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      callId,
      speaker,
      text,
      timestamp,
      sequenceNum,
      confidence,
      tenantId = 'default',
    } = body;

    if (!callId || !speaker || !text || sequenceNum === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: callId, speaker, text, sequenceNum' },
        { status: 400 }
      );
    }

    // Validate speaker
    if (!['agent', 'caller', 'system'].includes(speaker)) {
      return NextResponse.json(
        { error: 'Invalid speaker. Must be: agent, caller, or system' },
        { status: 400 }
      );
    }

    // Calculate sentiment score
    const sentimentScore = calculateSimpleSentiment(text);

    // Insert chunk
    const success = await insertTranscriptChunk({
      callId,
      tenantId,
      speaker,
      text,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      sequenceNum,
      sentimentScore,
      confidence,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to insert transcript chunk' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Transcript chunk inserted',
    });
  } catch (error: any) {
    console.error('[Transcript Chunk Webhook Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to process transcript chunk',
      },
      { status: 500 }
    );
  }
}
