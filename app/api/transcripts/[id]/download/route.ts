// F0498: Transcript download - Download individual transcript as text file

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transcriptId = parseInt(params.id)
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'txt' // txt, json, or md

    // Fetch transcript with call details
    const { data: transcript, error } = await supabaseAdmin
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
      .eq('id', transcriptId)
      .single()

    if (error || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      )
    }

    let fileContent: string
    let contentType: string
    let filename: string

    switch (format) {
      case 'json':
        fileContent = JSON.stringify(transcript, null, 2)
        contentType = 'application/json'
        filename = `transcript_${transcriptId}.json`
        break

      case 'md':
        fileContent = formatAsMarkdown(transcript)
        contentType = 'text/markdown'
        filename = `transcript_${transcriptId}.md`
        break

      case 'txt':
      default:
        fileContent = formatAsPlainText(transcript)
        contentType = 'text/plain'
        filename = `transcript_${transcriptId}.txt`
        break
    }

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error downloading transcript:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download transcript' },
      { status: 500 }
    )
  }
}

/**
 * Format transcript as plain text
 */
function formatAsPlainText(transcript: any): string {
  const call = transcript.call
  const contact = call?.contacts

  let text = ''
  text += `Transcript ID: ${transcript.id}\n`
  text += `Call ID: ${call?.vapi_call_id}\n`
  text += `Contact: ${contact?.full_name || 'Unknown'}\n`
  text += `Phone: ${contact?.phone_number || call?.phone_number}\n`
  if (contact?.company) text += `Company: ${contact.company}\n`
  text += `Date: ${new Date(call?.started_at).toLocaleString()}\n`
  text += `Duration: ${Math.floor(call?.duration / 60)}m ${call?.duration % 60}s\n`
  text += `\n${'='.repeat(60)}\n\n`
  text += transcript.content
  text += `\n\n${'='.repeat(60)}\n`
  if (transcript.summary) {
    text += `\nSummary:\n${transcript.summary}\n`
  }
  if (transcript.sentiment) {
    text += `\nSentiment: ${transcript.sentiment}\n`
  }
  if (transcript.keywords && transcript.keywords.length > 0) {
    text += `\nKeywords: ${transcript.keywords.join(', ')}\n`
  }

  return text
}

/**
 * Format transcript as Markdown
 */
function formatAsMarkdown(transcript: any): string {
  const call = transcript.call
  const contact = call?.contacts

  let md = ''
  md += `# Call Transcript\n\n`
  md += `**Transcript ID:** ${transcript.id}  \n`
  md += `**Call ID:** ${call?.vapi_call_id}  \n`
  md += `**Contact:** ${contact?.full_name || 'Unknown'}  \n`
  md += `**Phone:** ${contact?.phone_number || call?.phone_number}  \n`
  if (contact?.company) md += `**Company:** ${contact.company}  \n`
  md += `**Date:** ${new Date(call?.started_at).toLocaleString()}  \n`
  md += `**Duration:** ${Math.floor(call?.duration / 60)}m ${call?.duration % 60}s  \n\n`

  md += `---\n\n`
  md += `## Transcript\n\n`
  md += transcript.content
    .split('\n')
    .map((line: string) => {
      if (line.match(/^(Agent|Assistant):/i)) {
        return `**${line}**`
      } else if (line.match(/^(Caller|Customer):/i)) {
        return `*${line}*`
      }
      return line
    })
    .join('\n')

  if (transcript.summary) {
    md += `\n\n---\n\n`
    md += `## Summary\n\n${transcript.summary}\n`
  }

  if (transcript.sentiment) {
    md += `\n**Sentiment:** ${transcript.sentiment}  \n`
  }

  if (transcript.keywords && transcript.keywords.length > 0) {
    md += `**Keywords:** ${transcript.keywords.join(', ')}  \n`
  }

  return md
}
