-- ========================================
-- diyaa.ai — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ========================================

-- Sessions table: stores discovery conversation state
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  status text default 'active' check (status in ('active', 'complete', 'report_generated')),
  phase int default 1,
  conversation_history jsonb default '[]',
  extracted_data jsonb,
  ai_readiness_score numeric,
  lead_captured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reports table: generated reports with share URLs
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  pdf_url text,
  share_url text,
  view_count int default 0,
  created_at timestamptz default now()
);

-- Leads table: captured lead data after session
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete set null,
  name text not null,
  email text,
  whatsapp text,
  industry text,

  city text,
  report_url text,
  status text default 'new' check (status in ('new', 'contacted', 'qualified', 'converted')),
  created_at timestamptz default now()
);

-- Background jobs table: retryable async side effects (webhooks, emails)
create table if not exists background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null,
  status text default 'pending' check (status in ('pending', 'processing', 'retry', 'done', 'failed')),
  attempts int default 0,
  next_run_at timestamptz default now(),
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_sessions_status on sessions(status);
create index if not exists idx_reports_session_id on reports(session_id);
create index if not exists idx_leads_session_id on leads(session_id);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_created_at on leads(created_at desc);
create index if not exists idx_jobs_status_next_run on background_jobs(status, next_run_at);

-- Enable RLS
alter table sessions enable row level security;
alter table reports enable row level security;
alter table leads enable row level security;
alter table background_jobs enable row level security;

-- Policies: sessions are publicly readable/writable (no auth in this app)
create policy "Sessions are publicly accessible"
  on sessions for all
  using (true)
  with check (true);

-- Reports: publicly readable
create policy "Reports are publicly readable"
  on reports for select
  using (true);

create policy "Reports are insertable by service role"
  on reports for insert
  with check (true);

create policy "Reports are updatable"
  on reports for update
  using (true);

-- Leads: insertable by anyone, readable only by service role (Admin)
create policy "Leads are insertable"
  on leads for insert
  with check (true);

create policy "Leads are readable by service role only"
  on leads for select
  using (auth.role() = 'service_role');

drop policy if exists "Background jobs service role only" on background_jobs;

create policy "Background jobs service role only"
  on background_jobs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ========================================
-- Schema Update 1: View Count Increment
-- ========================================

-- Add view_count to reports table if it doesn't exist
ALTER TABLE reports ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;

-- Add report_opened flag to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS report_opened BOOLEAN DEFAULT FALSE;

-- ========================================
-- Schema Update 2: Dedup Constraints & Atomic Increment
-- ========================================

-- C2: Prevent duplicate report rows per session
DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT reports_session_id_unique UNIQUE (session_id);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- C3: Prevent duplicate lead rows per session
DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_session_id_unique UNIQUE (session_id);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- C4: Atomic view_count increment function
CREATE OR REPLACE FUNCTION increment_view_count(p_session_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE reports
  SET view_count = view_count + 1,
      first_opened_at = COALESCE(first_opened_at, now()),
      last_opened_at = now()
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Schema Update 3: Monitoring Flags
-- ========================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_failed BOOLEAN DEFAULT FALSE;

-- ========================================
-- Schema Update 4: Harden RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Sessions are publicly accessible" ON sessions;
DROP POLICY IF EXISTS "Reports are insertable by service role" ON reports;
DROP POLICY IF EXISTS "Reports are updatable" ON reports;
DROP POLICY IF EXISTS "Leads are insertable" ON leads;

CREATE POLICY "Sessions service role only"
  ON sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Reports insert service role only"
  ON reports FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Reports update service role only"
  ON reports FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Leads insert service role only"
  ON leads FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ========================================
-- Schema Update 5: Agent v2 & Prototypes
-- ========================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS agent_phase TEXT DEFAULT 'diagnostic';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS competitor_findings JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS business_models (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid REFERENCES sessions(id) ON DELETE CASCADE,
  model        jsonb NOT NULL DEFAULT '{}',
  completeness_score int DEFAULT 0,
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT business_models_session_id_unique UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS prototypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  bot_config jsonb NOT NULL DEFAULT '{}',
  sandbox_url text,
  whatsapp_qr text,
  status text DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'live', 'expired')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  competitor_name text NOT NULL,
  findings jsonb NOT NULL DEFAULT '{}',
  researched_at timestamptz DEFAULT now()
);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS prototype_html_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_readiness_score NUMERIC;

CREATE INDEX IF NOT EXISTS idx_sessions_agent_phase ON sessions(agent_phase);
CREATE INDEX IF NOT EXISTS idx_business_models_session_id ON business_models(session_id);
CREATE INDEX IF NOT EXISTS idx_prototypes_session ON prototypes(session_id);
CREATE INDEX IF NOT EXISTS idx_competitor_research_session ON competitor_research(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_prototype_url ON reports(prototype_html_url) WHERE prototype_html_url IS NOT NULL;

ALTER TABLE business_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_research ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_business_models" ON business_models FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_prototypes" ON prototypes FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_competitor_research" ON competitor_research FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ========================================
-- Schema Update 6: Profit Control Tower
-- ========================================

CREATE TABLE IF NOT EXISTS business_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  entity_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  value numeric,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS action_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  action_id text NOT NULL,
  mode text NOT NULL DEFAULT 'preview',
  status text NOT NULL DEFAULT 'preview',
  expected_impact_inr numeric DEFAULT 0,
  attributable_revenue_inr numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_events_session_time ON business_events(session_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_runs_session_time ON action_runs(session_id, created_at DESC);

ALTER TABLE business_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_business_events" ON business_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_action_runs" ON action_runs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
