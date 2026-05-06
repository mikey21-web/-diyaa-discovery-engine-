import OpenAI from 'openai'
import type { Chat } from 'openai/resources/chat'
import { logger } from '../logger'
import { loadBusinessModel, saveBusinessModel, mergeModel } from './businessModel'
import { buildDiagnosticSystemPrompt, buildSynthesisSystemPrompt } from './prompts'
import { ALL_TOOL_SCHEMAS, executeTool } from './tools/index'
import { AgentPhase, AgentTurnResult, BusinessModel, ReportPayload } from './types'
import { extractBusinessModelPatchFromMessage } from './extractor'
import { createClient } from '@supabase/supabase-js'

const MODEL = 'gpt-4o'
const MAX_TOOL_ROUNDS = 3
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000
const AGENT_TURN_TIMEOUT_MS = 30 * 1000
const HISTORY_WINDOW = 10 // max conversation turns sent to model (older turns pruned)
const MIN_DIAGNOSIS_EVIDENCE = 2
const MIN_DIAGNOSIS_CONFIDENCE = 0.65
const MIN_EVIDENCE_COMPLETENESS = 60 // 0-100 — report blocked below this threshold

// Convert Anthropic Tool format to OpenAI ChatCompletionTool format
function convertToolsForOpenAI(tools: typeof ALL_TOOL_SCHEMAS): Chat.ChatCompletionTool[] {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema as Record<string, unknown>,
    },
  }))
}

type MessageParam = { role: 'user' | 'assistant' | 'system'; content: string }

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

async function getSessionPhase(sessionId: string): Promise<AgentPhase> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('sessions')
    .select('agent_phase')
    .eq('id', sessionId)
    .single()
  return (data?.agent_phase as AgentPhase) ?? 'diagnostic'
}

async function setSessionPhase(sessionId: string, phase: AgentPhase): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('sessions').update({ agent_phase: phase }).eq('id', sessionId)
}

function validateTranscriptConsistency(model: BusinessModel): Array<{ field: string; conflict: string }> {
  const conflicts: Array<{ field: string; conflict: string }> = []

  // Check weekly_leads consistency
  const weeklyLeads = model.stage_metrics?.weekly_leads
  const responseTime = model.stage_metrics?.response_time_minutes
  if (weeklyLeads && responseTime) {
    if (weeklyLeads > 100 && responseTime > 480) {
      conflicts.push({
        field: 'lead_volume',
        conflict: `${weeklyLeads} leads/week but ${responseTime}min response time (2+ hours). High volume + slow response = contradiction.`,
      })
    }
  }

  // Check follow-up vs conversion
  const followUp = model.stage_metrics?.follow_up_attempts
  const conversion = model.stage_metrics?.stage_conversion_pct
  if (followUp && conversion) {
    if (followUp >= 7 && conversion < 2) {
      conflicts.push({
        field: 'follow_up_cadence',
        conflict: `${followUp} follow-up attempts but ${conversion}% conversion. If following up this aggressively, conversion should be higher.`,
      })
    }
  }

  // Check no-show vs repeat rate
  const noShow = model.stage_metrics?.no_show_rate_pct
  const repeat = model.stage_metrics?.repeat_rate_pct
  if (noShow && repeat && noShow > 30 && repeat > 50) {
    conflicts.push({
      field: 'customer_reliability',
      conflict: `${noShow}% no-show rate but ${repeat}% repeat rate. High no-shows contradict high repeat bookings.`,
    })
  }

  // Check revenue metrics
  if (model.revenue.avg_ticket_inr && model.revenue.monthly_inr) {
    const avgTicket = model.revenue.avg_ticket_inr
    const monthlyRev = model.revenue.monthly_inr
    const impliedTransactions = monthlyRev / avgTicket
    if (impliedTransactions < 10) {
      // Low transaction count, check if weekly_leads makes sense
      const weeklyLeads = model.stage_metrics?.weekly_leads
      if (weeklyLeads && weeklyLeads > 50) {
        conflicts.push({
          field: 'lead_conversion',
          conflict: `${weeklyLeads} weekly leads but implied ₹${monthlyRev} ÷ ₹${avgTicket} = ${impliedTransactions.toFixed(0)} transactions/month. Conversion rate doesn't match.`,
        })
      }
    }
  }

  return conflicts
}

