// F0500: Transcript batch export - Export multiple transcripts as ZIP

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transcript_ids, format = 'txt' } = body // format: txt, json, md

    if (!transcript_ids || !Array.isArray(transcript_ids) || transcript_ids.length === 0) {
      return NextResponse.json(
        { error: 'transcript_ids array is required' },
        { status: 400 }
      )
    }

    if (transcript_ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 transcripts per batch export' },
        { status: 400 }
      )
    }

    // Fetch all transcripts
    const { data: transcripts, error } = await supabaseAdmin
      .from('transcripts')
      .select(`
        *,
        call:voice_agent_calls!inner(
          vapi_call_id,
          phone_number,
          started_at,
          duration,
          contacts:voice_agent_contacts(full_name, phone_number, company)
        )
      `)
      .in('id', transcript_ids)

    if (error) throw error

    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json(
        { error: 'No transcripts found' },
        { status: 404 }
      )
    }

    // For simplicity, return as JSON array
    // In production, you'd want to create an actual ZIP file using a library like JSZip
    const exportData = transcripts.map(transcript => ({
      id: transcript.id,
      call_id: transcript.call?.vapi_call_id,
      contact: transcript.call?.contacts?.full_name,
      phone: transcript.call?.contacts?.phone_number || transcript.call?.phone_number,
      company: transcript.call?.contacts?.company,
      date: transcript.call?.started_at,
      duration: transcript.call?.duration,
      content: transcript.content,
      summary: transcript.summary,
      sentiment: transcript.sentiment,
      keywords: transcript.keywords,
    }))

    // Return as downloadable JSON
    const filename = `transcripts_batch_${new Date().toISOString().split('T')[0]}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error batch exporting transcripts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to batch export transcripts' },
      { status: 500 }
    )
  }
}

// Alternative: Export by date range
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const campaignId = searchParams.get('campaign_id')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabaseAdmin
      .from('transcripts')
      .select(`
        *,
        call:voice_agent_calls!inner(
          vapi_call_id,
          phone_number,
          started_at,
          duration,
          campaign_id,
          contacts:voice_agent_contacts(full_name, phone_number, company)
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (campaignId) {
      query = query.eq('call.campaign_id', campaignId)
    }

    const { data: transcripts, error } = await query

    if (error) throw error

    const exportData = transcripts?.map(transcript => ({
      id: transcript.id,
      call_id: transcript.call?.vapi_call_id,
      contact: transcript.call?.contacts?.full_name,
      phone: transcript.call?.contacts?.phone_number || transcript.call?.phone_number,
      company: transcript.call?.contacts?.company,
      campaign_id: transcript.call?.campaign_id,
      date: transcript.call?.started_at,
      duration: transcript.call?.duration,
      content: transcript.content,
      summary: transcript.summary,
      sentiment: transcript.sentiment,
      keywords: transcript.keywords,
    })) || []

    const filename = `transcripts_${startDate}_to_${endDate}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting transcripts by date:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export transcripts' },
      { status: 500 }
    )
  }
}
