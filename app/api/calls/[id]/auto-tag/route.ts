import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { analyzeTranscriptForTags, extractEarlyTranscript } from '@/lib/auto-tag'

/**
 * F0140: Auto-tagging by keyword
 * POST /api/calls/:id/auto-tag
 *
 * Analyzes the first 30 seconds of a call transcript and applies intent-based tags
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const callId = params.id;

    // Get call transcript messages
    const { data: transcript, error: transcriptError } = await supabaseAdmin
      .from('voice_agent_transcripts')
      .select('role, content, timestamp')
      .eq('call_id', callId)
      .order('timestamp', { ascending: true });

    if (transcriptError) throw transcriptError;

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'No transcript found for this call' },
        { status: 404 }
      );
    }

    // Extract first 30 seconds of conversation
    const earlyTranscriptText = extractEarlyTranscript(transcript, 30);

    // Analyze for tags
    const result = analyzeTranscriptForTags(earlyTranscriptText, {
      maxDurationSeconds: 30,
      minConfidence: 0.3,
    });

    // Get existing call to merge tags
    const { data: existingCall } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('labels, tags, metadata')
      .eq('call_id', callId)
      .single();

    const existingTags = existingCall?.tags || existingCall?.labels || [];
    const mergedTags = Array.from(new Set([...existingTags, ...result.tags]));

    // Update call with auto-generated tags
    const { data: updatedCall, error: updateError } = await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        labels: mergedTags,
        tags: mergedTags, // Support both field names
        metadata: {
          ...existingCall?.metadata,
          auto_tag_result: {
            applied_at: new Date().toISOString(),
            matched_keywords: result.matchedKeywords,
            confidence: result.confidence,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', callId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      call_id: callId,
      tags_applied: result.tags,
      matched_keywords: result.matchedKeywords,
      confidence: result.confidence,
      total_tags: mergedTags.length,
    });
  } catch (error: any) {
    console.error('Error auto-tagging call:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-tag call' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calls/:id/auto-tag
 * Preview what tags would be applied without actually applying them
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const callId = params.id;

    // Get call transcript messages
    const { data: transcript, error: transcriptError } = await supabaseAdmin
      .from('voice_agent_transcripts')
      .select('role, content, timestamp')
      .eq('call_id', callId)
      .order('timestamp', { ascending: true });

    if (transcriptError) throw transcriptError;

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'No transcript found for this call' },
        { status: 404 }
      );
    }

    // Extract first 30 seconds
    const earlyTranscriptText = extractEarlyTranscript(transcript, 30);

    // Analyze for tags (preview only)
    const result = analyzeTranscriptForTags(earlyTranscriptText, {
      maxDurationSeconds: 30,
      minConfidence: 0.3,
    });

    return NextResponse.json({
      call_id: callId,
      preview: true,
      suggested_tags: result.tags,
      matched_keywords: result.matchedKeywords,
      confidence: result.confidence,
      transcript_sample: earlyTranscriptText.substring(0, 200) + '...',
    });
  } catch (error: any) {
    console.error('Error previewing auto-tags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview auto-tags' },
      { status: 500 }
    );
  }
}
