/**
 * Knowledge Base Search
 * Semantic search using pgvector and OpenAI embeddings
 */

import { generateEmbedding } from './kb-embeddings';
import { supabaseAdmin } from './supabase';

export interface SearchResult {
  id: number;
  documentId: number;
  documentTitle: string;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  metadata: any;
}

export interface SearchOptions {
  tenantId?: string;
  limit?: number;
  similarityThreshold?: number;
  documentId?: number;
}

/**
 * Search knowledge base using semantic similarity
 */
export async function searchKnowledgeBase(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    tenantId = 'default',
    limit = 5,
    similarityThreshold = 0.7,
    documentId,
  } = options;

  if (!query || query.trim().length === 0) {
    throw new Error('Query cannot be empty');
  }

  // Generate embedding for the query
  const { embedding } = await generateEmbedding(query);

  // Build the SQL query for pgvector similarity search
  // Using cosine distance (1 - cosine_similarity)
  // Lower distance = more similar
  let sqlQuery = `
    SELECT
      e.id,
      e.document_id,
      e.chunk_text,
      e.chunk_index,
      e.metadata,
      d.title as document_title,
      1 - (e.embedding <=> $1::vector) as similarity
    FROM kb_embeddings e
    JOIN kb_documents d ON d.id = e.document_id
    WHERE e.tenant_id = $2
  `;

  const params: any[] = [JSON.stringify(embedding), tenantId];
  let paramCount = 2;

  if (documentId) {
    paramCount++;
    sqlQuery += ` AND e.document_id = $${paramCount}`;
    params.push(documentId);
  }

  paramCount++;
  sqlQuery += ` AND (1 - (e.embedding <=> $1::vector)) > $${paramCount}`;
  params.push(similarityThreshold);

  sqlQuery += ` ORDER BY e.embedding <=> $1::vector
    LIMIT $${paramCount + 1}`;
  params.push(limit);

  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql: sqlQuery,
    params,
  });

  // Since we don't have a custom RPC function, let's use a different approach
  // We'll query using the Supabase JS client with manual filtering

  let query_builder = supabaseAdmin
    .from('kb_embeddings')
    .select(
      `
      id,
      document_id,
      chunk_text,
      chunk_index,
      metadata,
      embedding,
      kb_documents!inner(title)
    `
    )
    .eq('tenant_id', tenantId);

  if (documentId) {
    query_builder = query_builder.eq('document_id', documentId);
  }

  // For now, we'll fetch more results and filter client-side
  // In production, you'd want to create a custom Postgres function
  const { data: allResults, error: queryError } = await query_builder.limit(
    100
  );

  if (queryError) {
    throw new Error(`Search failed: ${queryError.message}`);
  }

  if (!allResults || allResults.length === 0) {
    return [];
  }

  // Calculate similarities and filter
  const results: SearchResult[] = [];

  for (const row of allResults) {
    // Parse the embedding (stored as string in Supabase)
    const rowEmbedding =
      typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding;

    // Calculate cosine similarity
    const similarity = cosineSimilarity(embedding, rowEmbedding);

    if (similarity >= similarityThreshold) {
      results.push({
        id: row.id,
        documentId: row.document_id,
        documentTitle: (row as any).kb_documents.title,
        chunkText: row.chunk_text,
        chunkIndex: row.chunk_index,
        similarity,
        metadata: row.metadata,
      });
    }
  }

  // Sort by similarity (descending) and limit
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, limit);
}

/**
 * Calculate cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same length');
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
 * Get related chunks from the same document
 */
export async function getRelatedChunks(
  embeddingId: number,
  contextWindow: number = 2
): Promise<SearchResult[]> {
  // Get the embedding's document and chunk index
  const { data: embedding, error: embError } = await supabaseAdmin
    .from('kb_embeddings')
    .select('document_id, chunk_index, tenant_id')
    .eq('id', embeddingId)
    .single();

  if (embError || !embedding) {
    return [];
  }

  // Get surrounding chunks from the same document
  const { data: chunks, error: chunksError } = await supabaseAdmin
    .from('kb_embeddings')
    .select(
      `
      id,
      document_id,
      chunk_text,
      chunk_index,
      metadata,
      kb_documents!inner(title)
    `
    )
    .eq('document_id', embedding.document_id)
    .gte('chunk_index', embedding.chunk_index - contextWindow)
    .lte('chunk_index', embedding.chunk_index + contextWindow)
    .order('chunk_index', { ascending: true });

  if (chunksError || !chunks) {
    return [];
  }

  return chunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.document_id,
    documentTitle: (chunk as any).kb_documents.title,
    chunkText: chunk.chunk_text,
    chunkIndex: chunk.chunk_index,
    similarity: 1.0,
    metadata: chunk.metadata,
  }));
}

/**
 * Search with automatic query expansion
 * Generates related queries and combines results
 */
export async function searchWithExpansion(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  // For now, just do a simple search
  // In future, could use GPT-4 to generate related queries
  return searchKnowledgeBase(query, options);
}
