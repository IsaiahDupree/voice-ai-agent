/**
 * Live Sentiment Analysis
 *
 * Fast per-chunk sentiment scoring using GPT-4o-mini
 * Used for real-time sentiment indicators in live transcript dashboard
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type SentimentScore = 'positive' | 'neutral' | 'negative';

export interface SentimentResult {
  sentiment: SentimentScore;
  confidence: number; // 0-1
  score: number; // -1 to 1 (negative to positive)
}

/**
 * Analyze sentiment of a transcript chunk
 * Uses GPT-4o-mini for speed (typically <500ms)
 */
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  if (!text || text.trim().length === 0) {
    return { sentiment: 'neutral', confidence: 0, score: 0 };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyze the sentiment of the given text. Respond ONLY with a JSON object:
{
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number between 0 and 1,
  "score": number between -1 (very negative) and 1 (very positive)
}

Be quick and accurate. Focus on overall emotional tone.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 50,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      sentiment: result.sentiment || 'neutral',
      confidence: Math.min(1, Math.max(0, result.confidence || 0)),
      score: Math.min(1, Math.max(-1, result.score || 0)),
    };
  } catch (error) {
    console.error('[SentimentLive] Analysis failed:', error);
    return { sentiment: 'neutral', confidence: 0, score: 0 };
  }
}

/**
 * Get sentiment color for UI display
 */
export function getSentimentColor(sentiment: SentimentScore): string {
  switch (sentiment) {
    case 'positive':
      return 'text-green-600 bg-green-100';
    case 'negative':
      return 'text-red-600 bg-red-100';
    case 'neutral':
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Get sentiment emoji
 */
export function getSentimentEmoji(sentiment: SentimentScore): string {
  switch (sentiment) {
    case 'positive':
      return '😊';
    case 'negative':
      return '😟';
    case 'neutral':
    default:
      return '😐';
  }
}

/**
 * Aggregate sentiment from multiple chunks
 */
export function aggregateSentiment(results: SentimentResult[]): SentimentResult {
  if (results.length === 0) {
    return { sentiment: 'neutral', confidence: 0, score: 0 };
  }

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  let sentiment: SentimentScore;
  if (avgScore > 0.2) sentiment = 'positive';
  else if (avgScore < -0.2) sentiment = 'negative';
  else sentiment = 'neutral';

  return {
    sentiment,
    confidence: avgConfidence,
    score: avgScore,
  };
}
