/**
 * Knowledge Base Ingestion
 * Handles PDF, DOCX, TXT, and URL ingestion into the knowledge base
 */

import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// pdf-parse is a CommonJS module
const pdf = (pdfParse as any).default || pdfParse;
import { chunkText, type TextChunk, type ChunkingOptions } from './kb-chunker';
import { generateEmbeddingsBatch } from './kb-embeddings';
import { supabaseAdmin } from './supabase';

export interface IngestOptions {
  tenantId?: string;
  chunkingOptions?: ChunkingOptions;
  metadata?: Record<string, any>;
}

export interface IngestResult {
  documentId: number;
  title: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'url';
  chunkCount: number;
  totalTokens: number;
  embeddingIds: number[];
}

/**
 * Ingest PDF file
 */
export async function ingestPDF(
  buffer: Buffer,
  title: string,
  options: IngestOptions = {}
): Promise<IngestResult> {
  // Parse PDF
  const data = await pdf(buffer);
  const content = data.text;

  if (!content || content.trim().length === 0) {
    throw new Error('PDF contains no extractable text');
  }

  return ingestText(content, title, 'pdf', {
    ...options,
    metadata: {
      ...options.metadata,
      pageCount: data.numpages,
      pdfInfo: data.info,
    },
  });
}

/**
 * Ingest DOCX file
 */
export async function ingestDOCX(
  buffer: Buffer,
  title: string,
  options: IngestOptions = {}
): Promise<IngestResult> {
  // Parse DOCX
  const result = await mammoth.extractRawText({ buffer });
  const content = result.value;

  if (!content || content.trim().length === 0) {
    throw new Error('DOCX contains no extractable text');
  }

  return ingestText(content, title, 'docx', options);
}

/**
 * Ingest plain text
 */
export async function ingestPlainText(
  text: string,
  title: string,
  options: IngestOptions = {}
): Promise<IngestResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  return ingestText(text, title, 'txt', options);
}

/**
 * Ingest URL by fetching its content
 */
export async function ingestURL(
  url: string,
  title: string,
  options: IngestOptions = {}
): Promise<IngestResult> {
  // Fetch URL content
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';

  let content: string;

  if (contentType.includes('application/pdf')) {
    const buffer = Buffer.from(await response.arrayBuffer());
    const data = await pdf(buffer);
    content = data.text;
  } else if (contentType.includes('text/html')) {
    // Simple HTML to text conversion (strips tags)
    const html = await response.text();
    content = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  } else if (contentType.includes('text/')) {
    content = await response.text();
  } else {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  if (!content || content.trim().length === 0) {
    throw new Error('URL contains no extractable text');
  }

  return ingestText(content, title, 'url', {
    ...options,
    metadata: {
      ...options.metadata,
      sourceUrl: url,
      contentType,
    },
  });
}

/**
 * Core ingestion logic: chunk, embed, and store
 */
async function ingestText(
  content: string,
  title: string,
  fileType: 'pdf' | 'docx' | 'txt' | 'url',
  options: IngestOptions = {}
): Promise<IngestResult> {
  const tenantId = options.tenantId || 'default';

  // Step 1: Chunk the text
  const chunks = chunkText(content, options.chunkingOptions);

  if (chunks.length === 0) {
    throw new Error('No chunks generated from content');
  }

  // Step 2: Generate embeddings for all chunks
  const embeddings = await generateEmbeddingsBatch(chunks.map((c) => c.text));

  if (embeddings.length !== chunks.length) {
    throw new Error(
      `Embedding count mismatch: ${embeddings.length} vs ${chunks.length}`
    );
  }

  // Step 3: Store document in database
  const { data: document, error: docError } = await supabaseAdmin
    .from('kb_documents')
    .insert({
      tenant_id: tenantId,
      title,
      content,
      file_type: fileType,
      file_size_bytes: Buffer.byteLength(content, 'utf8'),
      chunk_count: chunks.length,
      metadata: options.metadata || {},
    })
    .select()
    .single();

  if (docError || !document) {
    throw new Error(`Failed to insert document: ${docError?.message}`);
  }

  // Step 4: Store embeddings
  const embeddingRows = chunks.map((chunk, idx) => ({
    document_id: document.id,
    tenant_id: tenantId,
    chunk_text: chunk.text,
    chunk_index: chunk.index,
    token_count: chunk.tokenCount,
    embedding: JSON.stringify(embeddings[idx].embedding), // pgvector accepts array as JSON string
    metadata: {
      startChar: chunk.startChar,
      endChar: chunk.endChar,
    },
  }));

  const { data: insertedEmbeddings, error: embError } = await supabaseAdmin
    .from('kb_embeddings')
    .insert(embeddingRows)
    .select('id');

  if (embError || !insertedEmbeddings) {
    // Rollback: delete the document
    await supabaseAdmin.from('kb_documents').delete().eq('id', document.id);
    throw new Error(`Failed to insert embeddings: ${embError?.message}`);
  }

  const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

  return {
    documentId: document.id,
    title,
    fileType,
    chunkCount: chunks.length,
    totalTokens,
    embeddingIds: insertedEmbeddings.map((e) => e.id),
  };
}

/**
 * Delete a document and all its embeddings
 */
export async function deleteDocument(
  documentId: number,
  tenantId?: string
): Promise<boolean> {
  const query = supabaseAdmin
    .from('kb_documents')
    .delete()
    .eq('id', documentId);

  if (tenantId) {
    query.eq('tenant_id', tenantId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }

  return true;
}

/**
 * List all documents for a tenant
 */
export async function listDocuments(tenantId: string = 'default'): Promise<
  Array<{
    id: number;
    title: string;
    fileType: string;
    chunkCount: number;
    createdAt: string;
    metadata: any;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from('kb_documents')
    .select('id, title, file_type, chunk_count, created_at, metadata')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  return (
    data?.map((d) => ({
      id: d.id,
      title: d.title,
      fileType: d.file_type,
      chunkCount: d.chunk_count,
      createdAt: d.created_at,
      metadata: d.metadata,
    })) || []
  );
}

/**
 * Get document by ID
 */
export async function getDocument(
  documentId: number,
  tenantId?: string
): Promise<{
  id: number;
  title: string;
  content: string;
  fileType: string;
  chunkCount: number;
  metadata: any;
} | null> {
  const query = supabaseAdmin
    .from('kb_documents')
    .select('*')
    .eq('id', documentId);

  if (tenantId) {
    query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    content: data.content,
    fileType: data.file_type,
    chunkCount: data.chunk_count,
    metadata: data.metadata,
  };
}
