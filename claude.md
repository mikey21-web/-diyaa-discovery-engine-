# AI Discovery Engine — CLAUDE.md
# diyaa.ai | Uday | Version 2.0

---

## What This Product Is

A conversational AI implementation consultant that helps Indian and UAE SMB founders discover exactly where AI fits in their business, why it matters in rupees and hours, and what to build first.

The session feels like a McKinsey engagement, not a chatbot quiz.
The output is a branded, data-backed implementation roadmap that sells the next step — a call with diyaa.ai.

**Core insight driving the product:**
95.6% of Indian SMBs are investing in or planning AI adoption (LinkedIn India, 2025).
The #1 barrier is not cost or tech. It is not knowing where to start.
This product removes that barrier. diyaa.ai captures the intent.

---

## Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Next.js 14 Pages Router + Tailwind + TypeScript | Full control, fast deploy |
| AI Engine | Claude API (claude-sonnet-4-20250514) | Best reasoning for open-ended discovery |
| State | Supabase (Postgres + Realtime) | Session persistence, lead storage |
| PDF | Puppeteer + custom HTML template | Branded, pixel-perfect output |
| Auth | None (public tool, email capture at end) | Zero friction for lead gen |
| Deploy | Vercel | Instant, free tier handles early traffic |
| CTA | Email + Cal.com | Direct to Uday |

---

## Code Rules

- TypeScript everywhere, zero `any`
- Tailwind only, no inline styles, no CSS modules
- All async calls wrapped in try/catch with typed errors
- No console.log in production, use a `lib/logger.ts` utility
- File structure:
  ```
  pages/
    index.tsx              landing page
    chat.tsx               discovery session UI
    report/[id].tsx        shareable report page
  pages/api/
    session.ts             create/get session
    chat.ts                conversation turn handler
    report.ts              trigger report generation
    lead.ts                capture email after session
  components/
    Chat/
    Report/
    UI/
  lib/
    claude.ts              Anthropic SDK wrapper
    supabase.ts            Supabase client
    benchmarks.ts          vertical benchmark data
    scoring.ts             AI readiness score calculator
    pdf.ts                 report PDF generator
    logger.ts
  ```

---

## Commit Style

Conventional commits: `feat/fix/chore/docs/refactor(scope): message`

---

## Core Feature: The Discovery Engine

### Philosophy

Do NOT build a form. Do NOT build a quiz. Build a conversation.

The AI consultant listens, cross-examines, and extracts structured data through natural dialogue. It knows what it needs. It finds ways to get it without making the founder feel interrogated.

A founder who answers 20 questions in a chat feels heard. A founder who fills out a 20-field form feels processed.

### Conversation Architecture

6 phases. Sequential. Never skip.

#### Phase 1: Business Basics (2-3 exchanges)
Extract: business name, industry vertical, city, team size, years in operation, rough monthly revenue range.
Entry question: "Tell me about your business — what do you do and who do you do it for?"
Do NOT ask for revenue directly. Infer from context. Confirm with: "Are you at roughly X/month scale, or higher?"

#### Phase 2: Operations Audit (4-5 exchanges)
Extract: tools used, how leads come in, how orders are processed, how team communicates internally.
Probe every tool mentioned: "You mentioned [tool] — what does your team actually use it for daily?"
Identify manual steps: "What part of that process still requires someone sitting down and doing it manually?"

#### Phase 3: Revenue and Growth (3-4 exchanges)
Extract: primary acquisition channels, current conversion rates (approximate), follow-up cadence, sales cycle length.
Key question: "From the time a lead contacts you to the time they pay — walk me through what happens."
Listen for: response time gaps, missed follow-ups, no-shows, abandoned carts, lost leads.

#### Phase 4: Pain Points and Revenue Leaks (3-4 exchanges)
Extract: top 3 time-wasting activities, recurring mistakes, founder's biggest operational frustration.
Cross-examine every pain: "How often does that happen per week? And roughly what does one instance cost you in time or money?"
This phase generates the Revenue Leak Analysis section of the report.

#### Phase 5: AI Readiness Check (2-3 exchanges)
Extract: current AI tool usage, tech comfort level, budget signals, decision-making timeline.
Do NOT ask budget directly. Ask: "Have you invested in any software or tools in the last 12 months to make the business run smoother?"
Infer readiness score (1-10) from answers. Store internally. Do not share the score during conversation.

