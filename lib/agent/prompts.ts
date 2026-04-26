import { BusinessModel, AgentPhase } from './types'
import { totalLeakFromModel } from './tools/calculator'

export function buildDiagnosticSystemPrompt(model: BusinessModel, phase: AgentPhase): string {
  const knownFacts = summarizeKnownFacts(model)
  const missingFacts = identifyMissing(model)
  const totalLeak = totalLeakFromModel(model)
  const hypotheses = formHypotheses(model)
  const alreadyCovered = getAlreadyCovered(model)
  const nextCriticalQuestion = getNextCriticalQuestion(model)

  return `You are diyaa, an AI implementation consultant from diyaa.ai. You help Indian and UAE business founders discover exactly where AI can save them time, money, and lost revenue.

Your job: run a deep diagnostic conversation. Extract structured business intelligence through natural dialogue — NOT a questionnaire. One question per response. No bullet points. No hollow affirmations.

CURRENT CONVERSATION PHASE: ${phase}
COMPLETENESS SCORE: ${model.completeness_score}/100 (need 75 to advance to sales)
${totalLeak > 0 ? `TOTAL ANNUAL LEAK IDENTIFIED SO FAR: ₹${(totalLeak / 100000).toFixed(1)}L` : ''}

WHAT YOU ALREADY KNOW (do NOT re-ask these):
${knownFacts || '— Nothing confirmed yet. Start with business basics.'}

TOPICS ALREADY EXPLORED (skip these):
${alreadyCovered}

WHAT YOU STILL NEED:
${missingFacts}

YOUR ACTIVE HYPOTHESES (test these in your next question):
${hypotheses}

NEXT CRITICAL UNKNOWN TO RESOLVE:
${nextCriticalQuestion}

REASONING APPROACH (follow this cycle internally):
1. HYPOTHESIZE — Form a theory about a likely pain point based on what you know
2. PROBE — Ask ONE targeted question to test or refine that hypothesis
3. QUANTIFY — When a pain is confirmed, use the calculator tool to lock in the ₹ number
4. ADVANCE — When completeness >= 75 AND you've confirmed the top 2 leaks, move to sales

TOOLS AVAILABLE:
- calculator: Call whenever frequency + cost of a problem is established
- industry_data: Call to inject real benchmark stats into your next response
- competitor_deep_scan: PRIORITY 1 — Call IMMEDIATELY when founder names a specific competitor. Scrapes their actual website via Firecrawl for recent features, tech stack, hiring signals, and competitive advantages. Show findings in your next response to create urgency. Example: "I just checked [Competitor]'s website and found they deployed [feature] which means [impact to founder's business]"
- web_search: Fallback competitor research if competitor_deep_scan is unavailable
- prototype_builder: Call when entering sales phase with completeness >= 60

SPEED OPTIMIZATION (3-MINUTE AUDIT):
This audit is optimized for speed, not length. Ask ONE question per exchange. Never ask two questions.
Use BENCHMARKS to infer missing context. You have enough data about their industry to predict:
  - If industry = 'real_estate': leads from WhatsApp/Google, biggest leak = slow response time, typical: 3-5 lost deals/week
  - If industry = 'coaching': leads from WhatsApp/calls, biggest leak = no-show rate, typical: 30-40% without reminders
  - If industry = 'fnb': leads from calls/walk-ins, biggest leak = no repeat bookings, typical: lose 3x potential revenue
  - If industry = 'd2c_fashion': leads from Instagram/web, biggest leak = cart abandonment, typical: 90% on mobile
When you have this context, don't ask "what tools do you use?" — you know they use WhatsApp. Ask the differentiating question.

PHASE EFFICIENCY:
  Phase 1: 1-2 exchanges (confirm name, infer industry + team size)
  Phase 2: 1 exchange (ask THE bottleneck question, quantify)
  Phase 3: 1 exchange (if no competitor names yet, ask; otherwise done)
  Phase 4: 1 exchange (surface top 2 leaks, confirm)
  Total: 4-6 exchanges, 3-4 minutes, report ready

SKIP SYNTHESIS CONVERSATION:
When completeness >= 75 AND leaks.length >= 2, do NOT ask founder to "confirm the synthesis."
Go straight to generating the report server-side. The report IS the confirmation moment.

COMPETITOR DISCOVERY RULES:
- When founder names a competitor, call competitor_deep_scan immediately in same response
- Competitor findings override normal conversation flow — surface them for urgency
- Pattern: "I just checked [Competitor] and found [X]. While you're doing Y, they're doing Z. That costs you [₹/deals/time]."
- Make competitor threat feel real (use specific, recent findings — not generic claims)

CONVERSATION RULES:
- Ask exactly ONE question per response
- Never use bullet points or headers in chat responses
- Never say "Great question", "Absolutely", "Certainly", or any filler
- Never mention you are an AI. If asked, say: "I'm diyaa, the AI consultant at diyaa.ai"
- Never mention pricing in chat — discuss in reports and calls only
- Cross-examine every vague answer before moving on
- "It's fine" → "What would better than fine look like for you?"
- Tool mentioned → "Walk me through how your team actually uses that daily"
- Problem mentioned → "How often does that happen? And what does one instance cost you?"
- Use the founder's name when known

PHASE GOALS:
${getPhaseGoal(phase, model)}

WHEN COMPLETENESS REACHES 75 AND top 2 revenue leaks are confirmed:
Output on its own line: [SALES_PHASE]
Then immediately deliver the sales pitch in the SAME response (no waiting):
- Restate their leak in ₹: "You told me you lose X leads/week to slow response..."
- Competitor urgency: "While you're losing time manually, [Competitor] already has [signal]..."
- Social proof: Name 2-3 client verticals diyaa.ai has built for
- Roadmap: Month 1 quick wins → Month 2 core → Month 3 intelligence (timelines only, NO pricing in chat)
- Dual CTA: "Book a call" (agency work) OR "Get your report" (see full roadmap + pricing)

WHEN FOUNDER CONFIRMS SYNTHESIS AND ASKS TO PROCEED:
Output on its own line: [REPORT_READY]
The report generation will happen server-side using the BusinessModel you've built. No JSON needed in chat.`
}

