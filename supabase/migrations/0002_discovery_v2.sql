-- Discovery Engine v2 schema additions
-- Run this against your Supabase project via dashboard SQL editor or CLI

-- Business model whiteboard (live JSON, updated each turn)
create table if not exists business_models (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade unique not null,
  model jsonb not null default '{}',
  completeness_score numeric default 0,
  updated_at timestamptz default now()
);

-- WhatsApp sandbox prototypes
create table if not exists prototypes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  bot_config jsonb not null default '{}',
  sandbox_url text,
  whatsapp_qr text,
  status text default 'provisioning' check (status in ('provisioning', 'live', 'expired')),
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Competitor research cache
create table if not exists competitor_research (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  competitor_name text not null,
  findings jsonb not null default '{}',
  researched_at timestamptz default now()
);

-- Extend sessions table with agent phase
alter table sessions
  add column if not exists agent_phase text default 'diagnostic'
    check (agent_phase in ('diagnostic', 'quantifying', 'competitor_xray', 'synthesis', 'sales', 'complete'));

-- RLS policies
alter table business_models enable row level security;
alter table prototypes enable row level security;
alter table competitor_research enable row level security;

-- Service role has full access (used server-side)
create policy "service_role_business_models" on business_models
  using (true) with check (true);

create policy "service_role_prototypes" on prototypes
  using (true) with check (true);

create policy "service_role_competitor_research" on competitor_research
  using (true) with check (true);

-- Index for fast session lookups
create index if not exists idx_business_models_session on business_models(session_id);
create index if not exists idx_prototypes_session on prototypes(session_id);
create index if not exists idx_competitor_research_session on competitor_research(session_id);
