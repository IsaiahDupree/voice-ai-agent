// F0446: Transcript highlight search - Highlight search terms in transcript

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface Match {
  turn_index: number;
  speaker: string;
  text: string;
  highlighted: string;
  match_count: number;
}

/**
 * Highlight search terms in transcript
 */
function highlightSearchTerms(
  transcript: any,
  searchTerms: string[],
  caseSensitive: boolean = false
): {
  matches: Match[];
  total_matches: number;
  turns_with_matches: number;
} {
  const matches: Match[] = [];
  let totalMatches = 0;

  const messages = transcript.messages || transcript.turns || [];

  messages.forEach((msg: any, index: number) => {
    const speaker = msg.role || msg.speaker || 'unknown';
    const text = msg.message || msg.text || msg.content || '';

    let highlightedText = text;
    let matchCount = 0;

    // Apply highlighting for each search term
    searchTerms.forEach((term) => {
      if (!term || term.trim() === '') return;

      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`(${escapedTerm})`, flags);

      // Count matches in this turn
      const termMatches = text.match(regex);
      if (termMatches) {
        matchCount += termMatches.length;
      }

      // Apply highlighting
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });

    if (matchCount > 0) {
      matches.push({
        turn_index: index,
        speaker,
        text,
        highlighted: highlightedText,
        match_count: matchCount,
      });
      totalMatches += matchCount;
    }
  });

  return {
    matches,
    total_matches: totalMatches,
    turns_with_matches: matches.length,
  };
}

/**
 * F0446: Search and highlight terms in transcript
 * GET /api/transcripts/:id/highlight?q=term1,term2&case_sensitive=false
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const caseSensitive = searchParams.get('case_sensitive') === 'true';
    const format = searchParams.get('format') || 'json'; // 'json' or 'html'

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Parse search terms (comma-separated)
    const searchTerms = query
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      return NextResponse.json(
        { error: 'At least one search term is required' },
        { status: 400 }
      );
    }

    // Fetch transcript
    const { data: transcript, error } = await supabaseAdmin
      .from('voice_agent_transcripts')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Highlight search terms
    const result = highlightSearchTerms(transcript, searchTerms, caseSensitive);

    // If HTML format requested, return rendered HTML
    if (format === 'html') {
      const html = generateHighlightedHTML(result, transcript);
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      transcript_id: transcript.id,
      search_terms: searchTerms,
      case_sensitive: caseSensitive,
      summary: {
        total_matches: result.total_matches,
        turns_with_matches: result.turns_with_matches,
        total_turns: (transcript.messages || transcript.turns || []).length,
        match_density: result.total_matches / Math.max((transcript.messages || transcript.turns || []).length, 1),
      },
      matches: result.matches,
    });
  } catch (error: any) {
    console.error('Error highlighting transcript:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to highlight transcript' },
      { status: 500 }
    );
  }
}

/**
 * Generate HTML view with highlighted search terms
 */
function generateHighlightedHTML(
  result: { matches: Match[]; total_matches: number; turns_with_matches: number },
  transcript: any
): string {
  const messages = transcript.messages || transcript.turns || [];

  const turnsHTML = messages
    .map((msg: any, index: number) => {
      const speaker = msg.role || msg.speaker || 'unknown';
      const text = msg.message || msg.text || msg.content || '';

      // Find if this turn has highlights
      const match = result.matches.find((m) => m.turn_index === index);
      const displayText = match ? match.highlighted : text;

      const speakerClass = speaker === 'assistant' || speaker === 'agent' ? 'agent' : 'caller';

      return `
        <div class="turn ${speakerClass}">
          <div class="speaker">${speaker}</div>
          <div class="text">${displayText}</div>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Transcript - Highlighted</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .summary {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .turn {
      background: white;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .turn.agent {
      border-left: 4px solid #3b82f6;
    }
    .turn.caller {
      border-left: 4px solid #10b981;
    }
    .speaker {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .text {
      line-height: 1.6;
      color: #1f2937;
    }
    mark {
      background: #fef08a;
      padding: 2px 4px;
      border-radius: 3px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="summary">
    <h2>Transcript Search Results</h2>
    <p><strong>Total Matches:</strong> ${result.total_matches}</p>
    <p><strong>Turns with Matches:</strong> ${result.turns_with_matches}</p>
  </div>
  ${turnsHTML}
</body>
</html>
  `;
}