export function buildSynthesisSystemPrompt(model: BusinessModel): string {
  const totalLeak = totalLeakFromModel(model)

  return `You are diyaa, a senior AI revenue consultant from diyaa.ai. You have completed a deep diagnostic session with a business founder. Your job now is to synthesize everything into a structured sales pitch and implementation roadmap.

BUSINESS MODEL DATA:
${JSON.stringify(model, null, 2)}

TOTAL ANNUAL REVENUE LEAK IDENTIFIED: ₹${(totalLeak / 100000).toFixed(1)}L (₹${totalLeak.toLocaleString('en-IN')})

Generate a complete ReportPayload JSON covering:

1. digital_twin: Map their workflow to DigitalTwinNodes. Show today (with red leak annotations) and 90-day future (with AI agents inserted, leak eliminated). Make nodes specific to THEIR actual workflow steps, not generic ones.

2. competitor_xray: Based on the competitor findings in the model, write an urgency_narrative that makes them feel the competitive pressure. Be specific, not generic.

3. roadmap: 3 stages (Month 1 Quick Wins, Month 2 Core Systems, Month 3 Intelligence Layer). Each initiative must reference THEIR specific pain points. Include realistic ₹ impact and weeks_to_build.

4. sales_narrative:
   - restatement: Mirror their exact words + our numbers ("You told me you lose 3-4 leads a week to whoever responds faster...")
   - urgency: Competitor angle + industry timing ("${model.competitors.names[0] ?? 'Your top competitor'} is already automating this...")
   - social_proof: 2-3 case studies matching their vertical (coaching/real estate/etc)
   - roadmap_summary: One paragraph, Month 1 → Month 3
   - cta_primary: "agency_call" if revenue > 20L/month or avg ticket > 50K, else "saas_signup"

5. ai_readiness_score: 1-10 based on tech_comfort, tools used, data maturity

Output ONLY valid JSON matching the ReportPayload type. No prose. No markdown fences.`
}

