/**
 * Knowledge Base Embeddings
 * OpenAI text-embedding-3-small wrapper for generating embeddings
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

/**
 * Generate embedding for a single text chunk using OpenAI text-embedding-3-small
 * Returns 1536-dimensional vector
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });

  if (!response.data || response.data.length === 0) {
    throw new Error('No embedding returned from OpenAI');
  }

  const embedding = response.data[0].embedding;
  const tokenCount = response.usage?.total_tokens || 0;

  return {
    embedding,
    tokenCount,
  };
}

/**
 * Generate embeddings for multiple text chunks in batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Filter out empty texts
  const validTexts = texts.filter((t) => t && t.trim().length > 0);

  if (validTexts.length === 0) {
    return [];
  }

  // OpenAI API has a limit of 2048 inputs per request
  const batchSize = 2048;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < validTexts.length; i += batchSize) {
    const batch = validTexts.slice(i, i + batchSize);

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
      encoding_format: 'float',
    });

    if (!response.data || response.data.length === 0) {
      throw new Error(`No embeddings returned for batch starting at index ${i}`);
    }

    const batchResults = response.data.map((item, idx) => ({
      embedding: item.embedding,
      tokenCount: Math.floor((response.usage?.total_tokens || 0) / batch.length),
    }));

    results.push(...batchResults);
  }

  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between -1 and 1 (higher is more similar)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Health check for OpenAI embeddings API
 */
export async function checkEmbeddingsHealth(): Promise<{
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    await generateEmbedding('health check test');

    return {
      healthy: true,
      responseTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      responseTimeMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
