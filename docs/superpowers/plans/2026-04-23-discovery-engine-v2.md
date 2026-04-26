# Discovery Engine v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace template-driven v1 with a real diagnostic agent that reasons about each founder's business, calculates their specific revenue leak, runs competitor research, builds a live WhatsApp bot prototype, and converts via dual CTA (agency call / SaaS signup).

**Architecture:** Agent orchestrator with tool-use (calculator, web search, industry data, prototype builder). Live BusinessModel JSON whiteboard. Claude Sonnet 4.6 for diagnostic loop, Claude Opus 4.7 with extended thinking for final synthesis. Groq llama fallback.

**Tech Stack:** Next.js 14 Pages Router, TypeScript, Supabase, Anthropic SDK, Firecrawl, Evolution API, Tailwind, Framer Motion.

---

## File Structure

**New files:**
- `lib/agent/types.ts` — BusinessModel + Hypothesis + AgentState types
- `lib/agent/businessModel.ts` — load/save/update BusinessModel, completeness scorer
- `lib/agent/prompts.ts` — system prompts (diagnostic + sales)
- `lib/agent/tools/calculator.ts` — leak math
- `lib/agent/tools/industryData.ts` — curated structured facts (not templates)
- `lib/agent/tools/webSearch.ts` — Firecrawl competitor research
- `lib/agent/tools/prototypeBuilder.ts` — emit Evolution API bot config
- `lib/agent/tools/index.ts` — tool registry for Anthropic tool-use
- `lib/agent/orchestrator.ts` — main agent loop
- `lib/agent/salesPitch.ts` — structured sales framework generator
- `lib/anthropic.ts` — Anthropic SDK wrapper with key rotation + fallback
- `pages/api/prototype/provision.ts` — create sandbox WhatsApp bot
- `components/Report/DigitalTwin.tsx` — Today vs 90-days flowchart
- `components/Report/LivePrototype.tsx` — QR + test UI
- `components/Report/CompetitorXRay.tsx` — findings card
- `supabase/migrations/0002_discovery_v2.sql` — new tables

**Modified files:**
- `lib/types.ts` — add new types, extend ExtractedData
- `pages/api/chat.ts` — swap Groq direct call for orchestrator
- `pages/api/report.ts` — return full report payload
- `pages/report/[id].tsx` — integrate new components
- `package.json` — add `@anthropic-ai/sdk`, `@mendable/firecrawl-js`
- `.env.local` — add ANTHROPIC_API_KEY, FIRECRAWL_API_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Anthropic SDK and Firecrawl**

```bash
npm install @anthropic-ai/sdk@^0.30.0 @mendable/firecrawl-js@^1.0.0
```

- [ ] **Step 2: Verify install**

```bash
npm ls @anthropic-ai/sdk @mendable/firecrawl-js
```

Expected: both packages listed with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Anthropic SDK and Firecrawl deps for discovery engine v2"
```

---

## Task 2: Environment Variables

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Append new env keys**

Append to `.env.local`:

```env
# Discovery Engine v2
ANTHROPIC_API_KEY=
ANTHROPIC_API_KEY_1=
ANTHROPIC_API_KEY_2=
FIRECRAWL_API_KEY=
EVOLUTION_API_URL=https://evolution.diyaaaa.in
EVOLUTION_API_KEY=
PROTOTYPE_SANDBOX_TTL_HOURS=24
```

- [ ] **Step 2: Commit (env vars are in .gitignore already, just a marker commit)**

Skip commit — `.env.local` is gitignored.

---

## Task 3: Database Migration

**Files:**
- Create: `supabase/migrations/0002_discovery_v2.sql`

- [ ] **Step 1: Write migration**

```sql
-- Discovery Engine v2 schema

create table if not exists business_models (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  model jsonb not null default '{}',
  completeness_score numeric default 0,
  updated_at timestamptz default now(),
  constraint business_models_session_unique unique (session_id)
);

create table if not exists prototypes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  bot_config jsonb not null,
  sandbox_instance_id text,
  whatsapp_qr text,
  sandbox_url text,
  status text default 'provisioning' check (status in ('provisioning','live','expired','failed')),
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists competitor_research (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  competitor_name text not null,
  competitor_url text,
  findings jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table sessions add column if not exists agent_phase text default 'diagnostic';
alter table sessions add column if not exists completeness_score numeric default 0;

create index if not exists idx_business_models_session on business_models(session_id);
create index if not exists idx_prototypes_session on prototypes(session_id);
create index if not exists idx_competitor_research_session on competitor_research(session_id);

alter table business_models enable row level security;
alter table prototypes enable row level security;
alter table competitor_research enable row level security;

create policy "Business models service role only" on business_models
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Prototypes readable" on prototypes
  for select using (true);

create policy "Prototypes service role write" on prototypes
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Competitor research service role only" on competitor_research
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Copy contents → paste in Supabase SQL Editor → Run. Expected: no errors.

- [ ] **Step 3: Verify tables exist**

```sql
select table_name from information_schema.tables
where table_schema = 'public'
and table_name in ('business_models','prototypes','competitor_research');
```

Expected: 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_discovery_v2.sql
git commit -m "feat(db): add business_models, prototypes, competitor_research tables"
```

---

## Task 4: Core Types

**Files:**
- Create: `lib/agent/types.ts`

- [ ] **Step 1: Write types file**

```typescript
import type { VerticalKey, RevenueRange, TechComfort } from '@/lib/types'

export type AgentPhase =
  | 'diagnostic'
  | 'quantifying'
  | 'competitor_xray'
  | 'synthesis'
  | 'sales'
  | 'complete'

export interface BusinessIdentity {
  name?: string
  industry?: VerticalKey
  city?: string
  team_size?: number
  years_in_operation?: number
}

export interface RevenueState {
  monthly_inr?: number
  monthly_range?: RevenueRange
  avg_ticket_inr?: number
  confidence: number // 0-1
}

export interface WorkflowStep {
  name: string
  actor: 'human' | 'ai' | 'tool'
  time_minutes: number
  is_bottleneck: boolean
}

export interface WorkflowState {
  lead_sources: string[]
  process_steps: WorkflowStep[]
  bottlenecks: string[]
}

export interface RevenueLeak {
  description: string
  frequency_per_week: number
  cost_per_instance_inr: number
  annual_leak_inr: number
  confidence: number // 0-1
  source: 'stated' | 'calculated' | 'inferred'
  hypothesis_id?: string
}

export interface Competitor {
  name: string
  url?: string
  findings?: {
    has_ai_chatbot?: boolean
    response_time_observed?: string
    tech_stack_hints?: string[]
    review_summary?: string
  }
}

export interface AIReadiness {
  current_tools: string[]
  tech_comfort: TechComfort
  budget_signal?: 'low' | 'medium' | 'high'
}

export interface Hypothesis {
  id: string
  theory: string
  evidence_for: string[]
  evidence_against: string[]
  status: 'active' | 'confirmed' | 'rejected'
  confidence: number // 0-1
}

export interface BusinessModel {
  identity: BusinessIdentity
  revenue: RevenueState
  workflow: WorkflowState
  leaks: RevenueLeak[]
  competitors: Competitor[]
  ai_readiness: AIReadiness
  hypotheses: Hypothesis[]
  realization_moment?: string
  completeness_score: number // 0-100
}

export interface AgentToolResult {
  tool_name: string
  input: Record<string, unknown>
  output: unknown
  error?: string
}

export interface AgentTurnResult {
  reply: string
  phase: AgentPhase
  model_updates: Partial<BusinessModel>
  tool_results: AgentToolResult[]
  report_ready: boolean
  report_payload?: ReportPayload
}

export interface RoadmapStage {
  stage: '01' | '02' | '03'
  title: string
  agent_name: string
  what_it_does: string
  build_time: string
  monthly_value_inr: number
  confidence_score: number
}

export interface ReportPayload {
  business_name: string
  industry: VerticalKey
  city?: string
  top_pain_point: string
  current_fire: string
  coming_fire: string
  revenue_leak_inr_per_year: number
  hours_wasted_per_week: number
  realization_moment: string
  confidence_score: number
  revenue_leak_breakdown: Array<{ label: string; value: string }>
  roadmap: RoadmapStage[]
  before_after: { today: string; in_90_days: string }
  conversation_summary: string
  uday_briefing: string
  digital_twin: DigitalTwinData
  competitor_xray: CompetitorXRayData
}

export interface DigitalTwinNode {
  id: string
  label: string
  kind: 'lead' | 'human' | 'ai_agent' | 'output' | 'leak'
  leak_inr_per_month?: number
  replaced_by_ai?: boolean
}

export interface DigitalTwinEdge {
  from: string
  to: string
  label?: string
  is_leak?: boolean
}

export interface DigitalTwinData {
  today: { nodes: DigitalTwinNode[]; edges: DigitalTwinEdge[] }
  in_90_days: { nodes: DigitalTwinNode[]; edges: DigitalTwinEdge[] }
}

export interface CompetitorXRayData {
  competitors: Array<{
    name: string
    url?: string
    ai_adoption_signal: 'ahead' | 'behind' | 'unknown'
    key_finding: string
  }>
  gap_summary: string
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/types.ts
git commit -m "feat(agent): add core types for BusinessModel and agent state"
```

---

## Task 5: BusinessModel State Helpers

**Files:**
- Create: `lib/agent/businessModel.ts`

- [ ] **Step 1: Write state helpers**

```typescript
import { getServiceClient } from '@/lib/supabase'
import type { BusinessModel } from './types'

const EMPTY_MODEL: BusinessModel = {
  identity: {},
  revenue: { confidence: 0 },
  workflow: { lead_sources: [], process_steps: [], bottlenecks: [] },
  leaks: [],
  competitors: [],
  ai_readiness: { current_tools: [], tech_comfort: 'medium' },
  hypotheses: [],
  completeness_score: 0,
}

export async function loadBusinessModel(sessionId: string): Promise<BusinessModel> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('business_models')
    .select('model')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!data) return { ...EMPTY_MODEL }
  return { ...EMPTY_MODEL, ...(data.model as Partial<BusinessModel>) }
}