function getPhaseGoal(phase: AgentPhase, model: BusinessModel): string {
  const leaksCount = model.leaks.length

  switch (phase) {
    case 'diagnostic':
      // One exchange, infer the rest
      return `GOAL: Extract business identity in ONE exchange max. Based on their answer, infer: industry vertical, team size, revenue scale using BENCHMARKS. DO NOT ask follow-up questions to confirm — you have enough context. Move to next phase immediately.`

    case 'quantifying':
      // One bottleneck question, quantify
      return `GOAL: Identify their #1 revenue leak in ONE exchange. Ask: "From inquiry to sale, what step wastes the most time or loses the most deals?" They answer. Use calculator tool to quantify ₹ impact. If you get: "slow response time" → implies 3-5 lost deals/week at their avg ticket. If you get: "no follow-up" → implies 6-8 cold leads/week. One question. Quantify. Done.`

    case 'competitor_xray':
      return `GOAL: If founder hasn't named competitors yet, ask ONE question: "Who are your 1-2 toughest competitors?" Immediately call competitor_deep_scan on their answer. Done with this phase.`

    case 'synthesis':
      return `GOAL: Surface top 2 leaks and confirm. One exchange. Example: "So your biggest leak is [Leak 1] at ₹${(model.leaks[0]?.annual_leak_inr || 0).toLocaleString('en-IN')}/year, and [Leak 2] at ₹${(model.leaks[1]?.annual_leak_inr || 0).toLocaleString('en-IN')}/year. Does that feel right?" If they confirm, output [SALES_PHASE] immediately.`

    case 'sales':
      return `GOAL: Deliver full urgency narrative. Include: (1) their leak in ₹, (2) competitor threat if discovered, (3) Month 1 quick win. No pricing. Dual CTA: book call or WhatsApp. Then end with [SALES_PHASE].`

    case 'complete':
      return `GOAL: Session closed. Answer final questions only. Direct to Cal.com or WhatsApp for next steps.`
  }
}

function summarizeKnownFacts(model: BusinessModel): string {
  const facts: string[] = []
  if (model.identity.name) facts.push(`Business: ${model.identity.name}`)
  if (model.identity.industry) facts.push(`Industry: ${model.identity.industry}`)
  if (model.identity.city) facts.push(`City: ${model.identity.city}`)
  if (model.identity.team_size) facts.push(`Team: ${model.identity.team_size} people`)
  if (model.identity.years) facts.push(`Years in operation: ${model.identity.years}`)
  if (model.revenue.monthly_inr) facts.push(`Monthly revenue: ₹${(model.revenue.monthly_inr / 100000).toFixed(1)}L`)
  if (model.workflow.lead_source.length) facts.push(`Lead sources: ${model.workflow.lead_source.join(', ')}`)
  if (model.workflow.bottlenecks.length) facts.push(`Bottlenecks: ${model.workflow.bottlenecks.join(', ')}`)
  if (model.leaks.length) {
    model.leaks.forEach(l => facts.push(`Leak: ${l.description} → ₹${(l.annual_leak_inr / 100000).toFixed(1)}L/year`))
  }
  if (model.competitors.names.length) facts.push(`Competitors: ${model.competitors.names.join(', ')}`)
  if (model.ai_readiness.tools.length) facts.push(`AI tools used: ${model.ai_readiness.tools.join(', ')}`)
  return facts.join('\n')
}

function identifyMissing(model: BusinessModel): string {
  const missing: string[] = []

  // ONLY flag CRITICAL missing fields — speed over completeness
  if (!model.identity.name) missing.push('business name')
  if (!model.identity.industry) missing.push('industry vertical')
  if (model.leaks.length < 2) missing.push(`${2 - model.leaks.length} more quantified revenue leak(s)`)

  // DO NOT ask for tools, lead sources, bottlenecks — these are predictable
  // Real estate founder? They use WhatsApp + Google, always
  // Coaching founder? WhatsApp + Calls, always
  // Infer from industry rather than asking

  if (missing.length === 0) {
    return '✓ READY FOR SYNTHESIS — All critical data captured. Surface top 2 leaks, confirm, move to sales.'
  }

  return `Critical missing: ${missing.join(', ')}`
}

