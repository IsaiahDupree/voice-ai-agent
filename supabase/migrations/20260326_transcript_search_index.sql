-- F0475: Transcript full-text search index in Supabase
-- Conditional: table may have been renamed from voice_agent_transcripts to transcripts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='voice_agent_transcripts') THEN
    DROP INDEX IF EXISTS idx_transcript_text_search;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transcript_text_search ON voice_agent_transcripts USING gin(to_tsvector(''english'', COALESCE(transcript_text, '''')))';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON voice_agent_transcripts(call_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON voice_agent_transcripts(created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transcripts_metadata ON voice_agent_transcripts USING gin(metadata)';
  END IF;
END $$;
