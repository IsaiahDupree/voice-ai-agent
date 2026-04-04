/**
 * Semantic Voice Activity Detection (VAD)
 * Classifies speech utterances to detect real interruptions vs fillers/affirmations
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type UtteranceType =
  | 'real-interrupt'
  | 'filler'
  | 'affirmation'
  | 'side-comment';

export interface UtteranceClassification {
  type: UtteranceType;
  confidence: number; // 0-1
  utterance: string;
  reasoning?: string;
}

export interface ClassificationContext {
  agentSpeaking: boolean;
  conversationStage?: 'greeting' | 'discovery' | 'pitch' | 'objection' | 'close';
  lastAgentUtterance?: string;
}

/**
 * Few-shot examples for GPT-4o-mini classification
 * Real production examples from voice AI calls
 */
const FEW_SHOT_EXAMPLES = [
  // Affirmations - listener is engaged, not interrupting
  {
    utterance: 'mm-hmm',
    type: 'affirmation' as const,
    reasoning: 'Classic back-channel cue showing engagement without interrupting',
  },
  {
    utterance: 'yeah',
    type: 'affirmation' as const,
    reasoning: 'Short acknowledgment, speaker continues',
  },
  {
    utterance: 'uh-huh',
    type: 'affirmation' as const,
    reasoning: 'Minimal response indicating listener is following',
  },
  {
    utterance: 'okay',
    type: 'affirmation' as const,
    reasoning: 'Brief acknowledgment, not a turn-taking bid',
  },
  {
    utterance: 'right',
    type: 'affirmation' as const,
    reasoning: 'Agreement signal, speaker keeps floor',
  },
  {
    utterance: 'I see',
    type: 'affirmation' as const,
    reasoning: 'Understanding signal without claiming turn',
  },
  {
    utterance: 'got it',
    type: 'affirmation' as const,
    reasoning: 'Comprehension acknowledgment',
  },

  // Fillers - hesitation, thinking, no intent to interrupt
  {
    utterance: 'um',
    type: 'filler' as const,
    reasoning: 'Vocalized pause while thinking',
  },
  {
    utterance: 'uh',
    type: 'filler' as const,
    reasoning: 'Hesitation marker',
  },
  {
    utterance: 'like',
    type: 'filler' as const,
    reasoning: 'Filler word indicating thought process',
  },
  {
    utterance: 'you know',
    type: 'filler' as const,
    reasoning: 'Common filler phrase, not interrupting',
  },

  // Side comments - brief reactions, not claiming turn
  {
    utterance: 'oh',
    type: 'side-comment' as const,
    reasoning: 'Reaction particle, not a full turn claim',
  },
  {
    utterance: 'wow',
    type: 'side-comment' as const,
    reasoning: 'Emotional reaction, brief interjection',
  },
  {
    utterance: 'huh',
    type: 'side-comment' as const,
    reasoning: 'Surprise or confusion marker',
  },
  {
    utterance: 'interesting',
    type: 'side-comment' as const,
    reasoning: 'Brief evaluative comment',
  },

  // Real interrupts - clear intent to take turn
  {
    utterance: 'wait',
    type: 'real-interrupt' as const,
    reasoning: 'Explicit request to pause speaker',
  },
  {
    utterance: 'hold on',
    type: 'real-interrupt' as const,
    reasoning: 'Direct interruption signal',
  },
  {
    utterance: 'stop',
    type: 'real-interrupt' as const,
    reasoning: 'Command to cease speaking',
  },
  {
    utterance: 'excuse me',
    type: 'real-interrupt' as const,
    reasoning: 'Polite but clear turn-taking bid',
  },
  {
    utterance: "I don't think that's right",
    type: 'real-interrupt' as const,
    reasoning: 'Disagreement requiring response, clear turn claim',
  },
  {
    utterance: 'can I ask a question',
    type: 'real-interrupt' as const,
    reasoning: 'Explicit request for turn',
  },
  {
    utterance: 'but what about',
    type: 'real-interrupt' as const,
    reasoning: 'Question or objection, needs response',
  },
  {
    utterance: "I'm not interested",
    type: 'real-interrupt' as const,
    reasoning: 'Substantive response requiring turn change',
  },
];

