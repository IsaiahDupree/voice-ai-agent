-- Call Evaluations table
-- Stores LLM-as-judge quality scores for every call
CREATE TABLE IF NOT EXISTS call_evaluations (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT DEFAULT 'default' NOT NULL,

  -- Overall scores (0-10)
  goal_achieved BOOLEAN,
  goal_achievement_score DECIMAL(3, 1) CHECK (goal_achievement_score >= 0 AND goal_achievement_score <= 10),
  naturalness_score DECIMAL(3, 1) CHECK (naturalness_score >= 0 AND naturalness_score <= 10),
  objection_handling_score DECIMAL(3, 1) CHECK (objection_handling_score >= 0 AND objection_handling_score <= 10),
  information_accuracy_score DECIMAL(3, 1) CHECK (information_accuracy_score >= 0 AND information_accuracy_score <= 10),
  overall_score DECIMAL(3, 1) CHECK (overall_score >= 0 AND overall_score <= 10),

  -- Qualitative analysis
  failure_points TEXT[],
  improvement_suggestions TEXT[],
  highlight_moments TEXT[],
  recommended_prompt_changes TEXT[],

  -- Full evaluation data
  evaluation_data JSONB,

  -- Metadata
  evaluator_model TEXT DEFAULT 'gpt-4o',
  evaluation_duration_ms INTEGER,
  transcript_length INTEGER,
  call_duration_seconds INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_call_evaluations_call_id ON call_evaluations(call_id);
CREATE INDEX idx_call_evaluations_tenant ON call_evaluations(tenant_id);
CREATE INDEX idx_call_evaluations_overall_score ON call_evaluations(overall_score);
CREATE INDEX idx_call_evaluations_goal_achieved ON call_evaluations(goal_achieved);
CREATE INDEX idx_call_evaluations_created_at ON call_evaluations(created_at DESC);

-- Composite index for filtering low-scoring calls
CREATE INDEX idx_call_evaluations_failing ON call_evaluations(overall_score, created_at)
  WHERE overall_score < 5.0;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_call_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_evaluations_updated_at
  BEFORE UPDATE ON call_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_call_evaluations_updated_at();

-- Comments
COMMENT ON TABLE call_evaluations IS 'LLM-as-judge quality evaluations for every call';
COMMENT ON COLUMN call_evaluations.goal_achieved IS 'Whether the primary call goal was achieved';
COMMENT ON COLUMN call_evaluations.failure_points IS 'Array of specific moments where the call went wrong';
COMMENT ON COLUMN call_evaluations.improvement_suggestions IS 'Actionable feedback for improving future calls';
COMMENT ON COLUMN call_evaluations.highlight_moments IS 'Things the agent did well';
COMMENT ON COLUMN call_evaluations.recommended_prompt_changes IS 'Suggested changes to system prompt';