#### Phase 6: Synthesis and Confirmation (2-3 exchanges)
AI surfaces 2-3 patterns it noticed. Asks confirming questions.
Example: "It sounds like your biggest leak is lead response time — you're probably losing 3-4 deals a week just to whoever responds faster. Does that feel right?"
Only proceed to report after confirmation.

Total exchanges: 18-22. Ideal session time: 8-12 minutes.

### Cross-Examination Rules

Every vague answer triggers a follow-up before moving on:
- "It's fine" becomes "What would better than fine look like for you?"
- "We use WhatsApp" becomes "Walk me through what your WhatsApp workflow looks like on a normal day."
- "We lose some leads" becomes "If you had to guess, how many leads go cold every month without converting?"
- "Not really using AI" becomes "What does a typical Tuesday look like for you from morning to close?"

Never ask more than one question per response.
Never use bullet points or headers in chat. Plain conversational text only.
Never say "Great question," "Absolutely," "Certainly," or any filler affirmation.
Never say "I'm an AI" or reference being an AI assistant.

### Conversation State (Supabase per session)

```typescript
type SessionState = {
  id: string
  created_at: string
  status: 'active' | 'complete' | 'report_generated'
  phase: 1 | 2 | 3 | 4 | 5 | 6

  business: {
    name: string
    industry: VerticalKey
    city: string
    team_size: number
    years_in_operation: number
    monthly_revenue_range: RevenueRange
  }

  tools_used: string[]
  lead_sources: string[]
  sales_cycle_days: number
  manual_processes: string[]

  revenue_leaks: Array<{
    description: string
    frequency_per_week: number
    estimated_cost_inr: number
  }>

  current_ai_tools: string[]
  ai_readiness_score: number   // 1-10, internal only
  tech_comfort: 'low' | 'medium' | 'high'

  conversation_history: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>

  report_id: string | null
  lead_captured: boolean
}

type VerticalKey =
  | 'real_estate'
  | 'hospitality'
  | 'fashion_d2c'
  | 'coaching'
  | 'fnb'
  | 'healthcare'
  | 'logistics'
  | 'retail'
  | 'other'

type RevenueRange =
  | 'under_5L'
  | '5L_20L'
  | '20L_50L'
  | '50L_1Cr'
  | 'above_1Cr'
```

---

## Industry Benchmarks (Real Data Used in Reports)

Sourced benchmarks. Used to show the gap between the founder's current state and top performers.

```typescript
export const BENCHMARKS = {
  real_estate: {
    lead_response_time_top: '5 minutes',
    lead_response_time_average_india: '4.2 hours',
    lead_response_time_gap_multiplier: '50x',
    whatsapp_inquiry_share: '60-70% of all property inquiries in India',
    conversion_rate_without_automation: '2-3%',
    conversion_rate_with_automation: '4-6%',
    follow_up_attempts_needed: 7,
    follow_up_attempts_average_team: 2,
    ai_roi_example: 'Developer at 80L avg ticket, 200 leads/month: improving close rate 3% to 6% = 4.8Cr extra revenue/month',
    stat_source: 'Kraya AI 2026, CampaignHQ 2026, RhinoAgents 2025',
  },
  hospitality: {
    whatsapp_booking_response_target: 'under 2 minutes',
    whatsapp_booking_response_average: '2-4 hours',
    no_show_reduction_with_whatsapp_reminders: '25-40%',
    repeat_guest_rate_top: '35%',
    upsell_conversion_via_chat: '15-20%',
    stat_source: 'Hyperleap AI 2026, industry data',
  },
  fashion_d2c: {
    cart_abandonment_rate_india: '90% on mobile',
    cart_recovery_whatsapp_vs_email: 'WhatsApp: 28% conversion vs Email: 3-5%',
    repeat_customer_rate_with_whatsapp: '3x vs email-only',
    support_response_target: 'under 10 minutes on WhatsApp',
    stat_source: 'CampaignHQ 2026, Cooby 2024, Statista 2025',
  },
  coaching: {
    lead_to_call_conversion_average: '15-20%',
    lead_to_call_conversion_with_bot: '35-45%',
    no_show_rate_without_reminder: '30-40%',
    no_show_rate_with_whatsapp_reminder: '10-15%',
    stat_source: 'Industry surveys, diyaa.ai client data',
  },
  fnb: {
    order_inquiry_response_target: 'under 3 minutes',
    repeat_order_rate_with_whatsapp: '3x vs email',
    review_generation_via_whatsapp: '40% higher vs email request',
    stat_source: 'Cooby 2024, WhatsApp Business reports',
  },
  general: {
    whatsapp_open_rate: '98%',
    email_open_rate: '21-25%',
    whatsapp_lead_conversion_with_chatbot: '28%',
    india_smb_ai_adoption_planning: '95.6%',
    india_smb_whatsapp_adoption: '78%',
    response_within_5min_conversion_lift: '9x higher conversion',
    stat_source: 'LinkedIn India 2025, AISensy 2026, Harvard Business Review',
  }
}
```

