-- F0475: Transcript full-text search index in Supabase
-- Create GIN index on transcript_text for fast full-text search

-- Drop existing index if exists
DROP INDEX IF EXISTS idx_transcript_text_search;

-- Create full-text search index using tsvector
CREATE INDEX idx_transcript_text_search
ON voice_agent_transcripts
USING gin(to_tsvector('english', transcript_text));

-- Add comment
COMMENT ON INDEX idx_transcript_text_search IS 'F0475: Full-text search index for transcript text using PostgreSQL GIN index';

-- Create index on call_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_transcripts_call_id
ON voice_agent_transcripts(call_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at
ON voice_agent_transcripts(created_at DESC);

-- Create composite index for metadata queries (sentiment, campaign, etc.)
CREATE INDEX IF NOT EXISTS idx_transcripts_metadata
ON voice_agent_transcripts USING gin(metadata);

COMMENT ON INDEX idx_transcripts_metadata IS 'F0477: GIN index for metadata JSONB queries (sentiment, campaign_id, etc.)';