async function getConversationHistory(sessionId: string): Promise<MessageParam[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('sessions')
    .select('conversation_history')
    .eq('id', sessionId)
    .single()
  return (data?.conversation_history as MessageParam[]) ?? []
}

async function appendHistory(
  sessionId: string,
  history: MessageParam[]
): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from('sessions')
    .update({ conversation_history: history, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}

async function runAgentTurnInternal(
  sessionId: string,
  userMessage: string
): Promise<AgentTurnResult> {
  const turnStartTime = Date.now()
  const timings: Record<string, number> = {}

  const loadStart = Date.now()
  const [model, history, phase] = await Promise.all([
    loadBusinessModel(sessionId),
    getConversationHistory(sessionId),
    getSessionPhase(sessionId),
  ])
  timings.load = Date.now() - loadStart

  const updatedHistory: MessageParam[] = [
    ...history,
    { role: 'user', content: userMessage },
  ]
  const extractedPatch = extractBusinessModelPatchFromMessage(userMessage, model)
  let currentModel = mergeModel(model, extractedPatch)

  // Cap history sent to model
  const cappedHistory = updatedHistory.length > HISTORY_WINDOW * 2
    ? updatedHistory.slice(-(HISTORY_WINDOW * 2))
    : updatedHistory

  // Injected at end of messages
  const tailReminder = 'REMINDER: ONE question only in your response. Start with a diagnosis or ₹/% figure, never a greeting. 4 sentences max.'
  const toolCallsMade: string[] = []

  const client = getOpenAIClient()
  let loopHistory = [...cappedHistory]
  let finalReply = ''
  let reportReady = false
  let salesPhaseTriggered = false
  let openaiCallCount = 0

  try {
    let toolRound = 0
    while (toolRound < MAX_TOOL_ROUNDS) {
      const messages = [
        { role: 'system' as const, content: buildDiagnosticSystemPrompt(currentModel, phase) },
        ...loopHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        { role: 'system' as const, content: tailReminder },
      ]

      const openaiStart = Date.now()
      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 512,
        temperature: 0.7,
        tools: convertToolsForOpenAI(ALL_TOOL_SCHEMAS),
        tool_choice: 'auto',
        messages: messages as any,
      })
      openaiCallCount++
      const openaiTime = Date.now() - openaiStart
      if (!timings.openai) timings.openai = 0
      timings.openai += openaiTime
      logger.info('OpenAI call completed', { sessionId, round: toolRound, durationMs: openaiTime, openaiCallCount })

      const message = response.choices[0]?.message
      const content = message?.content ?? ''

      // Add assistant response to history
      loopHistory.push({
        role: 'assistant',
        content: content,
      })

      // Check for report signals — match with or without brackets
      const hasReportReady = content.includes('[REPORT_READY]') || /\bREPORT_READY\b/.test(content)
      const hasSalesPhase = content.includes('[SALES_PHASE]') || /\bSALES_PHASE\b/.test(content)

      if (hasReportReady) {
        reportReady = true
        finalReply = content.replace(/\[?REPORT_READY\]?/g, '').trim()
        break
      } else if (hasSalesPhase) {
        salesPhaseTriggered = true
        finalReply = content.replace(/\[?SALES_PHASE\]?/g, '').trim()
        break
      }

      // Handle tool calls (Groq uses OpenAI format)
      const toolCalls = (message?.tool_calls ?? []) as Array<{ type: string; function: { name: string; arguments: string }; id: string }>
      if (toolCalls.length === 0) {
        finalReply = content
        break
      }

      // Execute each tool and collect results
      let competitorFindingsForWeaving: string[] = []

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue

        toolCallsMade.push(toolCall.function.name)
        const input = JSON.parse(toolCall.function.arguments)
        const toolStart = Date.now()
        const toolResult = await executeTool(toolCall.function.name, input, currentModel)
        const toolTime = Date.now() - toolStart
        if (!timings.tools) timings.tools = 0
        timings.tools += toolTime
        logger.info('Tool execution completed', { sessionId, tool: toolCall.function.name, durationMs: toolTime })

        // Apply model patch if tool returned one
        if (toolResult.model_patch) {
          currentModel = mergeModel(currentModel, toolResult.model_patch)
        }

        // If this is competitor_deep_scan, capture findings for urgency narrative
        if (toolCall.function.name === 'competitor_deep_scan') {
          const scanResult = toolResult.output as Record<string, any>
          if (scanResult?.finding) {
            const finding = scanResult.finding
            const signals: string[] = [
              ...(finding.strengths || []),
              ...(finding.weaknesses || []),
            ]
            if (finding.ai_usage) signals.push(finding.ai_usage)
            competitorFindingsForWeaving = [
              ...competitorFindingsForWeaving,
              ...signals,
            ]
          }
        }

        // Add tool result to history
        loopHistory.push({
          role: 'user',
          content: `Tool result for ${toolCall.function.name}: ${JSON.stringify(toolResult.output)}`,
        })
      }

      // If we just discovered competitor findings, weave them into the next prompt
      if (competitorFindingsForWeaving.length > 0) {
        const competitorUrgency = `
COMPETITOR FINDINGS JUST DISCOVERED:
${competitorFindingsForWeaving.map(f => `- ${f}`).join('\n')}

In your NEXT response, weave these findings into an urgency narrative. Example:
"I just checked their website and found they deployed a WhatsApp bot 3 weeks ago with 5-min response time. You're at 2-3 hours. That's likely costing you 3-5 deals a week."

Make the founder feel the competitive pressure. Be specific, not generic.`

        loopHistory.push({
          role: 'user',
          content: competitorUrgency,
        })

        try {
          const supabase = getServiceClient()
          await supabase
            .from('sessions')
            .update({ competitor_findings: competitorFindingsForWeaving })
            .eq('id', sessionId)
        } catch (e) {
          // ignore errors
        }
      }

      toolRound++
    }
  } catch (err) {
    const error = err as { status?: number; message?: string }
    if (error.status === 429 || error.status === 402) {
      logger.warn('OpenAI rate limit/quota hit', { status: error.status })
      throw new Error('OpenAI API rate limited — please try again in a moment')
    }
    logger.error('Groq API error', { error: error.message, status: error.status })
    throw err
  }

  // Phase advancement logic
  let newPhase: AgentPhase = phase
  let reportPayload: ReportPayload | undefined
  const inferredDiagnoses = inferDiagnoses(currentModel)
  const hasConfidentDiagnosis = inferredDiagnoses.some(
    (diagnosis) => diagnosis.confidence >= MIN_DIAGNOSIS_CONFIDENCE
  )
  const hasFounderContext = hasMinimumFounderContext(currentModel)
  const evidenceCompleteness = computeEvidenceCompleteness(currentModel)
  const evidenceSufficient = evidenceCompleteness >= MIN_EVIDENCE_COMPLETENESS

  if ((reportReady || salesPhaseTriggered) && (!hasConfidentDiagnosis || !hasFounderContext || !evidenceSufficient)) {
    reportReady = false
    salesPhaseTriggered = false
    finalReply = buildLowConfidenceFollowup(inferredDiagnoses, currentModel)
    logger.info('Suppressed finalize signal due to low confidence or thin context', {
      sessionId,
      hasFounderContext,
      evidenceCompleteness,
      evidenceSufficient,
    })
  }

  if (reportReady) {
    newPhase = 'complete'
  } else if (
    // Auto-trigger report when we have enough data (3-minute audit fast path)
    currentModel.completeness_score >= 75 &&
    currentModel.leaks.length >= 2 &&
    hasConfidentDiagnosis &&
    hasFounderContext &&
    evidenceSufficient &&
    phase !== 'complete'
  ) {
    newPhase = 'complete'
    reportReady = true
    logger.info('Auto-triggered report generation', {
      sessionId,
      completeness: currentModel.completeness_score,
      leaks: currentModel.leaks.length,
      hasFounderContext,
    })
  } else if (salesPhaseTriggered) {
    newPhase = 'sales'
  } else if (currentModel.completeness_score >= 50 && currentModel.competitors.names.length > 0) {
    newPhase = 'competitor_xray'
  } else if (currentModel.completeness_score >= 40) {
    newPhase = 'quantifying'
  }

  // Unified synthesis trigger: run when report is ready or synthesis is needed
  if ((reportReady || newPhase === 'complete' || (salesPhaseTriggered && phase !== 'complete')) && !reportPayload) {
    const synthesisStart = Date.now()
    reportPayload = await runOpenAISynthesis(sessionId, currentModel)
    timings.synthesis = Date.now() - synthesisStart
    newPhase = 'complete'
    reportReady = true
    logger.info('Synthesis completed', { sessionId, durationMs: timings.synthesis })
  }

  const finalHistory: MessageParam[] = [
    ...updatedHistory,
    { role: 'assistant', content: finalReply },
  ]

  const saveStart = Date.now()
  currentModel.diagnoses = inferredDiagnoses
  currentModel.actions = inferActions(currentModel, inferredDiagnoses)
  await Promise.all([
    saveBusinessModel(sessionId, currentModel),
    appendHistory(sessionId, finalHistory),
    setSessionPhase(sessionId, newPhase),
  ])
  timings.save = Date.now() - saveStart

  const totalTime = Date.now() - turnStartTime
  logger.info('Agent turn completed', {
    sessionId,
    totalMs: totalTime,
    breakdown: timings,
    reportReady,
    openaiCallCount,
  })

  return {
    reply: finalReply || "Tell me more.",
    updated_model: currentModel,
    phase: newPhase,
    report_ready: reportReady,
    report_payload: reportPayload,
    tool_calls_made: toolCallsMade,
  }
}

