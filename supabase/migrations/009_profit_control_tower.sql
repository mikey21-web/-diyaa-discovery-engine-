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

CREATE INDEX IF NOT EXISTS idx_business_events_session_time
  ON business_events(session_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_events_type
  ON business_events(event_type);

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

CREATE INDEX IF NOT EXISTS idx_action_runs_session_time
  ON action_runs(session_id, created_at DESC);

ALTER TABLE business_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_business_events ON business_events;
DROP POLICY IF EXISTS service_role_action_runs ON action_runs;

CREATE POLICY service_role_business_events ON business_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY service_role_action_runs ON action_runs
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