---

## AI Readiness Scoring System

Score computed after Phase 5. Never shown to the user during the session.
Used to calibrate report tone and urgency of recommendations.

```typescript
function calculateReadinessScore(session: SessionState): number {
  let score = 0

  // Data maturity (0-2)
  const hasCRM = session.tools_used.some(t =>
    ['CRM', 'Zoho', 'Salesforce', 'HubSpot', 'LeadSquared'].includes(t))
  if (hasCRM) score += 1
  if (session.tools_used.some(t => ['Google Sheets', 'Excel', 'Airtable', 'Notion'].includes(t))) score += 0.5
  if (session.manual_processes.length < 3) score += 0.5

  // Tech comfort (0-2)
  const comfortMap = { low: 0, medium: 1, high: 2 }
  score += comfortMap[session.tech_comfort]

  // AI exposure (0-2)
  if (session.current_ai_tools.length > 0) score += 1
  if (session.current_ai_tools.length > 2) score += 1

  // WhatsApp as business channel (0-1)
  if (session.tools_used.includes('WhatsApp') ||
      session.lead_sources.includes('WhatsApp')) score += 1

  // Operational clarity (0-2)
  if (session.sales_cycle_days > 0) score += 0.5
  if (session.revenue_leaks.length >= 2) score += 1
  if (session.lead_sources.length >= 2) score += 0.5

  // Team size proxy (0-1)
  if (session.business.team_size >= 3) score += 0.5
  if (session.business.team_size >= 10) score += 0.5

  return Math.min(10, Math.round(score * 10) / 10)
}

// Score interpretation for report tone:
// 1-3: Foundational — basic automation wins, quick ROI framing
// 4-6: Operational — ready for AI agents, multi-channel automation
// 7-9: Advanced — complex multi-agent systems, voice, custom CRM
// 10: Outlier — likely already using AI, pitch is differentiation not adoption
```

---

## Report Structure (PDF Output)

All 7 sections use only extracted session data. Zero generic content.

### Section 1: Business Snapshot
One paragraph. Summarizes what was learned. Reads like a human wrote it after a real conversation.

### Section 2: Where You Stand vs Top Performers
Table format. 3-5 metrics. Their approximate state vs industry benchmark.
Pull from BENCHMARKS[session.business.industry].

| Metric | Your Estimate | Top Performers | Gap |
|--------|--------------|----------------|-----|
| Lead response time | ~3 hours | 5 minutes | 36x slower |
| Follow-up attempts | 2 | 7 | Missing 5 touches |
| Lead-to-conversion | ~2% | 5-6% | 3x lower |

### Section 3: Revenue Leak Analysis
Concrete rupee estimates. One row per identified leak.
Formula: frequency_per_week x 52 x estimated_cost_per_instance

Example output:
- Slow lead response: ~4 lost deals/week x 50K avg commission = 1.04Cr/year leaking
- Manual follow-up failure: ~6 leads/week going cold = 78L/year on the table
- Total estimated annual revenue leak: 1.82Cr

Keep estimates conservative. They must feel credible, not inflated.

### Section 4: AI Implementation Priorities
Ranked list of 4-6 AI systems recommended.
Each entry includes: what it is, why this business specifically needs it (tied to a pain from the session), estimated impact, rough build timeline in weeks, rough cost in INR.
Order: highest ROI first, lowest complexity first within same ROI tier.

### Section 5: 90-Day AI Roadmap
Three phases shown as a visual timeline.

Month 1 — Quick Wins (High ROI, Low Complexity)
Example: WhatsApp bot for lead response + basic CRM integration

Month 2 — Core Systems
Example: Voice agent for inbound calls + follow-up automation

Month 3 — Intelligence Layer
Example: Lead scoring, analytics, AI-generated follow-up messages

### Section 6: AI Readiness Score
Score as X/10 with one-line interpretation.
Subtext: "Most Indian SMBs score between 3-5. You scored X, which means [interpretation]."

