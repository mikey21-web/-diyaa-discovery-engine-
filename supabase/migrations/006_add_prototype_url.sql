-- ========================================
-- diyaa.ai — Migration 006: Prototype + Competitor Columns
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times (IF NOT EXISTS).
-- ========================================

-- 1. Add prototype_html_url to reports for interactive report links
ALTER TABLE reports ADD COLUMN IF NOT EXISTS prototype_html_url TEXT;

-- 2. Add competitor_findings to sessions for storing live competitor data
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS competitor_findings JSONB DEFAULT '[]';

-- 3. Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_prototype_url ON reports(prototype_html_url) WHERE prototype_html_url IS NOT NULL;