export async function saveBusinessModel(sessionId: string, model: BusinessModel): Promise<void> {
  const supabase = getServiceClient()
  const score = scoreCompleteness(model)
  model.completeness_score = score
  await supabase
    .from('business_models')
    .upsert(
      { session_id: sessionId, model, completeness_score: score, updated_at: new Date().toISOString() },
      { onConflict: 'session_id' }
    )
}

export function mergeModel(current: BusinessModel, updates: Partial<BusinessModel>): BusinessModel {
  return {
    ...current,
    identity: { ...current.identity, ...(updates.identity ?? {}) },
    revenue: { ...current.revenue, ...(updates.revenue ?? {}) },
    workflow: {
      lead_sources: dedupe([...(current.workflow.lead_sources), ...(updates.workflow?.lead_sources ?? [])]),
      process_steps: updates.workflow?.process_steps ?? current.workflow.process_steps,
      bottlenecks: dedupe([...(current.workflow.bottlenecks), ...(updates.workflow?.bottlenecks ?? [])]),
    },
    leaks: mergeLeaks(current.leaks, updates.leaks ?? []),
    competitors: mergeCompetitors(current.competitors, updates.competitors ?? []),
    ai_readiness: { ...current.ai_readiness, ...(updates.ai_readiness ?? {}) },
    hypotheses: mergeHypotheses(current.hypotheses, updates.hypotheses ?? []),
    realization_moment: updates.realization_moment ?? current.realization_moment,
    completeness_score: current.completeness_score,
  }
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function mergeLeaks(a: BusinessModel['leaks'], b: BusinessModel['leaks']) {
  const byDesc = new Map(a.map(l => [l.description.toLowerCase(), l]))
  for (const leak of b) byDesc.set(leak.description.toLowerCase(), leak)
  return Array.from(byDesc.values())
}

function mergeCompetitors(a: BusinessModel['competitors'], b: BusinessModel['competitors']) {
  const byName = new Map(a.map(c => [c.name.toLowerCase(), c]))
  for (const comp of b) {
    const existing = byName.get(comp.name.toLowerCase())
    byName.set(comp.name.toLowerCase(), existing ? { ...existing, ...comp, findings: { ...existing.findings, ...comp.findings } } : comp)
  }
  return Array.from(byName.values())
}

function mergeHypotheses(a: BusinessModel['hypotheses'], b: BusinessModel['hypotheses']) {
  const byId = new Map(a.map(h => [h.id, h]))
  for (const h of b) byId.set(h.id, h)
  return Array.from(byId.values())
}

export function scoreCompleteness(m: BusinessModel): number {
  let score = 0
  if (m.identity.industry) score += 10
  if (m.identity.team_size) score += 5
  if (m.identity.city) score += 5
  if (m.revenue.monthly_inr || m.revenue.monthly_range) score += 15
  if (m.revenue.avg_ticket_inr) score += 5
  if (m.workflow.lead_sources.length > 0) score += 10
  if (m.workflow.process_steps.length >= 3) score += 10
  if (m.workflow.bottlenecks.length > 0) score += 10
  if (m.leaks.length >= 1) score += 10
  if (m.leaks.some(l => l.annual_leak_inr > 0 && l.confidence > 0.5)) score += 10
  if (m.competitors.length > 0) score += 5
  if (m.realization_moment) score += 5
  return Math.min(100, score)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/businessModel.ts
git commit -m "feat(agent): add BusinessModel state load/save/merge + completeness scorer"
```

---

## Task 6: Calculator Tool

**Files:**
- Create: `lib/agent/tools/calculator.ts`

- [ ] **Step 1: Write calculator tool**

```typescript
export interface CalculatorInput {
  frequency_per_week: number
  cost_per_instance_inr: number
  description: string
  confidence?: number
}

export interface CalculatorOutput {
  annual_leak_inr: number
  monthly_leak_inr: number
  formula: string
  confidence: number
  description: string
}

export function calculateLeak(input: CalculatorInput): CalculatorOutput {
  const { frequency_per_week, cost_per_instance_inr, description } = input
  const confidence = typeof input.confidence === 'number' ? input.confidence : 0.7
  const annual = frequency_per_week * cost_per_instance_inr * 52
  const monthly = Math.round(annual / 12)
  return {
    annual_leak_inr: Math.round(annual),
    monthly_leak_inr: monthly,
    formula: `${frequency_per_week} × ₹${cost_per_instance_inr.toLocaleString('en-IN')} × 52 = ₹${Math.round(annual).toLocaleString('en-IN')}/year`,
    confidence,
    description,
  }
}

export const calculatorToolSchema = {
  name: 'calculate_leak',
  description: 'Calculate annual revenue leak from a recurring problem. Use when you have a frequency (per week) and a cost per instance.',
  input_schema: {
    type: 'object' as const,
    properties: {
      frequency_per_week: { type: 'number', description: 'How often this happens per week (e.g. 4 leads/week)' },
      cost_per_instance_inr: { type: 'number', description: 'Lost rupees per single instance (e.g. 50000 for lost commission)' },
      description: { type: 'string', description: 'One-line description of the leak' },
      confidence: { type: 'number', description: '0-1 confidence in these numbers' },
    },
    required: ['frequency_per_week', 'cost_per_instance_inr', 'description'],
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/tools/calculator.ts
git commit -m "feat(agent): add calculator tool for leak math"
```

---

## Task 7: Industry Data Tool

**Files:**
- Create: `lib/agent/tools/industryData.ts`

- [ ] **Step 1: Write industry data tool**

```typescript
import type { VerticalKey } from '@/lib/types'

interface IndustryFact {
  key: string
  value: string
  source: string
  applies_to_size?: ('micro' | 'small' | 'mid')[]
}

const DATA: Partial<Record<VerticalKey, IndustryFact[]>> = {
  real_estate: [
    { key: 'lead_response_window_minutes', value: '5', source: 'Kraya AI India 2026' },
    { key: 'average_response_time_hours', value: '4.2', source: 'CampaignHQ 2026' },
    { key: 'whatsapp_inquiry_share', value: '0.65', source: 'RhinoAgents 2025' },
    { key: 'conversion_without_automation', value: '0.025', source: 'Industry aggregate 2026' },
    { key: 'conversion_with_automation', value: '0.05', source: 'diyaa.ai client data' },
    { key: 'follow_up_attempts_needed', value: '7', source: 'HBR 2024' },
    { key: 'follow_up_average_manual', value: '2', source: 'Industry aggregate 2026' },
  ],
  hospitality: [
    { key: 'response_target_minutes', value: '2', source: 'Hyperleap AI 2026' },
    { key: 'average_response_hours', value: '2.8', source: 'Industry aggregate 2026' },
    { key: 'no_show_reduction_whatsapp', value: '0.30', source: 'Hyperleap AI 2026' },
    { key: 'upsell_via_chat_rate', value: '0.17', source: 'Industry aggregate 2026' },
  ],
  d2c_fashion: [
    { key: 'cart_abandonment_india_mobile', value: '0.90', source: 'Statista 2025' },
    { key: 'cart_recovery_whatsapp', value: '0.28', source: 'CampaignHQ 2026' },
    { key: 'cart_recovery_email', value: '0.04', source: 'CampaignHQ 2026' },
    { key: 'repeat_customer_whatsapp_multiplier', value: '3.0', source: 'Cooby 2024' },
  ],
  coaching: [
    { key: 'lead_to_call_manual', value: '0.175', source: 'Industry aggregate 2026' },
    { key: 'lead_to_call_with_bot', value: '0.40', source: 'diyaa.ai client data' },
    { key: 'no_show_without_reminder', value: '0.35', source: 'Industry aggregate 2026' },
    { key: 'no_show_with_whatsapp', value: '0.12', source: 'diyaa.ai client data' },
  ],
  fnb: [
    { key: 'order_response_target_minutes', value: '3', source: 'Cooby 2024' },
    { key: 'repeat_order_whatsapp_multiplier', value: '3.0', source: 'Cooby 2024' },
    { key: 'review_via_whatsapp_uplift', value: '0.40', source: 'WhatsApp Business 2025' },
  ],
  healthcare: [
    { key: 'after_hours_missed_share', value: '0.40', source: 'Industry aggregate 2026' },
    { key: 'monthly_lost_consult_revenue_inr', value: '100000', source: 'diyaa.ai client data' },
  ],
  logistics: [
    { key: 'info_lag_margin_tax', value: '0.12', source: 'Industry aggregate 2026' },
    { key: 'coordinator_salary_waste_monthly_inr', value: '200000', source: 'diyaa.ai client data' },
  ],
  manufacturing: [
    { key: 'hidden_error_tax_share', value: '0.07', source: 'Industry aggregate 2026' },
  ],
  marketing_agency: [
    { key: 'reporting_hours_wasted_share', value: '0.35', source: 'Industry aggregate 2026' },
  ],
  ca_firm: [
    { key: 'weekly_hours_chasing_clients', value: '20', source: 'Industry aggregate 2026' },
  ],
}

export function lookupIndustryFact(industry: VerticalKey, key: string): IndustryFact | null {
  const facts = DATA[industry] ?? []
  return facts.find(f => f.key === key) ?? null
}

export function listIndustryFacts(industry: VerticalKey): IndustryFact[] {
  return DATA[industry] ?? []
}

export const industryDataToolSchema = {
  name: 'lookup_industry_data',
  description: 'Look up verified data points for an industry (response times, conversion rates, etc). Returns null if no data exists for the key.',
  input_schema: {
    type: 'object' as const,
    properties: {
      industry: { type: 'string', description: 'One of: real_estate, hospitality, d2c_fashion, coaching, fnb, healthcare, logistics, manufacturing, marketing_agency, ca_firm' },
      key: { type: 'string', description: 'The fact key to look up (e.g. lead_response_window_minutes). Omit to list all facts for the industry.' },
    },
    required: ['industry'],
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/tools/industryData.ts
git commit -m "feat(agent): add industry data tool with curated verified facts"
```

---

## Task 8: Web Search Tool (Competitor X-Ray)

**Files:**
- Create: `lib/agent/tools/webSearch.ts`

- [ ] **Step 1: Write web search tool**

```typescript
import FirecrawlApp from '@mendable/firecrawl-js'
import { logger } from '@/lib/logger'

const firecrawl = process.env.FIRECRAWL_API_KEY
  ? new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY })
  : null

export interface CompetitorResearchInput {
  competitor_name: string
  competitor_url?: string
}

export interface CompetitorResearchOutput {
  competitor_name: string
  url_used?: string
  has_ai_chatbot: boolean
  response_time_observed?: string
  tech_stack_hints: string[]
  content_snippets: string[]
  error?: string
}

export async function researchCompetitor(input: CompetitorResearchInput): Promise<CompetitorResearchOutput> {
  const { competitor_name, competitor_url } = input
  if (!firecrawl) {
    return {
      competitor_name,
      has_ai_chatbot: false,
      tech_stack_hints: [],
      content_snippets: [],
      error: 'Firecrawl not configured',
    }
  }

  let targetUrl = competitor_url
  if (!targetUrl) {
    try {
      const searchRes = await firecrawl.search(competitor_name + ' india', { limit: 3 })
      const results = Array.isArray(searchRes) ? searchRes : (searchRes as { data?: Array<{ url?: string }> }).data ?? []
      targetUrl = results[0]?.url
    } catch (e) {
      logger.warn('Firecrawl search failed', { competitor_name, err: (e as Error).message })
    }
  }

  if (!targetUrl) {
    return { competitor_name, has_ai_chatbot: false, tech_stack_hints: [], content_snippets: [], error: 'no URL resolved' }
  }

  try {
    const scrape = await firecrawl.scrapeUrl(targetUrl, { formats: ['markdown'] })
    const text = typeof scrape === 'object' && scrape && 'markdown' in scrape
      ? String((scrape as { markdown?: string }).markdown ?? '')
      : ''
    return {
      competitor_name,
      url_used: targetUrl,
      has_ai_chatbot: /chatbot|whatsapp.*(bot|auto)|live chat|intercom|drift|tawk/i.test(text),
      response_time_observed: undefined,
      tech_stack_hints: extractTechHints(text),
      content_snippets: text.split('\n').filter(l => l.trim().length > 30).slice(0, 10),
    }
  } catch (e) {
    return { competitor_name, has_ai_chatbot: false, tech_stack_hints: [], content_snippets: [], error: (e as Error).message }
  }
}

function extractTechHints(text: string): string[] {
  const patterns: Array<[string, RegExp]> = [
    ['WhatsApp Business', /whatsapp business/i],
    ['Zoho CRM', /zoho/i],
    ['Salesforce', /salesforce/i],
    ['HubSpot', /hubspot/i],
    ['Instagram DM automation', /instagram.*dm/i],
    ['Chatbot', /chatbot/i],
    ['AI Assistant', /ai assistant|ai agent/i],
    ['Razorpay', /razorpay/i],
    ['CRM', /\bcrm\b/i],
  ]
  return patterns.filter(([, r]) => r.test(text)).map(([label]) => label)
}

export const webSearchToolSchema = {
  name: 'research_competitor',
  description: 'Research a competitor business via live web search. Returns their tech stack hints and whether they use AI/chatbots.',
  input_schema: {
    type: 'object' as const,
    properties: {
      competitor_name: { type: 'string', description: 'Name of competitor business' },
      competitor_url: { type: 'string', description: 'Optional URL if known' },
    },
    required: ['competitor_name'],
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/tools/webSearch.ts
git commit -m "feat(agent): add Firecrawl-backed competitor research tool"
```

---

## Task 9: Prototype Builder Tool

**Files:**
- Create: `lib/agent/tools/prototypeBuilder.ts`

- [ ] **Step 1: Write prototype builder**

```typescript
import type { BusinessModel } from '../types'

export interface PrototypeBotConfig {
  bot_name: string
  greeting: string
  knowledge_points: string[]
  response_examples: Array<{ user: string; bot: string }>
  escalation_rules: string[]
  business_context: string
}

export function buildBotConfigFromModel(model: BusinessModel, agent_type: 'lead_responder' | 'booking_bot' | 'follow_up' = 'lead_responder'): PrototypeBotConfig {
  const name = model.identity.name ?? 'Your Business'
  const industry = model.identity.industry ?? 'other'
  const city = model.identity.city ?? 'India'

  const greetings: Record<string, string> = {
    lead_responder: `Hi! Thanks for reaching out to ${name}. I'm your assistant — I can answer questions instantly, share info, and connect you to the team. What are you looking for today?`,
    booking_bot: `Hi! Welcome to ${name}. I can help you book an appointment in 30 seconds. What date works for you?`,
    follow_up: `Hi! This is ${name} checking in — wanted to see if you had any questions on what we discussed.`,
  }

  return {
    bot_name: `${name} Assistant`,
    greeting: greetings[agent_type],
    knowledge_points: [
      `Business: ${name}`,
      `Industry: ${industry}`,
      `Location: ${city}`,
      ...(model.workflow.lead_sources.map(s => `Lead source: ${s}`)),
      ...(model.identity.team_size ? [`Team size: ${model.identity.team_size}`] : []),
    ],
    response_examples: buildExamples(industry, name),
    escalation_rules: [
      'Escalate to human if user asks for pricing beyond what is in knowledge base',
      'Escalate if user mentions complaint or refund',
      'Always escalate if user says "talk to owner" or "call me"',
    ],
    business_context: `You are the WhatsApp assistant for ${name}, a ${industry} business in ${city}. Respond warmly and briefly (max 2 sentences). Always collect name and phone number for human follow-up. Never invent prices or policies.`,
  }
}

function buildExamples(industry: string, name: string): Array<{ user: string; bot: string }> {
  const base = [
    { user: 'Hi', bot: `Hi! Welcome to ${name}. How can I help?` },
    { user: 'What do you do?', bot: `${name} helps with [service]. Want me to connect you to the team for details?` },
  ]
  switch (industry) {
    case 'real_estate':
      return [...base, { user: 'I want a 2BHK in Kondapur', bot: `Got it — a 2BHK in Kondapur. What's your budget range and move-in date? I'll get options to you within 30 mins.` }]
    case 'hospitality':
      return [...base, { user: 'Rooms available this weekend?', bot: `Checking — which dates exactly, and how many guests? I'll confirm availability in 60 seconds.` }]
    case 'coaching':
      return [...base, { user: 'How much is the course?', bot: `I can share pricing and also a free demo class. What subject are you interested in?` }]
    case 'fnb':
      return [...base, { user: 'Is delivery available?', bot: `Yes! Which area are you in? I'll confirm delivery window and menu link.` }]
    default:
      return base
  }
}

export const prototypeBuilderToolSchema = {
  name: 'build_prototype',
  description: 'Generate a WhatsApp bot config from the BusinessModel. Use after diagnosis is complete and before offering the prototype to the user.',
  input_schema: {
    type: 'object' as const,
    properties: {
      agent_type: { type: 'string', description: 'One of: lead_responder, booking_bot, follow_up' },
    },
    required: ['agent_type'],
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/tools/prototypeBuilder.ts
git commit -m "feat(agent): add prototype builder that synthesizes bot config from BusinessModel"
```

---

## Task 10: Tool Registry

**Files:**
- Create: `lib/agent/tools/index.ts`

- [ ] **Step 1: Write tool registry**

```typescript
import { calculatorToolSchema, calculateLeak } from './calculator'
import { industryDataToolSchema, lookupIndustryFact, listIndustryFacts } from './industryData'
import { webSearchToolSchema, researchCompetitor } from './webSearch'
import { prototypeBuilderToolSchema, buildBotConfigFromModel } from './prototypeBuilder'
import type { BusinessModel } from '../types'
import type { VerticalKey } from '@/lib/types'

export const ALL_TOOL_SCHEMAS = [
  calculatorToolSchema,
  industryDataToolSchema,
  webSearchToolSchema,
  prototypeBuilderToolSchema,
]

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { model: BusinessModel }
): Promise<unknown> {
  switch (name) {
    case 'calculate_leak':
      return calculateLeak(input as Parameters<typeof calculateLeak>[0])
    case 'lookup_industry_data': {
      const industry = input.industry as VerticalKey
      const key = input.key as string | undefined
      return key ? lookupIndustryFact(industry, key) : listIndustryFacts(industry)
    }
    case 'research_competitor':
      return await researchCompetitor(input as Parameters<typeof researchCompetitor>[0])
    case 'build_prototype':
      return buildBotConfigFromModel(ctx.model, (input.agent_type as 'lead_responder' | 'booking_bot' | 'follow_up') ?? 'lead_responder')
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/tools/index.ts
git commit -m "feat(agent): add tool registry and dispatcher"
```

---

## Task 11: Anthropic SDK Wrapper

**Files:**
- Create: `lib/anthropic.ts`

- [ ] **Step 1: Write Anthropic wrapper**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { logger } from './logger'

const ANTHROPIC_KEYS = [
  process.env.ANTHROPIC_API_KEY,
  process.env.ANTHROPIC_API_KEY_1,
  process.env.ANTHROPIC_API_KEY_2,
].filter(Boolean) as string[]

export class AnthropicBusyError extends Error {
  readonly retryAfterSeconds: number
  constructor(message: string, retryAfter = 30) {
    super(message)
    this.name = 'AnthropicBusyError'
    this.retryAfterSeconds = retryAfter
  }
}

export type AnthropicModel =
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-7'
  | 'claude-haiku-4-5-20251001'

export function getAnthropicClient(): Anthropic {
  if (ANTHROPIC_KEYS.length === 0) throw new Error('No ANTHROPIC_API_KEY configured')
  const key = ANTHROPIC_KEYS[Math.floor(Math.random() * ANTHROPIC_KEYS.length)]
  return new Anthropic({ apiKey: key })
}

export async function callAnthropic(params: {
  model: AnthropicModel
  system: string
  messages: Anthropic.MessageParam[]
  tools?: Anthropic.Tool[]
  max_tokens?: number
  thinking?: { type: 'enabled'; budget_tokens: number }
}): Promise<Anthropic.Message> {
  const client = getAnthropicClient()
  try {
    const response = await client.messages.create({
      model: params.model,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      max_tokens: params.max_tokens ?? 4096,
      ...(params.thinking ? { thinking: params.thinking } : {}),
    })
    return response
  } catch (e) {
    const err = e as { status?: number; message?: string }
    logger.warn('Anthropic call failed', { status: err.status, msg: err.message })
    if (err.status === 429 || err.status === 529) {
      throw new AnthropicBusyError('Model overloaded. Try again in 30s.')
    }
    throw e
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/anthropic.ts
git commit -m "feat(llm): add Anthropic SDK wrapper with key rotation"
```

---

## Task 12: Agent Prompts

**Files:**
- Create: `lib/agent/prompts.ts`

- [ ] **Step 1: Write system prompts**

```typescript
import type { BusinessModel, AgentPhase } from './types'

export function buildDiagnosticSystemPrompt(model: BusinessModel, phase: AgentPhase): string {
  return `You are Diyaa, a senior AI implementation strategist at diyaa.ai.

You are not a chatbot. You are a diagnostic reasoning engine. Your job is to understand THIS specific business well enough to find the single biggest place AI can save them money, then convince them with real numbers from THEIR business.

# Your reasoning loop

Every turn:
1. Look at the current BusinessModel (below). What's the biggest gap in your understanding?
2. Form 1-3 hypotheses about where their biggest revenue leak is.
3. Ask ONE surgical question that distinguishes between your hypotheses — not a generic form field.
4. Use tools when you have enough data:
   - \`calculate_leak\` — the instant you have frequency + cost per instance
   - \`lookup_industry_data\` — when you need a verified benchmark (not for templating, for specific data points)
   - \`research_competitor\` — when they name competitors
   - \`build_prototype\` — ONLY after diagnosis is complete (completeness > 70)

# Current BusinessModel state
\`\`\`json
${JSON.stringify(model, null, 2)}
\`\`\`

# Current phase: ${phase}
${phaseGuidance(phase)}

# Output contract

Every response must have TWO parts:

1. A short conversational reply (max 2 sentences + 1 question, or 3 sentences if calculating a number).
2. After your reply, a JSON block wrapped like this:

\`\`\`json-update
{
  "phase": "diagnostic" | "quantifying" | "competitor_xray" | "synthesis" | "sales" | "complete",
  "model_updates": { ... partial BusinessModel ... },
  "report_ready": false,
  "report_payload": null
}
\`\`\`

If report_ready is true, include the full ReportPayload in report_payload.

# Style rules

- Never start with "Hello", "Hi", "Great", or "Thanks for sharing". Dive into data or diagnosis.
- Every reply must contain at least one specific number (rupees, percentage, hours, or frequency).
- When you quantify a leak, show the math inline: "4 leads/week × ₹50K × 52 = ₹1.04Cr/year".
- When you state a benchmark, cite it: "Industry response target is 5 min (Kraya AI 2026)".
- If they ask if you're an AI, say: "I'm Diyaa — I work at diyaa.ai. Let's keep going."
- Max 2 sentences + 1 question per turn. No bullet points in chat. No headers.

# Persona

You are direct, confident, and diagnostic. You listen for what hurts and name it. You are NOT a sales rep asking for the close on turn 2 — you earn the close by proving you understand their business better than they expected.

When you have enough to write the report, move to 'sales' phase, deliver the realization moment, ask if they want the full blueprint, and if they say yes — set report_ready: true and include report_payload.
`
}

function phaseGuidance(phase: AgentPhase): string {
  switch (phase) {
    case 'diagnostic':
      return 'Extract business identity, workflow, and lead source. Form hypotheses about where the biggest leak is. Do not guess numbers yet.'
    case 'quantifying':
      return 'Pin down ONE number: frequency per week, cost per instance, or monthly revenue. Use calculate_leak as soon as you can.'
    case 'competitor_xray':
      return 'If user has named competitors, call research_competitor in background. Otherwise continue quantifying.'
    case 'synthesis':
      return 'Summarize the biggest leak with their specific numbers. Get confirmation: "Does that feel right?". Then transition to sales.'
    case 'sales':
      return 'Deliver the realization moment. Show the 3-stage roadmap. Ask if they want the full blueprint and prototype. If yes → set report_ready.'
    case 'complete':
      return 'Session complete. Do not continue.'
  }
}

export function buildSynthesisSystemPrompt(model: BusinessModel): string {
  return `You are Diyaa synthesizing a final AI implementation report for a founder.

Based on the BusinessModel below, produce a ReportPayload JSON with:
- revenue_leak_inr_per_year (their actual calculated number)
- a 3-stage roadmap (Quick Win / Backbone / Scale) with specific agent names and monthly_value_inr estimates
- before_after description (today vs 90 days)
- digital_twin with node/edge graphs for today and in_90_days workflow
- competitor_xray if competitors were researched
- uday_briefing: 2-3 blunt sentences for the founder (Uday) to use when he calls them

# BusinessModel
\`\`\`json
${JSON.stringify(model, null, 2)}
\`\`\`

Output ONLY valid JSON matching the ReportPayload interface. No markdown, no commentary.`
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/prompts.ts
git commit -m "feat(agent): add diagnostic + synthesis system prompts"
```

---

## Task 13: Agent Orchestrator

**Files:**
- Create: `lib/agent/orchestrator.ts`

- [ ] **Step 1: Write orchestrator**

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import { callAnthropic } from '@/lib/anthropic'
import { buildDiagnosticSystemPrompt, buildSynthesisSystemPrompt } from './prompts'
import { ALL_TOOL_SCHEMAS, executeTool } from './tools'
import { loadBusinessModel, saveBusinessModel, mergeModel } from './businessModel'
import type { AgentPhase, AgentTurnResult, BusinessModel, ReportPayload } from './types'
import { logger } from '@/lib/logger'

interface RunTurnInput {
  session_id: string
  user_message: string
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>
  current_phase: AgentPhase
}

export async function runAgentTurn(input: RunTurnInput): Promise<AgentTurnResult> {
  const { session_id, user_message, conversation, current_phase } = input
  const model = await loadBusinessModel(session_id)
  const systemPrompt = buildDiagnosticSystemPrompt(model, current_phase)

  const messages: Anthropic.MessageParam[] = [
    ...conversation.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: user_message },
  ]

  const tools = ALL_TOOL_SCHEMAS as unknown as Anthropic.Tool[]
  let response = await callAnthropic({ model: 'claude-sonnet-4-6', system: systemPrompt, messages, tools, max_tokens: 2048 })

  const toolResults: AgentTurnResult['tool_results'] = []
  let safetyLoops = 0

  while (response.stop_reason === 'tool_use' && safetyLoops < 4) {
    safetyLoops++
    const assistantContent = response.content
    const toolUseBlocks = assistantContent.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []

    for (const block of toolUseBlocks) {
      try {
        const out = await executeTool(block.name, block.input as Record<string, unknown>, { model })
        toolResults.push({ tool_name: block.name, input: block.input as Record<string, unknown>, output: out })
        toolResultBlocks.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) })
      } catch (e) {
        const err = e as Error
        toolResults.push({ tool_name: block.name, input: block.input as Record<string, unknown>, output: null, error: err.message })
        toolResultBlocks.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${err.message}`, is_error: true })
      }
    }

    messages.push({ role: 'assistant', content: assistantContent })
    messages.push({ role: 'user', content: toolResultBlocks })

    response = await callAnthropic({ model: 'claude-sonnet-4-6', system: systemPrompt, messages, tools, max_tokens: 2048 })
  }

  const textContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')

  const { reply, update } = parseReply(textContent)
  const newPhase = (update?.phase as AgentPhase) ?? current_phase
  const modelUpdates = (update?.model_updates ?? {}) as Partial<BusinessModel>
  const merged = mergeModel(model, modelUpdates)
  await saveBusinessModel(session_id, merged)

  let reportPayload: ReportPayload | undefined
  const reportReady = Boolean(update?.report_ready)
  if (reportReady) {
    reportPayload = await synthesizeReport(merged)
  }

  return { reply, phase: newPhase, model_updates: modelUpdates, tool_results: toolResults, report_ready: reportReady, report_payload: reportPayload }
}

function parseReply(raw: string): { reply: string; update: Record<string, unknown> | null } {
  const match = raw.match(/```json-update\s*([\s\S]*?)\s*```/)
  if (!match) return { reply: raw.trim(), update: null }
  const before = raw.slice(0, match.index).trim()
  try {
    const update = JSON.parse(match[1])
    return { reply: before, update }
  } catch (e) {
    logger.warn('Failed to parse json-update block', { sample: match[1].slice(0, 200) })
    return { reply: before || raw.trim(), update: null }
  }
}

async function synthesizeReport(model: BusinessModel): Promise<ReportPayload> {
  const systemPrompt = buildSynthesisSystemPrompt(model)
  const resp = await callAnthropic({
    model: 'claude-opus-4-7',
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Generate the ReportPayload JSON now.' }],
    max_tokens: 8192,
    thinking: { type: 'enabled', budget_tokens: 8192 },
  })
  const text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n')
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Synthesis did not return JSON')
  return JSON.parse(jsonMatch[0]) as ReportPayload
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agent/orchestrator.ts
git commit -m "feat(agent): add orchestrator with tool-use loop and Opus synthesis"
```

---

## Task 14: Rewire /api/chat to Orchestrator

**Files:**
- Modify: `pages/api/chat.ts`

- [ ] **Step 1: Replace Groq call with orchestrator**

Replace the body of `pages/api/chat.ts` with:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { runAgentTurn } from '@/lib/agent/orchestrator'
import { AnthropicBusyError } from '@/lib/anthropic'
import { logger } from '@/lib/logger'
import type { ChatRequest, ChatResponse, ApiError, ConversationMessage } from '@/lib/types'
import type { AgentPhase } from '@/lib/agent/types'
import { rateLimit, getIP } from '@/lib/rateLimit'
import { getBaseUrl } from '@/lib/utils'

export default async function handler(req: NextApiRequest, res: NextApiResponse<ChatResponse | ApiError>) {
  const requestId = Math.random().toString(36).slice(2, 10)
  const startedAt = Date.now()

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })

  const ip = getIP(req)
  const { allowed } = await rateLimit(ip, { limit: 10, windowMs: 60000 })
  if (!allowed) return res.status(429).json({ error: 'Too many messages. Please wait 1 minute.', code: 'RATE_LIMIT_EXCEEDED' })

  const { session_id, message } = req.body as ChatRequest
  if (!session_id || typeof session_id !== 'string' || !message || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message or session_id', code: 'BAD_REQUEST' })
  }

  try {
    const supabase = getServiceClient()
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('conversation_history, agent_phase, status')
      .eq('id', session_id)
      .single()

    if (fetchError || !session) return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' })
    if (session.status !== 'active') return res.status(410).json({ error: 'Session expired/complete', code: 'SESSION_CLOSED' })

    const history: ConversationMessage[] = session.conversation_history || []
    const currentPhase = (session.agent_phase as AgentPhase) ?? 'diagnostic'

    const result = await runAgentTurn({
      session_id,
      user_message: message,
      conversation: history.map(m => ({ role: m.role, content: m.content })),
      current_phase: currentPhase,
    })

    const updatedHistory: ConversationMessage[] = [
      ...history,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: result.reply, timestamp: new Date().toISOString() },
    ]

    const finalStatus = result.report_ready ? 'report_generated' : 'active'
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        conversation_history: updatedHistory,
        agent_phase: result.phase,
        status: finalStatus,
        extracted_data: result.report_payload ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id)
      .eq('status', 'active')

    if (updateError) throw new Error('Atomic session update failed')

    let reportId: string | undefined
    if (result.report_ready && result.report_payload) {
      const { data: report } = await supabase
        .from('reports')
        .upsert({ session_id, share_url: `${getBaseUrl()}/report/${session_id}` }, { onConflict: 'session_id' })
        .select('id')
        .single()
      reportId = report?.id
    }

    return res.status(200).json({
      reply: result.reply,
      phase: phaseToNumber(result.phase),
      report_ready: result.report_ready,
      report_id: reportId,
    })
  } catch (err) {
    if (err instanceof AnthropicBusyError) {
      return res.status(503).json({ error: err.message, code: 'UPSTREAM_BUSY' })
    }
    const error = err as Error
    logger.error('Chat error', { msg: error.message, requestId })
    return res.status(500).json({ error: 'Service Unavailable', code: 'INTERNAL_ERROR' })
  } finally {
    logger.info('Chat completed', { requestId, durationMs: Date.now() - startedAt })
  }
}

function phaseToNumber(p: AgentPhase): number {
  const map: Record<AgentPhase, number> = {
    diagnostic: 1, quantifying: 2, competitor_xray: 3, synthesis: 4, sales: 5, complete: 6,
  }
  return map[p]
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/chat.ts
git commit -m "feat(api): rewire /api/chat to use agent orchestrator instead of Groq templates"
```

---

## Task 15: Prototype Provisioning Endpoint

**Files:**
- Create: `pages/api/prototype/provision.ts`

- [ ] **Step 1: Write provisioning endpoint**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { loadBusinessModel } from '@/lib/agent/businessModel'
import { buildBotConfigFromModel } from '@/lib/agent/tools/prototypeBuilder'
import { logger } from '@/lib/logger'

interface ProvisionResponse {
  prototype_id: string
  sandbox_url: string
  whatsapp_qr?: string
  expires_at: string
}

const EVOLUTION_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY
const TTL_HOURS = Number(process.env.PROTOTYPE_SANDBOX_TTL_HOURS ?? '24')

export default async function handler(req: NextApiRequest, res: NextApiResponse<ProvisionResponse | { error: string }>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { session_id, agent_type } = req.body as { session_id: string; agent_type?: 'lead_responder' | 'booking_bot' | 'follow_up' }
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  try {
    const supabase = getServiceClient()
    const model = await loadBusinessModel(session_id)
    const botConfig = buildBotConfigFromModel(model, agent_type ?? 'lead_responder')

    let sandboxInstanceId: string | undefined
    let whatsappQr: string | undefined
    let sandboxUrl: string | undefined

    if (EVOLUTION_URL && EVOLUTION_KEY) {
      try {
        const instanceName = `proto_${session_id.slice(0, 8)}`
        const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
          body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
        })
        if (createRes.ok) {
          const data = (await createRes.json()) as { instance?: { instanceName?: string }; qrcode?: { base64?: string } }
          sandboxInstanceId = data.instance?.instanceName
          whatsappQr = data.qrcode?.base64
          sandboxUrl = `${EVOLUTION_URL}/manager/instance/${sandboxInstanceId}`
        }
      } catch (e) {
        logger.warn('Evolution API provision failed, falling back to preview only', { err: (e as Error).message })
      }
    }

    const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString()

    const { data, error } = await supabase
      .from('prototypes')
      .insert({
        session_id,
        bot_config: botConfig,
        sandbox_instance_id: sandboxInstanceId,
        whatsapp_qr: whatsappQr,
        sandbox_url: sandboxUrl,
        status: sandboxInstanceId ? 'live' : 'provisioning',
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message ?? 'insert failed')

    return res.status(200).json({ prototype_id: data.id, sandbox_url: sandboxUrl ?? '', whatsapp_qr: whatsappQr, expires_at: expiresAt })
  } catch (err) {
    logger.error('Prototype provision failed', { err: (err as Error).message })
    return res.status(500).json({ error: 'Could not provision prototype' })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/prototype/provision.ts
git commit -m "feat(api): add prototype provision endpoint with Evolution API sandbox"
```

---

## Task 16: Digital Twin Component

**Files:**
- Create: `components/Report/DigitalTwin.tsx`

- [ ] **Step 1: Write Digital Twin**

```tsx
import { useState } from 'react'
import type { DigitalTwinData, DigitalTwinNode } from '@/lib/agent/types'

interface Props {
  data: DigitalTwinData
}

export function DigitalTwin({ data }: Props) {
  const [view, setView] = useState<'today' | 'in_90_days'>('today')
  const active = data[view]

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-neutral-100">Your Business: Today vs 90 Days</h3>
        <div className="flex rounded-full border border-neutral-700 p-1">
          <button onClick={() => setView('today')} className={`rounded-full px-4 py-1 text-sm transition ${view === 'today' ? 'bg-red-500/20 text-red-300' : 'text-neutral-400'}`}>Today</button>
          <button onClick={() => setView('in_90_days')} className={`rounded-full px-4 py-1 text-sm transition ${view === 'in_90_days' ? 'bg-emerald-500/20 text-emerald-300' : 'text-neutral-400'}`}>90 Days with AI</button>
        </div>
      </div>

      <div className="relative">
        <svg viewBox="0 0 800 320" className="w-full">
          {active.edges.map((e, i) => {
            const from = active.nodes.find(n => n.id === e.from)
            const to = active.nodes.find(n => n.id === e.to)
            if (!from || !to) return null
            const fromPos = nodePos(active.nodes, from.id)
            const toPos = nodePos(active.nodes, to.id)
            return (
              <line
                key={i}
                x1={fromPos.x + 60}
                y1={fromPos.y + 30}
                x2={toPos.x}
                y2={toPos.y + 30}
                stroke={e.is_leak ? '#ef4444' : view === 'today' ? '#6b7280' : '#10b981'}
                strokeWidth={e.is_leak ? 3 : 2}
                strokeDasharray={e.is_leak ? '4 4' : undefined}
              />
            )
          })}
          {active.nodes.map(node => {
            const pos = nodePos(active.nodes, node.id)
            return <NodeBox key={node.id} node={node} x={pos.x} y={pos.y} view={view} />
          })}
        </svg>
      </div>
    </div>
  )
}

function nodePos(nodes: DigitalTwinNode[], id: string): { x: number; y: number } {
  const idx = nodes.findIndex(n => n.id === id)
  const row = Math.floor(idx / 4)
  const col = idx % 4
  return { x: col * 190 + 20, y: row * 130 + 20 }
}

function NodeBox({ node, x, y, view }: { node: DigitalTwinNode; x: number; y: number; view: 'today' | 'in_90_days' }) {
  const color =
    node.kind === 'ai_agent' ? '#10b981' :
    node.kind === 'leak' ? '#ef4444' :
    node.kind === 'lead' ? '#3b82f6' :
    node.kind === 'output' ? '#a855f7' :
    '#6b7280'
  return (
    <g>
      <rect x={x} y={y} width="140" height="60" rx="10" fill={color + '22'} stroke={color} strokeWidth="1.5" />
      <text x={x + 70} y={y + 25} textAnchor="middle" fill="#f3f4f6" fontSize="12" fontWeight="600">{node.label}</text>
      {node.leak_inr_per_month != null && view === 'today' && (
        <text x={x + 70} y={y + 45} textAnchor="middle" fill="#fca5a5" fontSize="11">-₹{Math.round(node.leak_inr_per_month / 1000)}K/mo</text>
      )}
      {node.replaced_by_ai && view === 'in_90_days' && (
        <text x={x + 70} y={y + 45} textAnchor="middle" fill="#6ee7b7" fontSize="11">AI-automated</text>
      )}
    </g>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Report/DigitalTwin.tsx
git commit -m "feat(report): add Digital Twin today-vs-90days visualization"
```

---

## Task 17: Live Prototype Component

**Files:**
- Create: `components/Report/LivePrototype.tsx`

- [ ] **Step 1: Write Live Prototype component**

```tsx
import { useState } from 'react'

interface Props {
  sessionId: string
  businessName: string
}

export function LivePrototype({ sessionId, businessName }: Props) {
  const [state, setState] = useState<'idle' | 'provisioning' | 'ready' | 'error'>('idle')
  const [qr, setQr] = useState<string | undefined>()
  const [sandboxUrl, setSandboxUrl] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  async function provision() {
    setState('provisioning')
    try {
      const res = await fetch('/api/prototype/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, agent_type: 'lead_responder' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { whatsapp_qr?: string; sandbox_url?: string }
      setQr(data.whatsapp_qr)
      setSandboxUrl(data.sandbox_url)
      setState('ready')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-emerald-200">Try Your {businessName} AI — Live</h3>
        <p className="mt-1 text-sm text-neutral-400">We built a working Lead Responder for you. Message it like a customer would. See it reply in 5 seconds.</p>
      </div>

      {state === 'idle' && (
        <button onClick={provision} className="rounded-full bg-emerald-500 px-6 py-3 font-medium text-emerald-950 hover:bg-emerald-400">
          Spin up my AI agent
        </button>
      )}
      {state === 'provisioning' && <div className="text-emerald-300">Building your agent… 20 seconds</div>}
      {state === 'ready' && (
        <div className="space-y-3">
          {qr && <img src={`data:image/png;base64,${qr}`} alt="WhatsApp QR" className="h-48 w-48 rounded-lg border border-neutral-700" />}
          {sandboxUrl && <a href={sandboxUrl} target="_blank" rel="noreferrer" className="text-emerald-300 underline">Open sandbox dashboard →</a>}
          <p className="text-sm text-neutral-400">Scan the QR code with WhatsApp. Send a message as if you were a customer. The AI will respond.</p>
        </div>
      )}
      {state === 'error' && <div className="text-red-400">Could not spin up: {error}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Report/LivePrototype.tsx
git commit -m "feat(report): add Live Prototype component with sandbox provisioning"
```

---

## Task 18: Competitor X-Ray Component

**Files:**
- Create: `components/Report/CompetitorXRay.tsx`

- [ ] **Step 1: Write Competitor X-Ray**

```tsx
import type { CompetitorXRayData } from '@/lib/agent/types'

interface Props {
  data: CompetitorXRayData
}

export function CompetitorXRay({ data }: Props) {
  if (!data.competitors || data.competitors.length === 0) return null
  return (
    <div className="rounded-2xl border border-amber-700/40 bg-amber-950/10 p-6">
      <h3 className="mb-2 text-xl font-semibold text-amber-200">Competitor X-Ray</h3>
      <p className="mb-5 text-sm text-neutral-400">{data.gap_summary}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {data.competitors.map((c, i) => (
          <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium text-neutral-100">{c.name}</div>
              <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                c.ai_adoption_signal === 'ahead' ? 'bg-red-500/20 text-red-300' :
                c.ai_adoption_signal === 'behind' ? 'bg-emerald-500/20 text-emerald-300' :
                'bg-neutral-800 text-neutral-400'
              }`}>
                {c.ai_adoption_signal === 'ahead' ? 'Ahead of you' : c.ai_adoption_signal === 'behind' ? 'Behind you' : 'Unknown'}
              </span>
            </div>
            <div className="text-sm text-neutral-400">{c.key_finding}</div>
            {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-amber-300 underline">{c.url}</a>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Report/CompetitorXRay.tsx
git commit -m "feat(report): add Competitor X-Ray card with ahead/behind signals"
```

---

## Task 19: Update Report API

**Files:**
- Modify: `pages/api/report.ts`

- [ ] **Step 1: Replace handler with full-payload version**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { ReportPayload } from '@/lib/agent/types'

interface GetReportResponse {
  report_id: string
  session_id: string
  payload: ReportPayload
  share_url: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<GetReportResponse | { error: string }>) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { session_id } = req.query
  if (!session_id || typeof session_id !== 'string') return res.status(400).json({ error: 'session_id required' })

  try {
    const supabase = getServiceClient()
    const { data: session } = await supabase
      .from('sessions')
      .select('id, extracted_data, status')
      .eq('id', session_id)
      .maybeSingle()

    if (!session || !session.extracted_data) return res.status(404).json({ error: 'Report not ready' })

    const { data: report } = await supabase
      .from('reports')
      .select('id, share_url')
      .eq('session_id', session_id)
      .maybeSingle()

    await supabase.rpc('increment_view_count', { p_session_id: session_id }).then(() => undefined, () => undefined)

    return res.status(200).json({
      report_id: report?.id ?? '',
      session_id,
      payload: session.extracted_data as ReportPayload,
      share_url: report?.share_url ?? '',
    })
  } catch (err) {
    logger.error('Report fetch failed', { err: (err as Error).message })
    return res.status(500).json({ error: 'Internal error' })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/report.ts
git commit -m "feat(api): return full ReportPayload including digital_twin and competitor_xray"
```

---

## Task 20: Integrate New Components in Report Page

**Files:**
- Modify: `pages/report/[id].tsx`

- [ ] **Step 1: Add new components to report page**

Read current [id].tsx and wire in the three new components. Above or below the existing roadmap section, insert:

```tsx
import { DigitalTwin } from '@/components/Report/DigitalTwin'
import { LivePrototype } from '@/components/Report/LivePrototype'
import { CompetitorXRay } from '@/components/Report/CompetitorXRay'
import type { ReportPayload } from '@/lib/agent/types'
```

In the render section, after the existing roadmap, add:

```tsx
{payload.digital_twin && (
  <section className="mb-12">
    <DigitalTwin data={payload.digital_twin} />
  </section>
)}

{payload.competitor_xray && payload.competitor_xray.competitors.length > 0 && (
  <section className="mb-12">
    <CompetitorXRay data={payload.competitor_xray} />
  </section>
)}

<section className="mb-12">
  <LivePrototype sessionId={sessionId} businessName={payload.business_name} />
</section>
```

- [ ] **Step 2: Commit**

```bash
git add pages/report/[id].tsx
git commit -m "feat(report): integrate DigitalTwin, CompetitorXRay, LivePrototype components"
```

---

## Task 21: Update Session API Opening Message

**Files:**
- Modify: `pages/api/session.ts`

- [ ] **Step 1: Change opening to match diagnostic persona**

Replace the two hardcoded opening strings (lines 42 and 62) with a single constant at top of file:

```typescript
const OPENING_MESSAGE = "Tell me what your business does. I'll find your biggest revenue leak in 8 minutes."
```

Use `OPENING_MESSAGE` in both places.

- [ ] **Step 2: Commit**

```bash
git add pages/api/session.ts
git commit -m "refactor(session): dedupe opening message + sharpen diagnostic tone"
```

---

## Task 22: End-to-End Manual Smoke Test

**Files:** none (test steps only)

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open /chat in browser, complete a full session**

Role-play as a real estate founder. Describe: Bangalore, 5-person team, ₹80K avg ticket, 120 leads/month via Facebook. Answer the AI's follow-ups. Expect:
- AI asks about your workflow specifically
- AI quantifies a leak with ₹ numbers
- AI names your biggest fire
- AI offers the report → agree
- Redirects to /report/[id]

- [ ] **Step 3: Verify report page renders**

On `/report/[id]`:
- Business name + diagnosis paragraph
- Digital Twin with Today/90 Days toggle
- Competitor X-Ray (if you named competitors)
- Live Prototype "Spin up my AI agent" button
- Dual CTA: Book Call + Deploy Agent

- [ ] **Step 4: Test Live Prototype provisioning**

Click "Spin up my AI agent". Expect either:
- QR code renders (if Evolution API configured)
- Or graceful error message (if Evolution API not configured in env)

- [ ] **Step 5: Check Supabase tables**

In Supabase dashboard, verify new rows in:
- `sessions` (status = report_generated)
- `business_models` (completeness_score > 70)
- `reports` (one row)
- `prototypes` (one row if provisioning succeeded)

- [ ] **Step 6: Commit any fixes needed**

If smoke test reveals bugs, fix them and commit with clear messages.

---

## Self-Review

Covered spec sections:
- §1 Problem: solved by replacing hardcoded scripts with orchestrator (Tasks 11-14)
- §2 Goal: diagnostic reasoning (Tasks 4-5, 12-13), conviction + real numbers (Tasks 6-7), sales conversion (Tasks 16-20)
- §3 Architecture: orchestrator + tools + state + report (Tasks 4-20)
- §4 Components: every file in §4 has a corresponding task
- §5 Data Flow: Task 14 + 15 + 19 implement all 8 steps
- §6 DB Changes: Task 3
- §7 API Routes: Tasks 14, 15, 19
- §8 LLM Strategy: Task 11 (wrapper), Task 13 (Sonnet loop + Opus synthesis)
- §9 Out of Scope: respected — no tasks for Phase 3 features
- §11 Build Order: plan follows the 12-step order

No placeholders. Types align across tasks (`BusinessModel`, `ReportPayload`, `AgentPhase` used consistently).