### Section 7: Next Step
Not a generic CTA. Tied to their specific top priority.
Example: "Based on what you've shared, the fastest ROI is a WhatsApp automation system for lead response. diyaa.ai has built this for 3 real estate clients in the last 6 months. Book a 30-minute call to see a live demo."

CTA buttons:
1. Book a Call — Cal.com link
2. Email Uday — reply to email
3. Share This Report — copy shareable URL

---

## System Prompt (Exact — Used in Every API Call)

```
You are Arya, a senior AI implementation consultant at diyaa.ai. You help Indian and UAE business founders discover exactly where AI can be implemented in their operations to save time, reduce costs, and grow revenue.

Your job right now is to conduct a deep discovery session. You will ask questions, listen carefully, and extract structured information about this founder's business, operations, and pain points. You do this through natural conversation, not a questionnaire.

CONVERSATION RULES:
Ask exactly one question per response. Never list multiple questions.
Never use bullet points or headers. Conversational prose only.
Never say "Great question", "Absolutely", "Certainly", or any hollow affirmation.
Never identify yourself as an AI unless directly asked. If asked, say you're a consultant at diyaa.ai.
Be direct, confident, and precise. No padding.
Go one level deeper on every vague answer before moving to the next topic.
Use the founder's name if they have shared it.

DISCOVERY PHASES (follow in order):
Phase 1: Business basics — what they do, who they serve, team size, rough revenue scale, city
Phase 2: Operations audit — tools used, daily workflows, how leads come in and get processed
Phase 3: Revenue and growth — acquisition channels, conversion process, sales cycle, follow-up patterns
Phase 4: Pain points — what wastes time, what causes mistakes, quantify each with frequency and cost
Phase 5: AI readiness — current tech usage, comfort with software, investment history
Phase 6: Synthesis — surface patterns, confirm with founder, ask confirming questions

CROSS-EXAMINATION:
Vague answer: go deeper before moving on.
Tool mentioned: ask how they actually use it day-to-day.
Problem mentioned: ask how often it happens and what it costs.
"It's fine": respond with "What would better than fine look like for you?"

INTERNAL TRACKING (never mention to user):
Track which phase you are in.
Track what data you have and what is still missing.
Internally estimate their AI readiness score 1-10 based on what you learn.

WHEN TO END:
When you have completed all 6 phases and confirmed the synthesis, output this exact token on its own line:
[REPORT_READY]

Then immediately output a JSON block with all extracted data:
{
  "business_name": "",
  "industry": "",
  "city": "",
  "team_size": 0,
  "monthly_revenue_range": "",
  "tools_used": [],
  "lead_sources": [],
  "sales_cycle_days": 0,
  "manual_processes": [],
  "revenue_leaks": [
    { "description": "", "frequency_per_week": 0, "estimated_cost_inr": 0 }
  ],
  "current_ai_tools": [],
  "tech_comfort": "low|medium|high",
  "ai_readiness_score": 0,
  "top_pain_points": [],
  "key_insights": []
}

Do not break character at any point before [REPORT_READY].
```

---

## API Route Specifications

### POST /api/session
Creates a new session. Returns session_id.
```typescript
// Request: {}
// Response: { session_id: string, created_at: string }
```

### POST /api/chat
Handles one conversation turn. Manages history. Detects [REPORT_READY] signal.
```typescript
// Request: { session_id: string, message: string }
// Response: {
//   reply: string,
//   phase: number,
//   report_ready: boolean,
//   report_id?: string   // populated if report_ready is true
// }
```

Implementation notes:
Fetch full conversation history from Supabase before each call.
Pass full history + system prompt to Claude API.
After each response, parse for [REPORT_READY] token.
If detected: extract JSON, store to Supabase, trigger report generation, return report_id.

### POST /api/report
Triggers PDF generation from extracted session data.
```typescript
// Request: { session_id: string }
// Response: { report_id: string, report_url: string }
```

### POST /api/lead
Captures lead after session completes. Email-only approach.
```typescript
// Request: { session_id: string, name: string, email: string }
// Response: { success: boolean }
```

---

## Supabase Schema

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  status text default 'active' check (status in ('active', 'complete', 'report_generated')),
  phase int default 1,
  conversation_history jsonb default '[]',
  extracted_data jsonb,
  ai_readiness_score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  pdf_url text,
  share_url text,
  view_count int default 0,
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  name text,
  email text,
  whatsapp text,
  industry text,
  city text,
  report_url text,
  status text default 'new' check (status in ('new', 'contacted', 'qualified', 'converted')),
  created_at timestamptz default now()
);

