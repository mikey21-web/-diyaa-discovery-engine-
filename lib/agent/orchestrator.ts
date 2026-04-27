import Groq from 'groq-sdk'
import type { ChatCompletionTool } from 'groq-sdk/resources/chat/completions'
import { logger } from '../logger'
import { loadBusinessModel, saveBusinessModel, mergeModel } from './businessModel'
import { buildDiagnosticSystemPrompt, buildSynthesisSystemPrompt } from './prompts'
import { ALL_TOOL_SCHEMAS, executeTool } from './tools/index'
import { AgentPhase, AgentTurnResult, BusinessModel, ReportPayload } from './types'
import { createClient } from '@supabase/supabase-js'

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const MAX_TOOL_ROUNDS = 3
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000
const AGENT_TURN_TIMEOUT_MS = 30 * 1000
const HISTORY_WINDOW = 10 // max conversation turns sent to model (older turns pruned)

// Track rate-limited keys with expiry
const rateLimitedKeys = new Map<string, number>()

// Convert Anthropic Tool format to Groq/OpenAI ChatCompletionTool format
function convertToolsForGroq(tools: typeof ALL_TOOL_SCHEMAS): ChatCompletionTool[] {
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

function getAvailableGroqKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < 5; i++) {
    const key = i === 0
      ? process.env.GROQ_API_KEY
      : process.env[`GROQ_API_KEY_${i}`]
    if (key) keys.push(key)
  }
  if (keys.length === 0) throw new Error('No GROQ_API_KEY configured')
  return keys
}

function getGroqClientWithKey(): { client: Groq; key: string } {
  const allKeys = getAvailableGroqKeys()
  const now = Date.now()

  // Filter out rate-limited keys that haven't cooled down yet
  const availableKeys = allKeys.filter(key => {
    const limitedUntil = rateLimitedKeys.get(key)
    if (!limitedUntil || limitedUntil < now) {
      rateLimitedKeys.delete(key)
      return true
    }
    return false
  })

  // If all keys are rate limited, throw error with 429 status
  if (availableKeys.length === 0) {
    logger.error('All Groq API keys are rate limited', { totalKeys: allKeys.length })
    const error = new Error('All Groq API keys are rate limited')
    ;(error as any).status = 429
    throw error
  }

  // Pick random available key
  const randomIndex = Math.floor(Math.random() * availableKeys.length)
  const key = availableKeys[randomIndex]
  logger.info('Selected Groq key', { available: availableKeys.length, total: allKeys.length })
  return { client: new Groq({ apiKey: key }), key }
}

function markKeyRateLimited(key: string): void {
  const cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS
  rateLimitedKeys.set(key, cooldownUntil)
  logger.warn('Marked Groq key as rate limited', { cooldownMs: RATE_LIMIT_COOLDOWN_MS })
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

  // Cap history sent to model — Llama degrades past ~8K tokens of conversation
  const cappedHistory = updatedHistory.length > HISTORY_WINDOW * 2
    ? updatedHistory.slice(-(HISTORY_WINDOW * 2))
    : updatedHistory

  const systemPrompt = buildDiagnosticSystemPrompt(model, phase)
  // Injected at end of messages — Llama pays attention to start AND end
  const tailReminder = 'REMINDER: ONE question only in your response. Start with a diagnosis or ₹/% figure, never a greeting. 4 sentences max.'
  const toolCallsMade: string[] = []
  let currentModel = { ...model }

  const { client, key: groqKey } = getGroqClientWithKey()
  let loopHistory = [...cappedHistory]
  let finalReply = ''
  let reportReady = false
  let salesPhaseTriggered = false
  let groqCallCount = 0

  try {
    let toolRound = 0
    while (toolRound < MAX_TOOL_ROUNDS) {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...loopHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        { role: 'system' as const, content: tailReminder },
      ]

      const groqStart = Date.now()
      const response = await client.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 512,
        temperature: 0.3,
        top_p: 0.9,
        tools: convertToolsForGroq(ALL_TOOL_SCHEMAS),
        tool_choice: 'auto',
        messages: messages as any,
      })
      groqCallCount++
      const groqTime = Date.now() - groqStart
      if (!timings.groq) timings.groq = 0
      timings.groq += groqTime
      logger.info('Groq call completed', { sessionId, round: toolRound, durationMs: groqTime, groqCallCount })

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
      markKeyRateLimited(groqKey)
      logger.warn('Groq rate limit/quota hit, marking key as limited', { status: error.status, key: groqKey })
      throw new Error('Groq API rate limited — trying another key on next request')
    }
    logger.error('Groq API error', { error: error.message, status: error.status })
    throw err
  }

  // Phase advancement logic
  let newPhase: AgentPhase = phase
  let reportPayload: ReportPayload | undefined

  if (reportReady) {
    newPhase = 'complete'
  } else if (
    // Auto-trigger report when we have enough data (3-minute audit fast path)
    currentModel.completeness_score >= 75 &&
    currentModel.leaks.length >= 2 &&
    phase !== 'complete'
  ) {
    newPhase = 'complete'
    reportReady = true
    logger.info('Auto-triggered report generation', {
      sessionId,
      completeness: currentModel.completeness_score,
      leaks: currentModel.leaks.length,
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
    reportPayload = await runGroqSynthesis(sessionId, currentModel)
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
    groqCallCount,
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

async function runGroqSynthesis(sessionId: string, model: BusinessModel): Promise<ReportPayload> {
  const { client, key: groqKey } = getGroqClientWithKey()

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
      model: GROQ_MODEL,
      max_tokens: 4000,
      temperature: 0.1,
      top_p: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the complete ReportPayload JSON now.' },
      ] as any,
    })
  } catch (err) {
    const error = err as { status?: number; message?: string }
    if (error.status === 429 || error.status === 402) {
      markKeyRateLimited(groqKey)
      logger.warn('Synthesis hit rate limit, marked key', { status: error.status })
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
