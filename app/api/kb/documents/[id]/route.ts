/**
 * GET /api/kb/documents/[id] - Get document by ID
 * DELETE /api/kb/documents/[id] - Delete document and embeddings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDocument, deleteDocument } from '@/lib/kb-ingest';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = parseInt(params.id);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;

    const document = await getDocument(documentId, tenantId);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error: any) {
    console.error('[KB Get Document Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to get document',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = parseInt(params.id);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;

    await deleteDocument(documentId, tenantId);

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('[KB Delete Document Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to delete document',
      },
      { status: 500 }
    );
  }
}
