/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, getOpusClient, callAnthropic } from '../anthropic'
import { loadBusinessModel, saveBusinessModel, mergeModel } from './businessModel'
import { buildDiagnosticSystemPrompt, buildSynthesisSystemPrompt } from './prompts'
import { ALL_TOOL_SCHEMAS, executeTool } from './tools/index'
import { AgentPhase, AgentTurnResult, BusinessModel, ReportPayload } from './types'
import { createClient } from '@supabase/supabase-js'

const SONNET = 'claude-sonnet-4-6'
const OPUS = 'claude-opus-4-7'
const MAX_TOOL_ROUNDS = 5

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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

async function getConversationHistory(sessionId: string): Promise<Anthropic.MessageParam[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('sessions')
    .select('conversation_history')
    .eq('id', sessionId)
    .single()
  return (data?.conversation_history as Anthropic.MessageParam[]) ?? []
}

async function appendHistory(
  sessionId: string,
  history: Anthropic.MessageParam[]
): Promise<void> {
  const supabase = getServiceClient()
  await supabase
    .from('sessions')
    .update({ conversation_history: history, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}

export async function runAgentTurn(
  sessionId: string,
  userMessage: string
): Promise<AgentTurnResult> {
  const [model, history, phase] = await Promise.all([
    loadBusinessModel(sessionId),
    getConversationHistory(sessionId),
    getSessionPhase(sessionId),
  ])

  const updatedHistory: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: userMessage },
  ]

  const systemPrompt = buildDiagnosticSystemPrompt(model, phase)
  const toolCallsMade: string[] = []
  let currentModel = model

  const client = getAnthropicClient()
  let loopHistory = [...updatedHistory]
  let finalReply = ''
  let reportReady = false
  let salesPhaseTriggered = false

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Use 'as any' for cache_control — it's a valid API feature but older SDK typings may not include it
    const systemBlock: any = {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    }

    const response = await callAnthropic(() =>
      client.messages.create({
        model: SONNET,
        max_tokens: 1024,
        system: [systemBlock],
        tools: ALL_TOOL_SCHEMAS,
        messages: loopHistory,
      } as any)
    ) as Anthropic.Message

    const textBlocks = response.content.filter(b => b.type === 'text')
    const currentText = textBlocks.map(b => (b as Anthropic.TextBlock).text).join('')

    if (currentText.includes('[REPORT_READY]')) {
      reportReady = true
      finalReply = currentText.replace('[REPORT_READY]', '').trim()
    } else if (currentText.includes('[SALES_PHASE]')) {
      salesPhaseTriggered = true
      finalReply = currentText.replace('[SALES_PHASE]', '').trim()
    } else {
      finalReply = currentText
    }

    if (response.stop_reason !== 'tool_use') break

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    if (!toolUseBlocks.length) break

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolCall of toolUseBlocks) {
      toolCallsMade.push(toolCall.name)
      const result = await executeTool(
        toolCall.name,
        toolCall.input as Record<string, unknown>,
        currentModel
      )

      if (result.model_patch) {
        currentModel = mergeModel(currentModel, result.model_patch)
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: JSON.stringify(result.output),
      })
    }

    loopHistory = [
      ...loopHistory,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }

  let newPhase: AgentPhase = phase
  if (reportReady) {
    newPhase = 'complete'
  } else if (salesPhaseTriggered || currentModel.completeness_score >= 75) {
    newPhase = 'sales'
  } else if (currentModel.completeness_score >= 50 && currentModel.competitors.names.length > 0) {
    newPhase = 'competitor_xray'
  } else if (currentModel.completeness_score >= 40) {
    newPhase = 'quantifying'
  }

  let reportPayload: ReportPayload | undefined
  if ((salesPhaseTriggered || newPhase === 'sales') && phase !== 'sales' && phase !== 'complete') {
    reportPayload = await runOpusSynthesis(sessionId, currentModel)
    newPhase = 'complete'
    reportReady = true
  }

  if (reportReady && !reportPayload) {
    try {
      const jsonMatch = finalReply.match(/\{[\s\S]+\}/)
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0])
        finalReply = finalReply.replace(jsonMatch[0], '').trim()
        reportPayload = await buildReportPayload(sessionId, currentModel, extracted)
      }
    } catch {
      // non-critical
    }
  }

  const finalHistory: Anthropic.MessageParam[] = [
    ...updatedHistory,
    { role: 'assistant', content: finalReply },
  ]

  await Promise.all([
    saveBusinessModel(sessionId, currentModel),
    appendHistory(sessionId, finalHistory),
    setSessionPhase(sessionId, newPhase),
  ])

  return {
    reply: finalReply || "Tell me more.",
    updated_model: currentModel,
    phase: newPhase,
    report_ready: reportReady,
    report_payload: reportPayload,
    tool_calls_made: toolCallsMade,
  }
}

async function runOpusSynthesis(sessionId: string, model: BusinessModel): Promise<ReportPayload> {
  const client = getOpusClient()
  const systemPrompt = buildSynthesisSystemPrompt(model)

  // Extended thinking is a beta feature — use 'as any' for the 'thinking' param
  const response = await callAnthropic(() =>
    client.messages.create({
      model: OPUS,
      max_tokens: 16000,
      thinking: { type: 'enabled', budget_tokens: 10000 },
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Generate the complete ReportPayload JSON now.' }],
    } as any)
  ) as Anthropic.Message

  const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
  const raw = textBlock?.text ?? '{}'

  const cleaned = raw.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim()
  let parsed: Partial<ReportPayload>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = {}
  }

  return buildReportPayload(sessionId, model, parsed)
}

async function buildReportPayload(
  sessionId: string,
  model: BusinessModel,
  extracted: Partial<ReportPayload>
): Promise<ReportPayload> {
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
      cta_primary: (model.revenue.monthly_inr ?? 0) > 2000000 ? 'agency_call' : 'saas_signup',
    },
    ai_readiness_score: computeReadinessScore(model),
    generated_at: new Date().toISOString(),
  }

  const supabase = getServiceClient()
  await supabase.from('reports').upsert(
    {
      session_id: sessionId,
      share_url: `${process.env.NEXT_PUBLIC_APP_URL}/report/${sessionId}`,
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
