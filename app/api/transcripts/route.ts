import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { redactPII } from '@/lib/pii-redaction'
import { analyzeTranscriptFull } from '@/lib/transcript-processing'

// F0443: Transcript list - GET /api/transcripts returns paginated list
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const callId = searchParams.get('call_id')
    const search = searchParams.get('search') // F0441: Transcript search

    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('voice_agent_transcripts')
      .select('*', { count: 'exact' })

    // F0441: Transcript search - filter by search term
    if (search) {
      // Search in transcript plain text field
      query = query.ilike('transcript_text', `%${search}%`)
    }

    // Filter by call_id if provided
    if (callId) {
      query = query.eq('call_id', callId)
    }

    // F0443: Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching transcripts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // F0443: Return paginated results
    return NextResponse.json({
      transcripts: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('Error in transcripts API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transcripts' },
      { status: 500 }
    )
  }
}

// F0440: Create transcript with plain text version
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      call_id,
      transcript,
      transcript_text,
      duration,
      metadata,
      call_direction, // F0477: Call direction
      campaign_id, // F0477: Campaign ID
    } = body

    if (!call_id || !transcript) {
      return NextResponse.json(
        { error: 'call_id and transcript are required' },
        { status: 400 }
      )
    }

    // F0440: Store both JSONB transcript and plain text version
    let plainText = transcript_text || generatePlainText(transcript)

    // F0455: Redact PII from transcript before storage
    const redactionResult = redactPII(plainText, {
      redactEmails: false,
      redactPhones: false,
      redactDates: true, // Redact DOB
    })
    plainText = redactionResult.redacted

    // F0450, F0451: Analyze sentiment
    const analysis = await analyzeTranscriptFull(transcript)

    // Prepare metadata with sentiment and analysis
    const enrichedMetadata = {
      ...metadata,
      sentiment: analysis.overallSentiment,
      sentiment_score: analysis.overallSentimentScore,
      summary: analysis.summary,
      action_items: analysis.actionItems,
      redacted_fields: redactionResult.redactedFields,
      speaker_count: analysis.speakerCount, // F0468: Speaker count
      call_direction: call_direction || 'unknown', // F0477: Call direction
      campaign_id: campaign_id || null, // F0477: Campaign ID
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_transcripts')
      .insert({
        call_id,
        transcript, // JSONB format
        transcript_text: plainText, // F0440, F0455: Plain text version (PII redacted)
        duration: duration || null,
        metadata: enrichedMetadata, // F0450, F0451, F0463, F0464, F0468, F0477: Include analysis
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating transcript:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error in transcript creation:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create transcript' },
      { status: 500 }
    )
  }
}

/**
 * F0440: Generate plain text from transcript JSONB
 * Converts structured transcript to searchable plain text
 */
function generatePlainText(transcript: any): string {
  if (typeof transcript === 'string') {
    return transcript
  }

  if (Array.isArray(transcript)) {
    return transcript
      .map((msg: any) => {
        const role = msg.role || 'unknown'
        const content = msg.content || msg.message || ''
        return `${role}: ${content}`
      })
      .join('\n')
  }

  if (typeof transcript === 'object' && transcript.messages) {
    return generatePlainText(transcript.messages)
  }

  return JSON.stringify(transcript)
}
