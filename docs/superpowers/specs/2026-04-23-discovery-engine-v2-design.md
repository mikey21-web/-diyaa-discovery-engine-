# Discovery Engine v2 — Design Spec

**Date:** 2026-04-23
**Status:** Approved verbally by Uday — "build it rn"
**Approach:** Hybrid Diagnostic Loop + Sales Framework + Live Prototype + Competitor X-Ray

---

## 1. Problem

v1 uses hardcoded industry "illness scripts" in `lib/claude.ts`. Zero reasoning. Every real estate user gets the same ₹5L line. Founders see through it instantly. Conversion suffers.

## 2. Goal

Build a diagnostic AI that:
1. Actually reasons about the founder's specific business (no templates)
2. Calculates real revenue leak from their numbers
3. Sells them on WHY diyaa.ai matters with medium conviction
4. Converts to (A) agency call OR (B) SaaS signup OR (C) shareable report

## 3. Architecture

```
User → /chat UI
       ↓
   /api/chat (Next.js API)
       ↓
   AgentOrchestrator (lib/agent/orchestrator.ts)
       ├── State: BusinessModel (live JSON whiteboard)
       ├── Phase: diagnostic | competitor_xray | synthesis | sales | prototype
       ├── Tools:
       │     • calculator (leak math)
       │     • web_search (competitor x-ray via Firecrawl)
       │     • industry_data (curated JSON, NOT hardcoded templates)
       │     • prototype_builder (generates sandbox WhatsApp bot config)
       └── LLM: Claude Sonnet 4.6 (fast loops) + Opus 4.7 (final synthesis)
       ↓
   Supabase (sessions, business_models, prototypes, reports, leads)
       ↓
   Report page /report/[id]
       ├── Digital Twin visualization (Part of Phase 1)
       ├── Live Prototype link (Phase 2)
       ├── Competitor X-Ray card (Phase 2)
       └── Dual CTA: Book Call / Deploy Agent
```

## 4. Components

### 4.1 Agent Orchestrator (`lib/agent/orchestrator.ts`)
- Runs the hypothesize→probe→quantify loop
- Owns the `BusinessModel` JSON (live whiteboard)
- Decides which tool to call next
- Detects phase transitions based on model completeness, not turn count

### 4.2 Business Model State (`lib/agent/businessModel.ts`)
```ts
type BusinessModel = {
  identity: { name?, industry?, city?, team_size?, years? }
  revenue: { monthly_inr?, avg_ticket_inr?, confidence }
  workflow: { lead_source[], process_steps[], bottlenecks[] }
  leaks: Array<{
    description, frequency_per_week, cost_per_instance_inr,
    annual_leak_inr, confidence, source: 'stated' | 'calculated' | 'inferred'
  }>
  competitors: { names[], xray_findings[] }
  ai_readiness: { tools[], tech_comfort, budget_signal }
  hypotheses: Array<{ theory, evidence_for[], evidence_against[], status }>
  completeness_score: number // 0-100, gates phase transition
}
```

### 4.3 Tools (`lib/agent/tools/`)
- **calculator.ts** — leak math: `frequency × cost × 52` with confidence bands
- **webSearch.ts** — Firecrawl-backed competitor research
- **industryData.ts** — curated real data (not templates; structured facts per industry)
- **prototypeBuilder.ts** — emits Evolution API bot config JSON for sandbox deploy

### 4.4 Sales Framework (`lib/agent/salesPitch.ts`)
Structured template (plugged with real data, not templated strings):
1. Restatement of leak (their words + our numbers)
2. Urgency (competitor angle from x-ray)
3. Social proof (2-3 case studies matching their vertical)
4. Roadmap (3-stage: Quick Win → Backbone → Scale)
5. Dual CTA

### 4.5 Digital Twin Visualization (`components/Report/DigitalTwin.tsx`)
SVG flowchart, toggle "Today" / "90 days with AI":
- Today: workflow steps with red leak annotations (₹X/mo)
- Future: same workflow with AI agents inserted, green flow

### 4.6 Live Prototype (`components/Report/LivePrototype.tsx`)
- Report page shows "Try your Lead Responder AI now" CTA
- Click → spawns Evolution API sandbox instance configured from BusinessModel
- User messages a QR-code WhatsApp number → agent replies in THEIR voice
- "Deploy live" button → /api/platform/deploy

### 4.7 Competitor X-Ray (`components/Report/CompetitorXRay.tsx`)
- During conversation, agent asks "who are your top 2 competitors"
- Async web research runs in background (web_search tool)
- Findings injected into next conversation turn + report card

## 5. Data Flow

1. User opens `/chat`, session created in Supabase
2. Each user message → `/api/chat`
3. Orchestrator loads BusinessModel, runs one loop iteration:
   - LLM call with system prompt + tools + current model
   - LLM either: asks a question, calls a tool, or advances phase
   - Tool results update BusinessModel
   - Response streamed back
4. When `completeness_score >= 75` AND realization moment reached → sales phase
5. Sales phase generates final report JSON → stored in `reports` table
6. User redirected to `/report/[id]`
7. Report page renders: diagnosis + Digital Twin + Competitor X-Ray + Live Prototype + dual CTA
8. Lead captured on first CTA interaction

## 6. Database Changes

```sql
-- New table
create table business_models (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade unique,
  model jsonb not null default '{}',
  completeness_score numeric default 0,
  updated_at timestamptz default now()
);

create table prototypes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  bot_config jsonb not null,
  sandbox_url text,
  whatsapp_qr text,
  status text default 'provisioning', -- provisioning | live | expired
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Extend sessions
alter table sessions add column if not exists agent_phase text default 'diagnostic';
```

## 7. API Routes (changed)

- `POST /api/chat` — now calls AgentOrchestrator (replaces direct Groq call)
- `POST /api/prototype/provision` — spin up Evolution API sandbox from BusinessModel
- `GET /api/report/:id` — returns full report with Digital Twin data + prototype link + x-ray

## 8. LLM Strategy

- **Diagnostic loop turns:** Claude Sonnet 4.6 (fast, cheap, tool-use capable)
- **Final synthesis + sales pitch:** Claude Opus 4.7 with extended thinking (16k tokens)
- **Fallback:** Groq llama-3.3-70b if Anthropic rate-limited
- Prompt caching on system prompt (5 min TTL) — saves 90% tokens on repeat turns

## 9. Out of Scope (Phase 3)

- WhatsApp accountability coach
- Uday persona video drops
- "What everyone misses" counterintuitive insight
- Industry-specific rare data

## 10. Success Metrics

- Completion rate ≥ 60% (v1: unknown)
- Report-to-CTA click ≥ 35%
- CTA-to-lead capture ≥ 70%
- Agency call booking rate ≥ 8% of sessions
- SaaS signup rate ≥ 5% of sessions

## 11. Build Order (Phase 1 + 2)

1. DB migration (business_models, prototypes, sessions.agent_phase)
2. `BusinessModel` types + state management
3. Tool implementations (calculator first — no external deps)
4. AgentOrchestrator with Claude Sonnet + tool-use
5. Replace `/api/chat` internals
6. Report page data model update
7. Digital Twin SVG component
8. Web search tool + Competitor X-Ray component
9. Prototype builder + Evolution API integration
10. Live Prototype report component
11. Sales framework + Opus synthesis call
12. Dual CTA wiring to existing `/api/lead`
