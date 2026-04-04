/**
 * GET /api/kb/documents
 * List all documents in knowledge base
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
    console.error('[KB List Documents Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to list documents',
      },
      { status: 500 }
    );
  }
}