/**
 * Classify an utterance using GPT-4o-mini with few-shot examples
 */
export async function classifyUtterance(
  utterance: string,
  context: ClassificationContext
): Promise<UtteranceClassification> {
  // Quick rule-based classification for very short utterances
  const normalized = utterance.toLowerCase().trim();

  if (normalized.length <= 2) {
    // Single characters or 2-letter utterances are almost always fillers/affirmations
    if (['mm', 'uh', 'um', 'oh', 'ah'].includes(normalized)) {
      return {
        type: 'filler',
        confidence: 0.95,
        utterance,
        reasoning: 'Very short vocalization, likely filler',
      };
    }
  }

  // Common affirmations - rule-based for speed
  const commonAffirmations = [
    'mm-hmm',
    'mhmm',
    'mmhm',
    'uh-huh',
    'uhhuh',
    'yeah',
    'yep',
    'yup',
    'okay',
    'ok',
    'right',
    'sure',
    'got it',
    'i see',
  ];

  if (commonAffirmations.includes(normalized)) {
    return {
      type: 'affirmation',
      confidence: 0.98,
      utterance,
      reasoning: 'Common back-channel affirmation',
    };
  }

  // For longer or ambiguous utterances, use GPT-4o-mini
  const systemPrompt = `You are an expert in conversation analysis and turn-taking dynamics. Classify spoken utterances into four categories:

1. **real-interrupt**: Speaker is clearly trying to take the conversational floor. Includes questions, objections, disagreements, or explicit interruption signals (wait, stop, hold on).

2. **affirmation**: Back-channel cues showing engagement without interrupting. Brief acknowledgments like "mm-hmm", "yeah", "okay", "I see". Speaker is NOT trying to claim the turn.

3. **filler**: Hesitation markers and vocalized pauses. "um", "uh", "like", "you know". Speaker is thinking or pausing, not interrupting.

4. **side-comment**: Brief emotional reactions or evaluations. "oh", "wow", "huh", "interesting". Not claiming the turn, just reacting.

**Context**: ${context.agentSpeaking ? 'Agent is currently speaking' : 'Caller is speaking'}${context.conversationStage ? `, conversation stage: ${context.conversationStage}` : ''}

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "type": "real-interrupt" | "filler" | "affirmation" | "side-comment",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

  const fewShotExamples = FEW_SHOT_EXAMPLES.map((ex) => ({
    utterance: ex.utterance,
    classification: {
      type: ex.type,
      confidence: 0.95,
      reasoning: ex.reasoning,
    },
  }));

  const userPrompt = `Examples:
${fewShotExamples.slice(0, 10).map((ex) => `"${ex.utterance}" → ${JSON.stringify(ex.classification)}`).join('\n')}

Now classify this utterance:
"${utterance}"`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 150,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      type: result.type || 'filler',
      confidence: result.confidence || 0.5,
      utterance,
      reasoning: result.reasoning,
    };
  } catch (error: any) {
    console.error('[Semantic VAD Error]:', error);
    // Fallback to filler for safety (least disruptive)
    return {
      type: 'filler',
      confidence: 0.3,
      utterance,
      reasoning: 'Classification failed, defaulting to filler',
    };
  }
}

/**
 * Determine if classification should trigger agent pause
 * Based on classification type, confidence, and sensitivity setting
 */
export function shouldPauseAgent(
  classification: UtteranceClassification,
  sensitivity: 'low' | 'medium' | 'high' = 'medium'
): boolean {
  const { type, confidence } = classification;

  // Real interrupts always pause (if confidence is reasonable)
  if (type === 'real-interrupt' && confidence >= 0.6) {
    return true;
  }

  // Sensitivity thresholds
  const thresholds = {
    low: 0.85, // Only very clear interrupts
    medium: 0.70, // Balanced
    high: 0.55, // More responsive, risk false positives
  };

  const threshold = thresholds[sensitivity];

  // Real interrupts with lower confidence
  if (type === 'real-interrupt' && confidence >= threshold) {
    return true;
  }

  // Everything else (affirmations, fillers, side-comments) should NOT pause
  return false;
}

/**
 * Get few-shot examples for testing or UI display
 */
export function getFewShotExamples() {
  return FEW_SHOT_EXAMPLES;
}
