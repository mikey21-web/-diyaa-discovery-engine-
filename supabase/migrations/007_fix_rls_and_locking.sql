-- ========================================
-- diyaa.ai — Migration 007: Fix RLS and Add Locking
-- Run this in the Supabase SQL Editor.
-- ========================================

-- 1. Drop incorrect RLS policies that bypassed security
DROP POLICY IF EXISTS "service_role_business_models" ON business_models;
DROP POLICY IF EXISTS "Business models service role only" ON business_models;

DROP POLICY IF EXISTS "service_role_prototypes" ON prototypes;
DROP POLICY IF EXISTS "service_role_competitor_research" ON competitor_research;

-- 2. Add correct, restrictive service-role only policies
CREATE POLICY "service_role_business_models" 
  ON business_models FOR ALL 
  USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_prototypes" 
  ON prototypes FOR ALL 
  USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_competitor_research" 
  ON competitor_research FOR ALL 
  USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');

-- 3. Add locked_at for state consistency to prevent race conditions during concurrent chat turns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
