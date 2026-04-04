// F0491 & F0492: Transcript turn counts - Count agent and caller turns

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Count turns in transcript
 */
function countTurns(transcript: any): {
  agent_turn_count: number;
  caller_turn_count: number;
  total_turns: number;
  avg_agent_words_per_turn: number;
  avg_caller_words_per_turn: number;
  turns: Array<{
    speaker: string;
    turn_number: number;
    word_count: number;
  }>;
} {
  let agentTurns = 0;
  let callerTurns = 0;
  let agentWords = 0;
  let callerWords = 0;
  const turns: Array<{ speaker: string; turn_number: number; word_count: number }> = [];

  // Handle different transcript formats
  const messages = transcript.messages || transcript.turns || [];

  let currentTurn = 0;
  messages.forEach((msg: any, index: number) => {
    const speaker = msg.role || msg.speaker || '';
    const text = msg.message || msg.text || msg.content || '';
    const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length;

    currentTurn++;

    if (speaker === 'assistant' || speaker === 'agent' || speaker === 'bot') {
      agentTurns++;
      agentWords += wordCount;
      turns.push({
        speaker: 'agent',
        turn_number: currentTurn,
        word_count: wordCount,
      });
    } else if (speaker === 'user' || speaker === 'caller' || speaker === 'customer') {
      callerTurns++;
      callerWords += wordCount;
      turns.push({
        speaker: 'caller',
        turn_number: currentTurn,
        word_count: wordCount,
      });
    }
  });

  return {
    agent_turn_count: agentTurns,
    caller_turn_count: callerTurns,
    total_turns: agentTurns + callerTurns,
    avg_agent_words_per_turn: agentTurns > 0 ? Math.round(agentWords / agentTurns) : 0,
    avg_caller_words_per_turn: callerTurns > 0 ? Math.round(callerWords / callerTurns) : 0,
    turns,
  };
}

/**
 * F0491 & F0492: Get turn counts for a transcript
 * GET /api/transcripts/:id/turn-counts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    // Count turns
    const turnCounts = countTurns(transcript);

    // Calculate conversation metrics
    const agentDominance = turnCounts.total_turns > 0
      ? (turnCounts.agent_turn_count / turnCounts.total_turns) * 100
      : 0;

    const callerDominance = turnCounts.total_turns > 0
      ? (turnCounts.caller_turn_count / turnCounts.total_turns) * 100
      : 0;

    // Ideal conversation is roughly 50/50 or agent slightly less
    const conversationBalance = Math.abs(50 - agentDominance) < 15 ? 'balanced' :
      agentDominance > 65 ? 'agent_dominant' : 'caller_dominant';

    return NextResponse.json({
      success: true,
      transcript_id: transcript.id,
      turn_counts: {
        agent_turns: turnCounts.agent_turn_count,
        caller_turns: turnCounts.caller_turn_count,
        total_turns: turnCounts.total_turns,
      },
      word_metrics: {
        avg_agent_words_per_turn: turnCounts.avg_agent_words_per_turn,
        avg_caller_words_per_turn: turnCounts.avg_caller_words_per_turn,
      },
      conversation_metrics: {
        agent_dominance_percent: Math.round(agentDominance),
        caller_dominance_percent: Math.round(callerDominance),
        balance: conversationBalance,
        insight: conversationBalance === 'agent_dominant'
          ? 'Agent may be talking too much. Consider more questions and active listening.'
          : conversationBalance === 'caller_dominant'
          ? 'Caller is doing most of the talking. Good active listening.'
          : 'Well-balanced conversation.',
      },
      turns: turnCounts.turns,
    });
  } catch (error: any) {
    console.error('Error counting turns:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to count turns' },
      { status: 500 }
    );
  }
}