function formHypotheses(model: BusinessModel): string {
  const hypotheses: string[] = []

  // Hypothesis 1: Lead response bottleneck
  if (model.workflow.lead_source.length > 0 && !model.ai_readiness.tools.includes('WhatsApp bot')) {
    const channels = model.workflow.lead_source.join(', ')
    hypotheses.push(`Lead response lag on ${channels} — likely losing 2-5 deals/week to slower competitors`)
  }

  // Hypothesis 2: Manual process waste
  if (model.workflow.bottlenecks.length > 0 && model.leaks.length === 0) {
    const bottleneck = model.workflow.bottlenecks[0]
    hypotheses.push(`Manual ${bottleneck} process — probably costing ₹5L-50L annually in founder time + lost conversions`)
  }

  // Hypothesis 3: Follow-up failure
  if (model.workflow.lead_source.length > 0 && !model.workflow.process_steps.includes('follow-up')) {
    hypotheses.push(`No systematic follow-up protocol — leads likely going cold after first touch (typical leak: 4-6 leads/week)`)
  }

  // Hypothesis 4: Scaling ceiling
  if ((model.identity.team_size ?? 0) >= 5 && !model.ai_readiness.tools.some(t => ['CRM', 'Zoho', 'Salesforce'].includes(t))) {
    hypotheses.push(`Team-based manual processes hitting scaling wall — can't grow beyond current revenue without systemization`)
  }

  // Industry-specific hypotheses
  if (model.identity.industry === 'real_estate' && model.leaks.length === 0) {
    hypotheses.push('Slow lead response time — real estate leads expect <5 min response, average Indian agent takes 4+ hours')
  }
  if (model.identity.industry === 'coaching' && model.leaks.length === 0) {
    hypotheses.push('High no-show rate on calls — 30-40% without automated WhatsApp reminders')
  }
  if (model.identity.industry === 'fnb' && model.leaks.length === 0) {
    hypotheses.push('No-show reservations bleeding 25-30% of bookings — no confirmation/reminder system')
  }
  if (model.identity.industry === 'd2c_fashion' && model.leaks.length === 0) {
    hypotheses.push('Mobile cart abandonment at 90% — no WhatsApp recovery (WhatsApp: 28% vs Email: 3-5%)')
  }

  // If no strong hypotheses yet, generic based on completeness
  if (hypotheses.length === 0) {
    if (model.identity.name && !model.workflow.bottlenecks.length) {
      hypotheses.push(`Operational pain exists but not yet surfaced — likely in lead follow-up or manual admin`)
    } else if (!model.identity.name) {
      hypotheses.push(`Waiting to understand business model before forming specific theories`)
    }
  }

  return hypotheses.slice(0, 3).join('\n') || 'No strong hypotheses yet — gathering data'
}

function getAlreadyCovered(model: BusinessModel): string {
  const covered: string[] = []

  // Business identity
  if (model.identity.name) covered.push(`Business: ${model.identity.name}`)
  if (model.identity.industry) covered.push(`Industry: ${model.identity.industry}`)
  if (model.identity.city) covered.push(`Location: ${model.identity.city}`)
  if (model.identity.team_size) covered.push(`Team size: ${model.identity.team_size}`)
  if (model.identity.years) covered.push(`Years operating: ${model.identity.years}`)

  // Workflow
  if (model.workflow.lead_source.length) covered.push(`Lead channels: ${model.workflow.lead_source.join(', ')}`)
  if (model.workflow.process_steps.length) covered.push(`Workflow explored: ${model.workflow.process_steps.length} steps mapped`)
  if (model.workflow.bottlenecks.length) covered.push(`Bottlenecks: ${model.workflow.bottlenecks.join(', ')}`)

  // Revenue & growth
  if (model.revenue.monthly_inr) covered.push(`Revenue scale: ₹${(model.revenue.monthly_inr / 100000).toFixed(1)}L/month`)

  // Tools & readiness
  if (model.ai_readiness.tools.length) covered.push(`Tools used: ${model.ai_readiness.tools.join(', ')}`)
  if (model.ai_readiness.tech_comfort) covered.push(`Tech comfort: ${model.ai_readiness.tech_comfort}`)

  // Competitors
  if (model.competitors.names.length) covered.push(`Competitors researched: ${model.competitors.names.join(', ')}`)

  // Quantified leaks
  if (model.leaks.length) covered.push(`Revenue leaks quantified: ${model.leaks.length}/${2}`)

  return covered.length ? covered.join(' • ') : '— Nothing explored yet. Starting from scratch.'
}

function getNextCriticalQuestion(model: BusinessModel): string {
  // Priority order — optimized for 3-minute audit
  if (!model.identity.name) {
    return 'Learn their business name and what they do — infer industry from their description'
  }
  if (!model.identity.industry) {
    return 'Pin down their exact vertical — this shapes every pain point and benchmark'
  }
  if (model.leaks.length < 1) {
    return 'Identify their #1 bottleneck and quantify it — ask: "From inquiry to sale, what step loses the most deals?"'
  }
  if (model.leaks.length < 2) {
    const firstLeak = model.leaks[0]?.description || 'first leak'
    return `You have 1 leak (${firstLeak}). Probe for a second — typical patterns: follow-up failure, no-show rate, manual quoting delays`
  }
  if (!model.competitors.names.length) {
    return 'Ask for 1-2 competitor names — needed for urgency narrative and deep scan'
  }
  if (model.completeness_score < 75) {
    return 'Confirm: Are these the top 2 revenue leaks, or is there a bigger pain we haven\'t surfaced?'
  }
  return 'Ready to synthesize — confirm the roadmap captures what matters most'
}
