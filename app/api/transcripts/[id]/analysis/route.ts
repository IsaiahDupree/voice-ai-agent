// F0491-F0497: Transcript analysis API

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { analyzeTranscript, getTranscriptAnalysis } from '@/lib/transcript-analysis'

// Get existing analysis or trigger new analysis
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transcriptId = parseInt(params.id)

    // Check if analysis already exists
    let analysis = await getTranscriptAnalysis(transcriptId)

    if (!analysis) {
      // Fetch transcript and analyze it
      const { data: transcript, error } = await supabaseAdmin
        .from('transcripts')
        .select('content')
        .eq('id', transcriptId)
        .single()

      if (error || !transcript) {
        return NextResponse.json(
          { error: 'Transcript not found' },
          { status: 404 }
        )
      }

      // Run analysis
      analysis = await analyzeTranscript(transcriptId, transcript.content)
    }

    return NextResponse.json({
      success: true,
      analysis,
    })
  } catch (error: any) {
    console.error('Error getting transcript analysis:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze transcript' },
      { status: 500 }
    )
  }
}

// Trigger re-analysis with custom competitors list
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transcriptId = parseInt(params.id)
    const body = await request.json()
    const { competitors } = body

    // Fetch transcript
    const { data: transcript, error } = await supabaseAdmin
      .from('transcripts')
      .select('content')
      .eq('id', transcriptId)
      .single()

    if (error || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      )
    }

    // Run analysis with custom competitors
    const analysis = await analyzeTranscript(transcriptId, transcript.content, competitors)

    return NextResponse.json({
      success: true,
      message: 'Transcript re-analyzed',
      analysis,
    })
  } catch (error: any) {
    console.error('Error re-analyzing transcript:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to re-analyze transcript' },
      { status: 500 }
    )
  }
}
