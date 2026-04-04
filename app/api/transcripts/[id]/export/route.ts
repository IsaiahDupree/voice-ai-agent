import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0456: Export transcript as plain text
// F0457: Export transcript as JSON
// F0458: Export transcript as SRT subtitle format

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'plain' // plain, json, srt

    // Fetch transcript from database
    const { data: transcript, error } = await supabaseAdmin
      .from('voice_agent_transcripts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      )
    }

    // F0456: Plain text export
    if (format === 'plain' || format === 'txt') {
      const plainText = transcript.transcript_text || generatePlainText(transcript.transcript)

      return new NextResponse(plainText, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="transcript-${id}.txt"`,
        },
      })
    }

    // F0457: JSON export
    if (format === 'json') {
      const jsonData = {
        id: transcript.id,
        call_id: transcript.call_id,
        transcript: transcript.transcript,
        transcript_text: transcript.transcript_text,
        duration: transcript.duration,
        metadata: transcript.metadata,
        created_at: transcript.created_at,
      }

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="transcript-${id}.json"`,
        },
      })
    }

    // F0458: SRT subtitle format export
    if (format === 'srt') {
      const srtContent = generateSRT(transcript.transcript)

      return new NextResponse(srtContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/srt; charset=utf-8',
          'Content-Disposition': `attachment; filename="transcript-${id}.srt"`,
        },
      })
    }

    return NextResponse.json(
      { error: 'Invalid format. Use: plain, json, or srt' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error exporting transcript:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export transcript' },
      { status: 500 }
    )
  }
}

/**
 * Helper: Generate plain text from transcript object
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
        const timestamp = msg.timestamp ? `[${formatTimestamp(msg.timestamp)}] ` : ''
        return `${timestamp}${role}: ${content}`
      })
      .join('\n')
  }

  if (typeof transcript === 'object' && transcript.messages) {
    return generatePlainText(transcript.messages)
  }

  return JSON.stringify(transcript, null, 2)
}

/**
 * F0458: Generate SRT subtitle format
 * Format:
 * 1
 * 00:00:00,000 --> 00:00:05,000
 * First subtitle text
 *
 * 2
 * 00:00:05,000 --> 00:00:10,000
 * Second subtitle text
 */
function generateSRT(transcript: any): string {
  const segments = parseTranscriptSegments(transcript)

  if (segments.length === 0) {
    return '1\n00:00:00,000 --> 00:00:05,000\nNo transcript available\n'
  }

  let srtContent = ''
  let sequenceNumber = 1
  let currentTime = 0

  segments.forEach((segment, index) => {
    const startTime = segment.timestamp || currentTime
    // Estimate duration: ~150 words per minute = 2.5 words per second
    const wordCount = segment.content.split(/\s+/).length
    const duration = Math.max(2, wordCount / 2.5) // At least 2 seconds

    const endTime = startTime + duration
    currentTime = endTime

    // Format timestamps
    const startSRT = formatSRTTimestamp(startTime)
    const endSRT = formatSRTTimestamp(endTime)

    // Build SRT entry
    srtContent += `${sequenceNumber}\n`
    srtContent += `${startSRT} --> ${endSRT}\n`
    srtContent += `${segment.role}: ${segment.content}\n\n`

    sequenceNumber++
  })

  return srtContent.trim()
}

/**
 * Parse transcript into segments
 */
function parseTranscriptSegments(transcript: any): Array<{
  role: string
  content: string
  timestamp?: number
}> {
  if (Array.isArray(transcript)) {
    return transcript.map((msg: any) => ({
      role: msg.role || 'unknown',
      content: msg.content || msg.message || '',
      timestamp: msg.timestamp,
    }))
  }

  if (typeof transcript === 'object' && transcript.messages) {
    return parseTranscriptSegments(transcript.messages)
  }

  if (typeof transcript === 'string') {
    // Parse line-by-line
    const lines = transcript.split('\n').filter((line) => line.trim())
    return lines.map((line) => {
      const [role, ...contentParts] = line.split(':')
      return {
        role: role.trim(),
        content: contentParts.join(':').trim(),
      }
    })
  }

  return []
}

/**
 * Format timestamp for display (HH:MM:SS)
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * F0458: Format timestamp for SRT (HH:MM:SS,mmm)
 */
function formatSRTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}
