-- Knowledge Base Embeddings table
-- Stores text chunks and their OpenAI embeddings for semantic search
CREATE TABLE IF NOT EXISTS kb_embeddings (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  tenant_id TEXT DEFAULT 'default',
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER,
  embedding vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying and vector similarity search
CREATE INDEX idx_kb_embeddings_document_id ON kb_embeddings(document_id);
CREATE INDEX idx_kb_embeddings_tenant_id ON kb_embeddings(tenant_id);
CREATE INDEX idx_kb_embeddings_chunk_index ON kb_embeddings(document_id, chunk_index);

-- Vector similarity index using HNSW (Hierarchical Navigable Small World)
-- cosine distance is best for OpenAI embeddings (they are normalized)
CREATE INDEX idx_kb_embeddings_vector ON kb_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Composite index for tenant-scoped vector search
CREATE INDEX idx_kb_embeddings_tenant_vector ON kb_embeddings(tenant_id);

-- Comment
COMMENT ON TABLE kb_embeddings IS 'Stores text chunks with vector embeddings for semantic search using pgvector';
COMMENT ON COLUMN kb_embeddings.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
