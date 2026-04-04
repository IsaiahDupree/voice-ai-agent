// F0269: Outbound call summary generation
// AI generates call summary after outbound call

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

/**
 * Generate AI-powered call summary from transcript
 * F0269: Outbound call summary
 *
 * Falls back to extractive summary if OpenAI key not available
 */
export async function generateCallSummary(
  transcript: string,
  callContext?: {
    direction?: string;
    duration?: number;
    outcome?: string;
  }
): Promise<string> {
  if (!transcript || transcript.length < 20) {
    return 'No transcript available';
  }

  // For now, use extractive summary
  // TODO: Integrate with OpenAI/Claude for AI-generated summaries
  const extractiveSummary = generateExtractiveSummary(transcript, callContext);

  // If OpenAI key is available, generate AI summary
  if (process.env.OPENAI_API_KEY && transcript.length > 100) {
    try {
      const aiSummary = await generateAISummary(transcript, callContext);
      return aiSummary;
    } catch (error) {
      console.error('[Call Summary] AI generation failed, using extractive:', error);
      return extractiveSummary;
    }
  }

  return extractiveSummary;
}

/**
 * Simple extractive summary
 * Takes key phrases and combines with outcome
 */
function generateExtractiveSummary(
  transcript: string,
  callContext?: {
    direction?: string;
    duration?: number;
    outcome?: string;
  }
): string {
  const lines = transcript.split('\n').filter((line) => line.trim().length > 0);

  // Extract key information
  const firstLine = lines[0] || '';
  const lastLine = lines[lines.length - 1] || '';

  // Determine call outcome from context
  const outcome = callContext?.outcome || 'completed';
  const direction = callContext?.direction || 'outbound';
  const duration = callContext?.duration
    ? `${Math.round(callContext.duration)}s`
    : 'unknown duration';

  // Keywords for intent detection
  const hasBooking =
    transcript.toLowerCase().includes('book') ||
    transcript.toLowerCase().includes('appointment') ||
    transcript.toLowerCase().includes('schedule');
  const hasInterest =
    transcript.toLowerCase().includes('interested') ||
    transcript.toLowerCase().includes('tell me more');
  const hasRejection =
    transcript.toLowerCase().includes('not interested') ||
    transcript.toLowerCase().includes('no thanks');

  let intent = 'general inquiry';
  if (hasBooking) intent = 'booking/scheduling';
  else if (hasInterest) intent = 'expressed interest';
  else if (hasRejection) intent = 'not interested';

  return `${direction} call (${duration}). Intent: ${intent}. Outcome: ${outcome}. ${
    firstLine.substring(0, 150) + (firstLine.length > 150 ? '...' : '')
  }`;
}

/**
 * AI-generated summary using OpenAI
 * Provides concise, actionable summary of the call
 */
async function generateAISummary(
  transcript: string,
  callContext?: {
    direction?: string;
    duration?: number;
    outcome?: string;
  }
): Promise<string> {
  const prompt = `Summarize this ${callContext?.direction || 'phone'} call in 2-3 concise sentences. Focus on:
- Main purpose/intent
- Key outcomes or next steps
- Sentiment (positive/neutral/negative)

Transcript:
${transcript.substring(0, 2000)}

Summary:`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a call center analyst. Summarize phone calls concisely and professionally.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const summary = data.choices[0]?.message?.content?.trim();

  if (!summary) {
    throw new Error('No summary generated');
  }

  return summary;
}

/**
 * Store call summary in contact record
 * F0269: Summary stored in contact record
 */
export async function storeCallSummaryInContact(
  contactId: number,
  callId: string,
  summary: string
): Promise<void> {
  try {
    // Get existing contact metadata
    const { data: contact } = await supabase
      .from('voice_agent_contacts')
      .select('metadata')
      .eq('id', contactId)
      .single();

    const existingMetadata = (contact?.metadata as Record<string, any>) || {};

    // Add call summary to metadata
    const updatedMetadata = {
      ...existingMetadata,
      recent_calls: [
        {
          call_id: callId,
          summary,
          timestamp: new Date().toISOString()
        },
        ...((existingMetadata.recent_calls || []) as any[]).slice(0, 4) // Keep last 5 calls
      ],
      last_call_summary: summary
    };

    await supabase
      .from('voice_agent_contacts')
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId);

    console.log(`[Call Summary] Stored summary for contact ${contactId}`);
  } catch (error) {
    console.error('[Call Summary] Failed to store in contact:', error);
    // Fail-open: don't block on summary storage failures
  }
}
