-- ========================================
-- diyaa.ai — Migration 008: Add Lead Constraints
-- Ensures one lead per session, prevents race condition duplicates
-- ========================================

-- Delete duplicate leads, keeping only the first (earliest created) per session
DELETE FROM leads WHERE id NOT IN (
  SELECT DISTINCT ON (session_id) id FROM leads ORDER BY session_id, created_at ASC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE leads ADD CONSTRAINT leads_session_id_unique_key UNIQUE (session_id);
