// F0478: Transcript reprocess - re-analyze transcript with updated processing

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { analyzeTranscriptFull } from '@/lib/transcript-processing'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = supabaseAdmin

    // Get existing transcript
    const { data: existing, error: fetchError } = await supabase
      .from('transcripts')
      .select('*')
      .eq('call_id', id)
      .single()

    if (fetchError || !existing) {
      return apiError(ErrorCodes.NOT_FOUND, `Transcript not found for call ${id}`, 404)
    }

    // Get call duration if available
    const { data: call } = await supabase
      .from('calls')
      .select('duration_seconds')
      .eq('id', id)
      .single()

    // Reprocess the transcript
    const analysis = await analyzeTranscriptFull(
      existing.segments || existing.transcript_text,
      call?.duration_seconds
    )

    // Update transcript with new analysis
    const { data: updated, error: updateError } = await supabase
      .from('transcripts')
      .update({
        summary: analysis.summary,
        action_items: analysis.actionItems,
        keywords: analysis.keywords,
        intent: analysis.intent,
        entities: analysis.entities,
        quality_score: analysis.qualityScore,
        language: analysis.language,
        talk_ratio: analysis.talkRatio,
        word_count: analysis.wordCount,
        sentiment: analysis.overallSentiment,
        sentiment_score: analysis.overallSentimentScore,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', id)
      .select()
      .single()

    if (updateError) {
      return apiError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to update transcript: ${updateError.message}`,
        500
      )
    }

    return apiSuccess(
      {
        call_id: id,
        reprocessed: true,
        analysis,
        transcript: updated,
      },
      { timestamp: new Date().toISOString() }
    )
  } catch (error: any) {
    console.error('Transcript reprocess error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to reprocess transcript: ${error.message}`,
      500
    )
  }
}
