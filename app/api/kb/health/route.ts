/**
 * GET /api/kb/health
 * Health check for knowledge base system
 */

import { NextResponse } from 'next/server';
import { checkEmbeddingsHealth } from '@/lib/kb-embeddings';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const start = Date.now();

  try {
    // Check database connectivity
    const { error: dbError } = await supabaseAdmin
      .from('kb_documents')
      .select('id')
      .limit(1);

    const dbHealthy = !dbError;

    // Check OpenAI embeddings API
    const embeddingsHealth = await checkEmbeddingsHealth();

    // Check pgvector extension
    const { data: extensionData, error: extError } = await supabaseAdmin
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector')
      .single();

    const pgvectorEnabled = !extError && extensionData !== null;

    const responseTimeMs = Date.now() - start;
    const allHealthy =
      dbHealthy && embeddingsHealth.healthy && pgvectorEnabled;

    return NextResponse.json({
      healthy: allHealthy,
      responseTimeMs,
      checks: {
        database: {
          healthy: dbHealthy,
          error: dbError?.message,
        },
        embeddings: embeddingsHealth,
        pgvector: {
          healthy: pgvectorEnabled,
          error: extError?.message,
        },
      },
    });
  } catch (error: any) {
    const responseTimeMs = Date.now() - start;

    return NextResponse.json(
      {
        healthy: false,
        responseTimeMs,
        error: error.message || 'Health check failed',
      },
      { status: 500 }
    );
  }
}
