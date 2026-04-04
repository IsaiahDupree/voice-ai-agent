/**
 * Knowledge Base Chunker
 * Splits text into semantic chunks with overlap for better RAG retrieval
 */

import { encoding_for_model } from 'tiktoken';

export interface TextChunk {
  text: string;
  index: number;
  tokenCount: number;
  startChar: number;
  endChar: number;
}

export interface ChunkingOptions {
  maxTokens?: number;
  overlapTokens?: number;
  preserveParagraphs?: boolean;
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxTokens: 500,
  overlapTokens: 50,
  preserveParagraphs: true,
};

/**
 * Count tokens in text using tiktoken (same as OpenAI)
 */
export function countTokens(text: string): number {
  const encoder = encoding_for_model('gpt-4o');
  const tokens = encoder.encode(text);
  const count = tokens.length;
  encoder.free();
  return count;
}

/**
 * Split text into chunks based on token count with overlap
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];

  // If preserveParagraphs is true, first split by paragraphs
  if (opts.preserveParagraphs) {
    return chunkByParagraphs(text, opts);
  }

  // Otherwise, chunk by sentences with token counting
  return chunkBySentences(text, opts);
}

/**
 * Chunk text while trying to preserve paragraph boundaries
 */
function chunkByParagraphs(
  text: string,
  options: Required<ChunkingOptions>
): TextChunk[] {
  // Split into paragraphs (double newline or single newline for markdown)
  const paragraphs = text.split(/\n\n+|\r\n\r\n+/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = 0;
  let startChar = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (!paragraph) continue;

    const paragraphTokens = countTokens(paragraph);

    // If single paragraph exceeds max tokens, split it further
    if (paragraphTokens > options.maxTokens) {
      // Save current chunk if it exists
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          tokenCount: currentTokens,
          startChar,
          endChar: startChar + currentChunk.length,
        });
        startChar += currentChunk.length;
        currentChunk = '';
        currentTokens = 0;
      }

      // Split large paragraph by sentences
      const sentenceChunks = chunkBySentences(paragraph, options);
      sentenceChunks.forEach((chunk) => {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          startChar: startChar + chunk.startChar,
          endChar: startChar + chunk.endChar,
        });
      });
      startChar += paragraph.length;
      continue;
    }

    // Check if adding this paragraph would exceed max tokens
    if (currentTokens + paragraphTokens > options.maxTokens && currentChunk) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex++,
        tokenCount: currentTokens,
        startChar,
        endChar: startChar + currentChunk.length,
      });

      // Start new chunk with overlap
      const overlapText = getOverlapText(currentChunk, options.overlapTokens);
      startChar += currentChunk.length - overlapText.length;
      currentChunk = overlapText + '\n\n' + paragraph;
      currentTokens = countTokens(currentChunk);
    } else {
      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
      currentTokens += paragraphTokens;
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
      tokenCount: currentTokens,
      startChar,
      endChar: startChar + currentChunk.length,
    });
  }

  return chunks;
}

/**
 * Chunk text by sentences with token counting
 */
function chunkBySentences(
  text: string,
  options: Required<ChunkingOptions>
): TextChunk[] {
  // Split into sentences (simple regex, could be improved with NLP)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = 0;
  let startChar = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    // If single sentence exceeds max tokens, split by words
    if (sentenceTokens > options.maxTokens) {
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          tokenCount: currentTokens,
          startChar,
          endChar: startChar + currentChunk.length,
        });
        startChar += currentChunk.length;
        currentChunk = '';
        currentTokens = 0;
      }

      // Split by words as last resort
      const words = sentence.split(/\s+/);
      let wordChunk = '';
      let wordTokens = 0;

      for (const word of words) {
        const wordCount = countTokens(word);
        if (wordTokens + wordCount > options.maxTokens && wordChunk) {
          chunks.push({
            text: wordChunk.trim(),
            index: chunkIndex++,
            tokenCount: wordTokens,
            startChar,
            endChar: startChar + wordChunk.length,
          });
          startChar += wordChunk.length;
          wordChunk = word;
          wordTokens = wordCount;
        } else {
          wordChunk += (wordChunk ? ' ' : '') + word;
          wordTokens += wordCount;
        }
      }

      if (wordChunk) {
        chunks.push({
          text: wordChunk.trim(),
          index: chunkIndex++,
          tokenCount: wordTokens,
          startChar,
          endChar: startChar + wordChunk.length,
        });
        startChar += wordChunk.length;
      }
      continue;
    }

    // Check if adding this sentence would exceed max tokens
    if (currentTokens + sentenceTokens > options.maxTokens && currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex++,
        tokenCount: currentTokens,
        startChar,
        endChar: startChar + currentChunk.length,
      });

      const overlapText = getOverlapText(currentChunk, options.overlapTokens);
      startChar += currentChunk.length - overlapText.length;
      currentChunk = overlapText + ' ' + sentence;
      currentTokens = countTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
      tokenCount: currentTokens,
      startChar,
      endChar: startChar + currentChunk.length,
    });
  }

  return chunks;
}

/**
 * Get overlap text from end of chunk (approximately N tokens)
 */
function getOverlapText(text: string, targetTokens: number): string {
  if (targetTokens === 0) return '';

  // Start from the end and work backwards
  const words = text.split(/\s+/);
  let overlapText = '';
  let tokens = 0;

  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    const wordTokens = countTokens(word);

    if (tokens + wordTokens > targetTokens) {
      break;
    }

    overlapText = word + (overlapText ? ' ' + overlapText : '');
    tokens += wordTokens;
  }

  return overlapText;
}

/**
 * Validate chunking options
 */
export function validateChunkingOptions(
  options: ChunkingOptions
): string | null {
  if (options.maxTokens !== undefined) {
    if (options.maxTokens < 1) {
      return 'maxTokens must be at least 1';
    }
    if (options.maxTokens > 8000) {
      return 'maxTokens should not exceed 8000';
    }
  }

  if (options.overlapTokens !== undefined) {
    if (options.overlapTokens < 0) {
      return 'overlapTokens cannot be negative';
    }
    if (
      options.maxTokens !== undefined &&
      options.overlapTokens >= options.maxTokens
    ) {
      return 'overlapTokens must be less than maxTokens';
    }
  }

  return null;
}
