-- ========================================
-- diyaa.ai — Migration 005: Agent v2
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times (IF NOT EXISTS).
-- ========================================

-- 1. Add agent_phase column to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS agent_phase TEXT DEFAULT 'diagnostic';

-- 2. Index for phase queries
CREATE INDEX IF NOT EXISTS idx_sessions_agent_phase ON sessions(agent_phase);

-- 3. Create business_models table (queried by lib/agent/businessModel.ts)
CREATE TABLE IF NOT EXISTS business_models (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid REFERENCES sessions(id) ON DELETE CASCADE,
  model        jsonb NOT NULL DEFAULT '{}',
  completeness_score int DEFAULT 0,
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT business_models_session_id_unique UNIQUE (session_id)
);

-- 4. Index for business_models lookups
CREATE INDEX IF NOT EXISTS idx_business_models_session_id ON business_models(session_id);

-- 5. Enable RLS
ALTER TABLE business_models ENABLE ROW LEVEL SECURITY;

-- 6. RLS policy — service role only
DROP POLICY IF EXISTS "Business models service role only" ON business_models;
CREATE POLICY "Business models service role only"
  ON business_models FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 7. Add ai_readiness_score to leads if missing (used in email notifications)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_readiness_score NUMERIC;
