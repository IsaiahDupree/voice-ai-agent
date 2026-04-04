/**
 * POST /api/kb/upload
 * Upload and ingest documents into knowledge base
 * Supports PDF, DOCX, TXT files and URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ingestPDF,
  ingestDOCX,
  ingestPlainText,
  ingestURL,
} from '@/lib/kb-ingest';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let result;

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const title = (formData.get('title') as string) || file?.name;
      const tenantId = (formData.get('tenantId') as string) || 'default';
      const metadataStr = formData.get('metadata') as string;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name.toLowerCase();

      const options = {
        tenantId,
        metadata: metadataStr ? JSON.parse(metadataStr) : {},
      };

      if (fileName.endsWith('.pdf')) {
        result = await ingestPDF(buffer, title, options);
      } else if (fileName.endsWith('.docx')) {
        result = await ingestDOCX(buffer, title, options);
      } else if (
        fileName.endsWith('.txt') ||
        fileName.endsWith('.md') ||
        fileName.endsWith('.text')
      ) {
        const text = buffer.toString('utf8');
        result = await ingestPlainText(text, title, options);
      } else {
        return NextResponse.json(
          {
            error: `Unsupported file type. Supported: .pdf, .docx, .txt, .md`,
          },
          { status: 400 }
        );
      }
    }
    // Handle JSON (URL or text)
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { url, text, title, tenantId = 'default', metadata = {} } = body;

      if (!title) {
        return NextResponse.json(
          { error: 'Title is required' },
          { status: 400 }
        );
      }

      const options = { tenantId, metadata };

      if (url) {
        result = await ingestURL(url, title, options);
      } else if (text) {
        result = await ingestPlainText(text, title, options);
      } else {
        return NextResponse.json(
          { error: 'Either url or text must be provided' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid content type. Use multipart/form-data or application/json' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[KB Upload Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to upload document',
      },
      { status: 500 }
    );
  }
}