async function runOpenAISynthesis(sessionId: string, model: BusinessModel): Promise<ReportPayload> {
  const client = getOpenAIClient()

  // Populate model from conversation if missing
  if (!model.identity.name || model.completeness_score === 0) {
    const supabase = getServiceClient()
    const { data } = await supabase
      .from('sessions')
      .select('conversation_history')
      .eq('id', sessionId)
      .single()

    const history = (data?.conversation_history as MessageParam[]) ?? []
    populateModelFromHistory(model, history)
  }

  const systemPrompt = buildSynthesisSystemPrompt(model)

  let response
  try {
    response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the complete ReportPayload JSON now.' },
      ] as any,
    })
  } catch (err) {
    const error = err as { status?: number; message?: string }
    if (error.status === 429 || error.status === 402) {
      logger.warn('Synthesis hit rate limit', { status: error.status })
    }
    throw err
  }

  const raw = response.choices[0]?.message?.content ?? '{}'
  const cleaned = raw.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim()

  let parsed: Partial<ReportPayload>
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    logger.error('Report synthesis JSON parse failed', { error: (err as Error).message })
    parsed = {}
  }

  return buildReportPayload(sessionId, model, parsed)
}

function populateModelFromHistory(model: BusinessModel, history: MessageParam[]): void {
  const convo = history.map(m => m.content).join('\n')

  // Generic pattern extraction (fallback if tools didn't populate)
  if (!model.identity.team_size) {
    const teamMatch = convo.match(/(\d+)\s+(people|person|team members|staff|employees)/)
    if (teamMatch) model.identity.team_size = parseInt(teamMatch[1])
  }

  if (!model.ai_readiness.tools.length) {
    const toolMatches = convo.match(/(WhatsApp|Gmail|Google Sheets|Zoom|Slack|Notion|Airtable|Salesforce|HubSpot)/gi)
    if (toolMatches) {
      const uniqueTools = Array.from(new Set(toolMatches.map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())))
      model.ai_readiness.tools = uniqueTools
    }
  }

  // Ensure minimum score for synthesis to work
  if (model.completeness_score < 50) {
    model.completeness_score = 50
  }
}

