/**
 * Call Stage Detection
 *
 * Classifies the current stage of a call based on recent transcript context
 * Stages: Greeting → Discovery → Pitch → Objections → Close
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type CallStage = 'greeting' | 'discovery' | 'pitch' | 'objections' | 'close' | 'unknown';

export interface StageDetectionResult {
  stage: CallStage;
  confidence: number; // 0-1
  reasoning?: string;
}

const STAGE_DESCRIPTIONS = {
  greeting: 'Opening pleasantries, introductions, building rapport',
  discovery: 'Asking questions, understanding needs, qualifying prospect',
  pitch: 'Presenting solution, explaining value proposition',
  objections: 'Handling concerns, addressing questions, overcoming resistance',
  close: 'Asking for commitment, booking appointment, next steps',
  unknown: 'Unable to determine stage',
};

/**
 * Detect call stage from recent transcript
 * @param recentTranscript Last 10-20 exchanges (or last 2-3 minutes)
 */
export async function detectCallStage(recentTranscript: string): Promise<StageDetectionResult> {
  if (!recentTranscript || recentTranscript.trim().length === 0) {
    return { stage: 'unknown', confidence: 0 };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a sales call expert. Analyze the conversation excerpt and identify the current stage.

Stages:
- greeting: Opening, introductions, small talk
- discovery: Asking questions, understanding needs
- pitch: Presenting solution, explaining benefits
- objections: Handling concerns, addressing questions
- close: Asking for commitment, booking next steps

Respond ONLY with JSON:
{
  "stage": "greeting" | "discovery" | "pitch" | "objections" | "close",
  "confidence": number 0-1,
  "reasoning": "brief explanation"
}`,
        },
        {
          role: 'user',
          content: `Recent conversation:\n\n${recentTranscript}\n\nWhat stage is this call in?`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 150,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      stage: (result.stage as CallStage) || 'unknown',
      confidence: Math.min(1, Math.max(0, result.confidence || 0)),
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('[CallStageDetector] Detection failed:', error);
    return { stage: 'unknown', confidence: 0 };
  }
}

/**
 * Get stage display info
 */
export function getStageInfo(stage: CallStage): {
  label: string;
  color: string;
  description: string;
} {
  const colors = {
    greeting: 'bg-blue-100 text-blue-800',
    discovery: 'bg-purple-100 text-purple-800',
    pitch: 'bg-green-100 text-green-800',
    objections: 'bg-yellow-100 text-yellow-800',
    close: 'bg-orange-100 text-orange-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  const labels = {
    greeting: 'Greeting',
    discovery: 'Discovery',
    pitch: 'Pitch',
    objections: 'Objections',
    close: 'Closing',
    unknown: 'Unknown',
  };

  return {
    label: labels[stage],
    color: colors[stage],
    description: STAGE_DESCRIPTIONS[stage],
  };
}

/**
 * Get stage progress (0-100%)
 * Estimates how far through a typical sales call
 */
export function getStageProgress(stage: CallStage): number {
  const progress = {
    greeting: 10,
    discovery: 30,
    pitch: 60,
    objections: 80,
    close: 95,
    unknown: 0,
  };

  return progress[stage];
}