-- Enable RLS on all tables
-- Reports: public read by share_url
-- Leads: service role only
```

---

## Lead Capture Strategy

### Timing
Gate the full report behind email capture. NOT during session, after.
After [REPORT_READY] signal shows in UI: "Your AI Implementation Report is ready. Where should we send it?"

### Fields
- Name (required)
- Email (required)

### Post-capture automation via n8n (n8n.diyaaaa.in)
1. Lead stored in Supabase
2. n8n webhook triggers from /api/lead
3. Email sent via Gmail: "Your AI Implementation Roadmap is ready. [link]"
4. Wait 24 hours
5. Check if report was opened (view_count > 0 in Supabase)
6. If opened: "Did you get a chance to look at your roadmap? Happy to walk you through the priority actions."
7. If not opened: "Just following up — your personalized AI roadmap is ready here: [link]"
8. Log to Google Sheets for manual CRM tracking

n8n version: 2.9.2
Use split/indexOf instead of regex. Use Code nodes instead of Filter/Switch.

---

## SEO and Traffic Strategy

Build for organic from day one.

### Target keywords
- "AI for my business India"
- "how to use AI in small business India"
- "AI implementation roadmap India"
- "free AI audit tool"
- "where to implement AI in my business"

### On-page
- Title: "Free AI Implementation Audit for Indian Businesses | diyaa.ai"
- Meta description: "Find out exactly where AI can save you time and money — free 10-minute AI discovery session built for Indian SMBs."
- H1: "Find Out Exactly Where AI Fits in Your Business"
- Schema: SoftwareApplication + FAQPage

### Vertical landing pages (build 5)
Each page targets one vertical with specific pain-point copy, then funnels into the same chat with a pre-seeded first message.

- /real-estate-ai-audit
- /restaurant-ai-audit
- /coaching-business-ai-audit
- /fashion-brand-ai-audit
- /hotel-whatsapp-automation

### Shareability
Every report gets a public URL: diyaaaa.in/report/[id]
Report header: "Generated by diyaa.ai — Get your free AI audit"
Small watermark on PDF.

### LinkedIn flywheel (Uday posts weekly)
Anonymized report snapshots. Example: "A Hyderabad real estate team was losing 1.2Cr/year to slow lead response. Here's their AI audit." Links to tool.

---

## UI/UX Requirements

### Landing Page
- Single headline. Sub-headline with what they get in 10 minutes for free.
- Live counter: "X businesses audited" from Supabase.
- One CTA only: "Start Free AI Audit"
- No nav. No distractions. Conversion layout.

### Chat Interface
- Clean minimal design. Linear or Notion aesthetic.
- Left: consultant avatar + name "Arya from diyaa.ai"
- Typing indicator while Claude generates
- Subtle progress indicator in corner: "Phase 2 of 6"
- Mobile-first — most Indian SMB founders are on phone
- Auto-scroll to latest message

### Report Page
- Print-quality layout
- diyaa.ai branding header
- Revenue numbers in large bold type
- Roadmap as visual timeline, not a list
- Sticky CTA at bottom on mobile

---

## Environment Variables

```env
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://diyaaaa.in
NEXT_PUBLIC_WHATSAPP_NUMBER=918074228036
NEXT_PUBLIC_CAL_LINK=https://cal.com/uday-diyaa
N8N_WEBHOOK_SECRET=
N8N_LEAD_WEBHOOK_URL=https://n8n.diyaaaa.in/webhook/new-lead
```

---

## Do Not

- Do not use CSS-in-JS libraries
- Do not use class components
- Do not hardcode any key, URL, or number — env vars for everything
- Do not skip loading and error states in any UI component
- Do not generate the report until [REPORT_READY] is detected in the API response
- Do not use placeholder data in reports — real session data only
- Do not show the AI readiness score during the conversation
- Do not ask more than one question per chat turn
- Do not let the UI feel like a form at any point
- Do not skip the lead gate — this is the entire lead gen mechanism

---

## Definition of Done

1. A founder starts from diyaaaa.in, has a natural 8-12 minute conversation, and receives a branded PDF with their name, business context, real benchmark comparisons, and a numbered priority list of AI systems to build.

2. Every completed session automatically captures lead data and triggers a WhatsApp follow-up within 30 seconds.

3. Every report is publicly shareable via a unique URL.

4. The landing page ranks for at least one target keyword within 60 days.

5. Uday receives a daily Supabase or Google Sheets summary of new leads: industry, city, top pain point, readiness score.