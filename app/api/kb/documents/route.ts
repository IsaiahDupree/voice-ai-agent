/**
 * GET /api/kb/documents
 * List all documents in knowledge base
 * F014: Graceful fallback for /api/kb/documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { listDocuments } from '@/lib/kb-ingest';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';

    const documents = await listDocuments(tenantId);

    return NextResponse.json({
      success: true,
      documents,
      count: documents.length,
    });
  } catch (error: any) {
    // F014: Graceful fallback for schema-related errors
    if (error?.message?.includes('does not exist') || error?.message?.includes('schema cache') || error?.message?.includes('Could not find') || error?.code === 'PGRST204') {
      console.warn('[KB List Documents] Schema error detected, returning graceful fallback:', error);
      return NextResponse.json({
        documents: []
      }, { status: 200 });
    }

    console.error('[KB List Documents Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to list documents',
      },
      { status: 500 }
    );
  }
}
