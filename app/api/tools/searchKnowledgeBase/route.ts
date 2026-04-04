/**
 * POST /api/tools/searchKnowledgeBase
 * Vapi function tool for semantic knowledge base search
 * Allows voice agent to answer questions by retrieving relevant information
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase } from '@/lib/kb-search';
import { withTelemetry } from '@/lib/tool-telemetry';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    query,
    limit = 3,
    tenantId = 'default',
    similarityThreshold = 0.75,
  } = body;

  return withTelemetry('searchKnowledgeBase', body.callId, body, async () => {
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    if (typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query must be a non-empty string' },
        { status: 400 }
      );
    }

    try {
      const results = await searchKnowledgeBase(query, {
        tenantId,
        limit,
        similarityThreshold,
      });

      if (results.length === 0) {
        return NextResponse.json({
          answer:
            "I couldn't find any relevant information in the knowledge base for that question.",
          sources: [],
          confidence: 0,
        });
      }

      // Format results for the voice agent
      // Combine top results into a coherent answer
      const topResult = results[0];
      const additionalContext = results
        .slice(1)
        .map((r) => r.chunkText)
        .join('\n\n');

      const answer = topResult.chunkText;
      const sources = results.map((r) => ({
        documentTitle: r.documentTitle,
        documentId: r.documentId,
        similarity: r.similarity,
        excerpt: r.chunkText.substring(0, 200) + '...',
      }));

      return NextResponse.json({
        answer,
        additionalContext: additionalContext || null,
        sources,
        confidence: topResult.similarity,
        resultsFound: results.length,
      });
    } catch (error: any) {
      console.error('[searchKnowledgeBase Error]:', error);
      return NextResponse.json(
        {
          error: error.message || 'Failed to search knowledge base',
        },
        { status: 500 }
      );
    }
  });
}