async function buildReportPayload(
  sessionId: string,
  model: BusinessModel,
  extracted: Partial<ReportPayload>
): Promise<ReportPayload> {
  // Build competitor findings from xray_findings for the report
  const competitorFindings = model.competitors.xray_findings?.length
    ? [{
        name: model.competitors.names[0] || 'Competitor',
        findings: model.competitors.xray_findings.map(f =>
          typeof f === 'string' ? f : `${f.name}: ${f.strengths?.join(', ') || f.ai_usage || 'competitor signal'}`
        ),
        urgency_score: Math.min(10, 5 + (model.competitors.xray_findings?.length || 0)),
      }]
    : undefined

  const payload: ReportPayload = {
    session_id: sessionId,
    business_model: model,
    digital_twin: extracted.digital_twin ?? {
      today_nodes: [],
      future_nodes: [],
      total_annual_leak_inr: model.leaks.reduce((s, l) => s + l.annual_leak_inr, 0),
      projected_annual_save_inr: Math.round(
        model.leaks.reduce((s, l) => s + l.annual_leak_inr, 0) * 0.7
      ),
    },
    competitor_xray: extracted.competitor_xray ?? {
      competitors: model.competitors.xray_findings,
      urgency_narrative: model.competitors.names.length
        ? `${model.competitors.names[0]} is already investing in automation. Every week without AI costs you ground.`
        : 'Your market is moving toward AI adoption. First movers capture disproportionate share.',
    },
    roadmap: extracted.roadmap ?? [],
    sales_narrative: extracted.sales_narrative ?? {
      restatement: 'Based on our conversation, here is what we found.',
      urgency: 'The window to move first is closing.',
      social_proof: 'diyaa.ai has helped similar businesses cut response times and grow revenue.',
      roadmap_summary: 'Month 1: Quick wins. Month 2: Core automation. Month 3: Intelligence layer.',
      cta_primary: 'agency_call',
    },
    ai_readiness_score: computeReadinessScore(model),
    generated_at: new Date().toISOString(),
    // Feature 2: Interactive prototype URL
    prototype_html_url: `${process.env.NEXT_PUBLIC_APP_URL}/report/${sessionId}/interactive`,
    // Feature 1: Structured competitor findings
    competitor_findings: competitorFindings,
  }

  const supabase = getServiceClient()
  await supabase.from('reports').upsert(
    {
      session_id: sessionId,
      share_url: `${process.env.NEXT_PUBLIC_APP_URL}/report/${sessionId}`,
      prototype_html_url: payload.prototype_html_url,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' }
  )

  await supabase
    .from('sessions')
    .update({ extracted_data: payload, status: 'report_generated' })
    .eq('id', sessionId)

  return payload
}

function computeReadinessScore(model: BusinessModel): number {
  let score = 0
  if (model.ai_readiness.tools.length > 0) score += 2
  if (model.ai_readiness.tools.length > 2) score += 1
  if (model.ai_readiness.tech_comfort === 'medium') score += 2
  if (model.ai_readiness.tech_comfort === 'high') score += 3
  if (model.ai_readiness.budget_signal === 'medium') score += 1
  if (model.ai_readiness.budget_signal === 'high') score += 2
  if (model.workflow.lead_source.includes('WhatsApp')) score += 1
  if ((model.identity.team_size ?? 0) >= 5) score += 1
  return Math.min(10, score)
}

function inferDiagnoses(model: BusinessModel): BusinessModel['diagnoses'] {
  const now = new Date().toISOString()
  const diagnoses: BusinessModel['diagnoses'] = []
  const leakEvidence = model.leaks.map((leak) => ({
    fact: `${leak.description}: ₹${leak.annual_leak_inr.toLocaleString('en-IN')}/year`,
    source: 'tool' as const,
    timestamp: now,
    strength: leak.confidence === 'calculated' ? 0.85 : 0.65,
  }))
  const workflowEvidence = model.workflow.bottlenecks.map((bottleneck) => ({
    fact: `Workflow bottleneck: ${bottleneck}`,
    source: 'conversation' as const,
    timestamp: now,
    strength: 0.65,
  }))
  const evidencePool = [...leakEvidence, ...workflowEvidence]

  const hypothesisRules: Array<{
    hypothesis: BusinessModel['diagnoses'][number]['hypothesis']
    keywords: RegExp
    unknowns: string[]
    disprovers: string[]
  }> = [
    {
      hypothesis: 'lead_response',
      keywords: /(lead|response|inquiry|inbound|callback)/i,
      unknowns: ['Need measured response-time baseline and lead volume'],
      disprovers: ['Median first response time under 5 minutes over 30 days'],
    },
    {
      hypothesis: 'no_show',
      keywords: /(no[- ]?show|reminder|missed appointment|didn.?t attend)/i,
      unknowns: ['Need booked-vs-attended baseline for 30 days'],
      disprovers: ['No-show rate consistently under 8%'],
    },
    {
      hypothesis: 'follow_up',
      keywords: /(follow[- ]?up|cold lead|reactivat|ghosted|no response)/i,
      unknowns: ['Need follow-up attempts per lead by stage'],
      disprovers: ['At least 5 follow-up attempts on 80%+ of leads'],
    },
    {
      hypothesis: 'stage_conversion',
      keywords: /(conversion|drop[- ]?off|proposal|booking to payment|stage)/i,
      unknowns: ['Need stage-level conversion percentages'],
      disprovers: ['Stage conversion rates within target benchmark range'],
    },
    {
      hypothesis: 'payment_dropoff',
      keywords: /(payment|checkout|abandon|failed transaction|upi)/i,
      unknowns: ['Need payment initiated vs completed ratio'],
      disprovers: ['Payment completion above 90%'],
    },
    {
      hypothesis: 'fulfillment_delay',
      keywords: /(delivery|fulfillment|handoff|ops delay|sla breach)/i,
      unknowns: ['Need fulfillment SLA baseline and breach frequency'],
      disprovers: ['Fulfillment SLA breached less than 5% of the time'],
    },
  ]

  for (const rule of hypothesisRules) {
    const matchedEvidence = evidencePool.filter((item) => rule.keywords.test(item.fact))
    if (matchedEvidence.length < MIN_DIAGNOSIS_EVIDENCE) continue

    const calculatedEvidenceCount = matchedEvidence.filter((item) => item.source === 'tool').length
    const confidence = Math.min(
      0.9,
      0.45 + matchedEvidence.length * 0.1 + calculatedEvidenceCount * 0.08
    )

    diagnoses.push({
      hypothesis: rule.hypothesis,
      confidence: Math.round(confidence * 100) / 100,
      evidence: matchedEvidence.slice(0, 4),
      unknowns: confidence >= MIN_DIAGNOSIS_CONFIDENCE ? [] : rule.unknowns,
      disprovers: rule.disprovers,
    })
  }

  return diagnoses.sort((a, b) => b.confidence - a.confidence).slice(0, 3)
}

function inferActions(
  model: BusinessModel,
  diagnoses: BusinessModel['diagnoses']
): BusinessModel['actions'] {
  const confidentDiagnoses = diagnoses.filter(
    (diagnosis) => diagnosis.confidence >= MIN_DIAGNOSIS_CONFIDENCE
  )
  if (confidentDiagnoses.length === 0) return []

  const totalLeak = model.leaks.reduce((sum, leak) => sum + leak.annual_leak_inr, 0)
  const monthlyLeak = Math.round(totalLeak / 12)
  const hasLeadResponseDiagnosis = confidentDiagnoses.some((d) => d.hypothesis === 'lead_response')
  const hasNoShowDiagnosis = confidentDiagnoses.some((d) => d.hypothesis === 'no_show')
  const hasFollowUpDiagnosis = confidentDiagnoses.some((d) => d.hypothesis === 'follow_up')

  const actions: BusinessModel['actions'] = []
  if (hasLeadResponseDiagnosis) {
    actions.push({
      action_id: 'sla_nudge_whatsapp',
      expected_impact_inr: Math.round(monthlyLeak * 0.2),
      time_to_value_days: 7,
      risk: 'low',
    })
  }
  if (hasNoShowDiagnosis) {
    actions.push({
      action_id: 'no_show_reminder_flow',
      expected_impact_inr: Math.round(monthlyLeak * 0.15),
      time_to_value_days: 10,
      risk: 'low',
    })
  }
  if (hasFollowUpDiagnosis || actions.length === 0) {
    actions.push({
      action_id: 'lost_lead_reactivation',
      expected_impact_inr: Math.round(monthlyLeak * 0.25),
      time_to_value_days: 14,
      risk: 'medium',
    })
  }
  return actions
}

function buildLowConfidenceFollowup(
  diagnoses: BusinessModel['diagnoses'],
  model: BusinessModel
): string {
  const missingContextQuestion = getMissingContextQuestion(model)
  if (missingContextQuestion) {
    return missingContextQuestion
  }

  const topDiagnosis = diagnoses[0]
  const unknown =
    topDiagnosis?.unknowns?.[0] ??
    'I still need one concrete operational metric to avoid a generic recommendation'
  return `Confidence is still below 65%, so I will not finalize a diagnosis yet. ${unknown}. What is the weekly frequency and approximate ₹ impact of this issue?`
}

function computeEvidenceCompleteness(model: BusinessModel): number {
  let score = 0

  // Business shape — 3 pts
  if (model.identity.industry) score += 1
  if (model.revenue.avg_ticket_inr || model.revenue.monthly_inr) score += 1
  if (model.identity.team_size || model.identity.city) score += 1

  // Funnel math — 3 pts (this is the diagnostic core)
  if (model.stage_metrics && Object.keys(model.stage_metrics).length >= 1) score += 1
  if (model.stage_metrics && Object.keys(model.stage_metrics).length >= 2) score += 1
  if (model.workflow.lead_source.length > 0) score += 1

  // Operating context — 2 pts
  if (model.ai_readiness.tools.length > 0) score += 1
  if (model.owner_by_step && Object.keys(model.owner_by_step).length > 0) score += 1

  // Leaks quantified — 2 pts
  if (model.leaks.length >= 1) score += 1
  if (model.leaks.length >= 2) score += 1

  // Transcript consistency check — -1 per conflict
  const conflicts = validateTranscriptConsistency(model)
  score = Math.max(0, score - conflicts.length)

  return Math.round((score / 10) * 100)
}

function hasMinimumFounderContext(model: BusinessModel): boolean {
  const hasBusinessShape = Boolean(
    model.identity.industry &&
    (model.revenue.avg_ticket_inr || model.revenue.monthly_inr) &&
    (model.identity.team_size || model.identity.city)
  )
  const hasFunnelMath = Boolean(
    model.workflow.lead_source.length > 0 &&
    model.workflow.process_steps.length > 0 &&
    ((model.stage_metrics && Object.keys(model.stage_metrics).length > 0) || model.leaks.length > 0)
  )
  const hasOperatingContext = Boolean(
    model.workflow.bottlenecks.length > 0 &&
    model.ai_readiness.tools.length > 0 &&
    model.owner_by_step &&
    Object.keys(model.owner_by_step).length > 0
  )
  const hasConstraintContext = Boolean(
    model.ai_readiness.tech_comfort !== 'low' ||
    model.ai_readiness.budget_signal !== 'low' ||
    (model.constraints && model.constraints.length > 0)
  )

  return hasBusinessShape && hasFunnelMath && hasOperatingContext && hasConstraintContext
}

function getMissingContextQuestion(model: BusinessModel): string | null {
  if (!model.identity.industry) {
    return 'Industry context is still thin, so I will not finalize a generic audit. What exactly does the business sell, and to whom?'
  }

  if (!model.revenue.avg_ticket_inr && !model.revenue.monthly_inr) {
    return 'Revenue context is still too thin for a founder-grade recommendation. What is your typical deal value or monthly revenue range?'
  }

  if (!model.workflow.lead_source.length) {
    return 'Acquisition context is missing, so the diagnosis would still be generic. Which channels bring most of your leads today?'
  }

  if (!model.stage_metrics || Object.keys(model.stage_metrics).length === 0) {
    return 'I still need one operating metric before I trust the diagnosis. What is the current response time, no-show rate, repeat rate, or payment completion rate?'
  }

  if (!model.ai_readiness.tools.length) {
    return 'The workflow stack is still unclear. What tools does the team already use today: WhatsApp, CRM, Google Sheets, booking software, or something else?'
  }

  if (!model.owner_by_step || Object.keys(model.owner_by_step).length === 0) {
    return 'Execution ownership is still unclear. Who owns follow-up or the step where leads are slipping today?'
  }

  if (!model.constraints || model.constraints.length === 0) {
    return 'I can see the leak, but not yet the implementation reality. What is the main constraint: budget, bandwidth, staffing, or tech comfort?'
  }

  return null
}

export async function runAgentTurn(
  sessionId: string,
  userMessage: string
): Promise<AgentTurnResult> {
  return Promise.race([
    runAgentTurnInternal(sessionId, userMessage),
    new Promise<AgentTurnResult>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Agent turn timeout after ${AGENT_TURN_TIMEOUT_MS}ms`)),
        AGENT_TURN_TIMEOUT_MS
      )
    ),
  ])
}
