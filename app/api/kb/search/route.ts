/**
 * POST /api/kb/search
 * Semantic search in knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeBase } from '@/lib/kb-search';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      tenantId = 'default',
      limit = 5,
      similarityThreshold = 0.7,
      documentId,
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query must be a non-empty string' },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 50' },
        { status: 400 }
      );
    }

    if (similarityThreshold < 0 || similarityThreshold > 1) {
      return NextResponse.json(
        { error: 'Similarity threshold must be between 0 and 1' },
        { status: 400 }
      );
    }

    const results = await searchKnowledgeBase(query, {
      tenantId,
      limit,
      similarityThreshold,
      documentId,
    });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('[KB Search Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Search failed',
      },
      { status: 500 }
    );
  }
}
