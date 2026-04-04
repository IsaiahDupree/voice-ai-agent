/**
 * POST /api/webhooks/speech-classifier
 * Classifies speech utterances from Vapi speech-update events
 * Determines if utterance is real-interrupt, filler, affirmation, or side-comment
 */

import { NextRequest, NextResponse } from 'next/server';
import { classifyUtterance, shouldPauseAgent, type ClassificationContext } from '@/lib/semantic-vad';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      callId,
      utterance,
      agentSpeaking = true,
      conversationStage,
      lastAgentUtterance,
      sensitivity = 'medium',
      assistantId,
    } = body;

    // Validate required fields
    if (!callId || !utterance) {
      return NextResponse.json(
        { error: 'callId and utterance are required' },
        { status: 400 }
      );
    }

    // Build classification context
    const context: ClassificationContext = {
      agentSpeaking,
      conversationStage,
      lastAgentUtterance,
    };

    // Classify the utterance
    const classification = await classifyUtterance(utterance, context);

    // Determine if agent should pause
    const pause = shouldPauseAgent(classification, sensitivity);

    // Store classification in database for analytics
    const { error: dbError } = await supabaseAdmin
      .from('speech_classifications')
      .insert({
        call_id: callId,
        assistant_id: assistantId,
        utterance,
        classification_type: classification.type,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        agent_speaking: agentSpeaking,
        conversation_stage: conversationStage,
        sensitivity,
        pause_triggered: pause,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.warn('[Speech Classifier] Failed to store classification:', dbError);
      // Don't fail the request if storage fails
    }

    return NextResponse.json({
      success: true,
      classification: {
        type: classification.type,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
      },
      shouldPause: pause,
      callId,
    });
  } catch (error: any) {
    console.error('[Speech Classifier Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to classify utterance',
        shouldPause: false, // Safe default: don't pause on error
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/speech-classifier/health
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'speech-classifier',
    timestamp: new Date().toISOString(),
  });
}
