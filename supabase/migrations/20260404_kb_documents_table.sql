-- Knowledge Base Documents table
-- Stores uploaded documents and their metadata
CREATE TABLE IF NOT EXISTS kb_documents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT DEFAULT 'default',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'url')),
  file_size_bytes INTEGER,
  chunk_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_kb_documents_tenant_id ON kb_documents(tenant_id);
CREATE INDEX idx_kb_documents_file_type ON kb_documents(file_type);
CREATE INDEX idx_kb_documents_created_at ON kb_documents(created_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_kb_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_documents_updated_at
  BEFORE UPDATE ON kb_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_documents_updated_at();

-- Comment
COMMENT ON TABLE kb_documents IS 'Stores knowledge base documents for RAG retrieval';
