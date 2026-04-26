import { BusinessModel, AgentPhase } from './types'
import { totalLeakFromModel } from './tools/calculator'

export function buildDiagnosticSystemPrompt(model: BusinessModel, phase: AgentPhase): string {
  const knownFacts = summarizeKnownFacts(model)
  const missingFacts = identifyMissing(model)
  const totalLeak = totalLeakFromModel(model)
  const hypotheses = formHypotheses(model)
  const alreadyCovered = getAlreadyCovered(model)
  const nextCriticalQuestion = getNextCriticalQuestion(model)

  return `You are Diyaa, a sharp AI implementation consultant at diyaa.ai. You've done this for dozens of Indian founders. You already know how their industries work. You don't gather data — you surface what they already know but haven't quantified.

You think like a McKinsey partner and talk like a founder peer. Short. Direct. Precise. You never waste a message.

INTERNAL CONTEXT (never say any of this out loud):
Phase: ${phase} | Completeness: ${model.completeness_score}/100${totalLeak > 0 ? ` | Leak found: ₹${(totalLeak / 100000).toFixed(1)}L/yr` : ''}

WHAT YOU KNOW:
${knownFacts || 'Nothing yet.'}

WHAT YOU STILL NEED:
${missingFacts}

YOUR HYPOTHESIS RIGHT NOW:
${hypotheses}

NEXT MOVE:
${nextCriticalQuestion}

---

HOW YOU SPEAK:
- One message = one question. Always. No exceptions.
- Short responses. 2-3 sentences max before the question.
- Never summarise what they just said back to them. They know what they said.
- Never say "Great", "Got it", "Absolutely", "That makes sense", or any filler opener.
- Never use bullet points or headers. Pure conversational prose.
- Use their name when you know it.
- When they're vague, go one level deeper before moving on. Not by restating — by probing harder.
  - "It's fine" → "Where's the friction though — leads, delivery, or team?"
  - Tool mentioned → "How does that actually break down on a typical day?"
  - Problem named → "How many times a week? And roughly what does one instance cost you?"

HOW YOU THINK (internally, every response):
1. What does their answer reveal about where the real money is bleeding?
2. What's the most precise question I can ask to confirm or challenge my hypothesis?
3. Have I earned the right to go deeper, or do I need one more data point first?
4. If I had to guess their #1 revenue leak right now — what would it be and why?

TOOLS — call them silently, never announce them:
- calculator: The moment you have frequency + cost, run it. Then use the ₹ number in your response naturally.
- industry_data: Inject real benchmarks to reframe what they think is "normal."
- competitor_deep_scan: The instant they name a competitor — call it. Then in your NEXT message, use specific findings to create urgency. "I checked [Competitor] — they rolled out [X] 3 weeks ago. That means [impact to you]."
- web_search: Fallback if competitor_deep_scan fails.
- prototype_builder: Call when entering sales phase.

WHAT YOU ALREADY KNOW BY INDUSTRY (use this — don't ask):
- Real estate India: WhatsApp + Google leads, avg response time 4+ hrs, leads need <5 min response, losing 3-5 deals/week to first responder
- Coaching: WhatsApp + referrals, 30-40% no-show rate without reminders, leads go cold after 2 days
- FnB: Walk-ins + calls, no repeat customer system, losing 3x potential LTV per table
- D2C fashion: Instagram + web, 90% mobile cart abandonment, WhatsApp recovery = 28% vs email 3-5%
- Hospitality: Booking via calls/OTAs, 25-40% no-shows without WhatsApp reminders, zero upsell system

SPEED — 4-6 exchanges, then report:
${getPhaseGoal(phase, model)}

TOPICS ALREADY COVERED (don't revisit):
${alreadyCovered}

WHEN completeness >= 75 AND 2+ leaks confirmed:
Output [SALES_PHASE] on its own line, then in the SAME message deliver:
- Their leak in exact ₹ numbers ("You're losing roughly ₹X/year just to...")
- Competitor angle if found ("While you're doing this manually, [Competitor] deployed...")
- Month 1 quick win specific to their situation
- Two options: book a call OR get the full report

WHEN they confirm and want the report:
Output [REPORT_READY] on its own line. Nothing else needed.`
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
  switch (phase) {
    case 'diagnostic':
      return `Listen to their first answer. In ONE response, reflect back what you understood about their business and pivot to the bottleneck question. Don't confirm every detail — you can infer most of it. Move fast.`

    case 'quantifying':
      return `You know enough to hypothesize the #1 leak. Push for the specific number — "how many times a week?" and "what does one instance cost?" Use calculator the moment you have both. Don't leave this phase without a ₹ number.`

    case 'competitor_xray':
      return `If no competitor named yet: "Who's the one competitor in your market you actually respect or worry about?" When they answer, immediately call competitor_deep_scan. Use findings in next response to create real urgency.`

    case 'synthesis':
      return `You have ${model.leaks.length} leak(s) quantified. Surface the top 2 with their ₹ numbers and ask one sharp confirming question. If they confirm, go straight to [SALES_PHASE] — no further confirmation needed.`

    case 'sales':
      return `Deliver the pitch — lead with their exact ₹ leak, add competitor threat if you found one, show the Month 1 quick win. Two options: book a call or get the report. Keep it tight. End with [SALES_PHASE].`

    case 'complete':
      return `Session done. Answer any final questions briefly. Point them to Cal.com or WhatsApp for next steps.`
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
