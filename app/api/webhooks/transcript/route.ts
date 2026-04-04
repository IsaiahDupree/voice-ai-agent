// F0474: Transcript webhook - receive transcript events from Vapi/Deepgram

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { analyzeTranscriptFull } from '@/lib/transcript-processing'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

/**
 * F0474: Webhook endpoint for transcript events
 * Accepts transcript data from Vapi after call completion
 * Processes and stores in Supabase with full analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = supabaseAdmin

    // Validate webhook signature (optional - implement based on your security needs)
    const signature = request.headers.get('x-vapi-signature')
    // TODO: Validate signature if needed

    // Extract data from webhook payload
    const {
      call,
      transcript,
      messages,
      call_id,
      vapi_call_id,
      duration,
      timestamp,
    } = body

    const callId = call_id || call?.id || vapi_call_id

    if (!callId) {
      return apiError(ErrorCodes.BAD_REQUEST, 'Missing call_id in webhook payload', 400)
    }

    // Check if transcript already exists
    const { data: existing } = await supabase
      .from('transcripts')
      .select('call_id')
      .eq('call_id', callId)
      .single()

    if (existing) {
      console.log(`Transcript already exists for call ${callId}, skipping`)
      return apiSuccess({ message: 'Transcript already exists', call_id: callId })
    }

    // Process transcript
    const transcriptData = transcript || messages
    const analysis = await analyzeTranscriptFull(transcriptData, duration)

    // Extract plain text from segments
    const transcriptText = Array.isArray(analysis.segments)
      ? analysis.segments.map(s => `${s.role}: ${s.content}`).join('\n')
      : typeof transcriptData === 'string'
      ? transcriptData
      : JSON.stringify(transcriptData)

    // Insert transcript with analysis
    const { data: inserted, error: insertError } = await supabase
      .from('transcripts')
      .insert({
        call_id: callId,
        transcript_text: transcriptText,
        segments: analysis.segments,
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
        created_at: timestamp || new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert transcript:', insertError)
      return apiError(
        ErrorCodes.DATABASE_ERROR,
        `Failed to save transcript: ${insertError.message}`,
        500
      )
    }

    // Update call record with sentiment if exists
    await supabase
      .from('calls')
      .update({
        sentiment: analysis.overallSentiment,
        transcript_processed: true,
      })
      .eq('id', callId)

    console.log(`✓ Transcript processed and saved for call ${callId}`)

    return apiSuccess(
      {
        call_id: callId,
        processed: true,
        quality_score: analysis.qualityScore,
        sentiment: analysis.overallSentiment,
        word_count: analysis.wordCount,
      },
      { timestamp: new Date().toISOString() }
    )
  } catch (error: any) {
    console.error('Transcript webhook error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to process transcript webhook: ${error.message}`,
      500
    )
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(request: NextRequest) {
  // Some webhook providers send GET request for verification
  const { searchParams } = new URL(request.url)
  const challenge = searchParams.get('challenge')

  if (challenge) {
    return NextResponse.json({ challenge })
  }

  return apiSuccess({ status: 'Transcript webhook endpoint is active' })
}
