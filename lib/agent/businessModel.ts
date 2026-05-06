import { createClient } from '@supabase/supabase-js'
import { BusinessModel, EMPTY_BUSINESS_MODEL } from './types'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function loadBusinessModel(sessionId: string): Promise<BusinessModel> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('business_models')
    .select('model')
    .eq('session_id', sessionId)
    .single()

  if (!data) return structuredClone(EMPTY_BUSINESS_MODEL)
  return data.model as BusinessModel
}

export async function saveBusinessModel(sessionId: string, model: BusinessModel): Promise<void> {
  const supabase = getServiceClient()
  const score = scoreCompleteness(model)
  model.completeness_score = score

  await supabase.from('business_models').upsert(
    {
      session_id: sessionId,
      model,
      completeness_score: score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' }
  )
}

export function mergeModel(base: BusinessModel, patch: Partial<BusinessModel>): BusinessModel {
  const merged: BusinessModel = structuredClone(base)

  if (patch.identity) Object.assign(merged.identity, patch.identity)
  if (patch.revenue) Object.assign(merged.revenue, patch.revenue)
  if (patch.workflow) {
    merged.workflow.lead_source = dedup([...merged.workflow.lead_source, ...(patch.workflow.lead_source ?? [])])
    merged.workflow.process_steps = dedup([...merged.workflow.process_steps, ...(patch.workflow.process_steps ?? [])])
    merged.workflow.bottlenecks = dedup([...merged.workflow.bottlenecks, ...(patch.workflow.bottlenecks ?? [])])
  }
  if (patch.leaks?.length) merged.leaks = [...merged.leaks, ...patch.leaks]
  if (patch.competitors) {
    merged.competitors.names = dedup([...merged.competitors.names, ...(patch.competitors.names ?? [])])
    if (patch.competitors.xray_findings?.length)
      merged.competitors.xray_findings = [...merged.competitors.xray_findings, ...patch.competitors.xray_findings]
  }
  if (patch.ai_readiness) {
    merged.ai_readiness.tools = dedup([...merged.ai_readiness.tools, ...(patch.ai_readiness.tools ?? [])])
    if (patch.ai_readiness.tech_comfort) merged.ai_readiness.tech_comfort = patch.ai_readiness.tech_comfort
    if (patch.ai_readiness.budget_signal) merged.ai_readiness.budget_signal = patch.ai_readiness.budget_signal
  }
  if (patch.hypotheses?.length) merged.hypotheses = [...merged.hypotheses, ...patch.hypotheses]
  if (patch.diagnoses?.length) merged.diagnoses = [...merged.diagnoses, ...patch.diagnoses]
  if (patch.actions?.length) merged.actions = [...merged.actions, ...patch.actions]
  if (patch.channel_mix) merged.channel_mix = { ...(merged.channel_mix ?? {}), ...patch.channel_mix }
  if (patch.stage_metrics) merged.stage_metrics = { ...(merged.stage_metrics ?? {}), ...patch.stage_metrics }
  if (patch.owner_by_step) merged.owner_by_step = { ...(merged.owner_by_step ?? {}), ...patch.owner_by_step }
  if (patch.constraints?.length) merged.constraints = dedup([...(merged.constraints ?? []), ...patch.constraints])

  merged.completeness_score = scoreCompleteness(merged)
  return merged
}

export async function seedBusinessModel(sessionId: string, industry: string): Promise<void> {
  const supabase = getServiceClient()
  const model = structuredClone(EMPTY_BUSINESS_MODEL)
  model.identity.industry = industry
  model.completeness_score = scoreCompleteness(model)
  await supabase.from('business_models').upsert(
    { session_id: sessionId, model, completeness_score: model.completeness_score, updated_at: new Date().toISOString() },
    { onConflict: 'session_id' }
  )
}

export function scoreCompleteness(model: BusinessModel): number {
  let score = 0

  // Identity (15 pts) — name and years are nice-to-have, not diagnostic
  if (model.identity.industry) score += 7
  if (model.identity.city) score += 3
  if (model.identity.team_size) score += 3
  if (model.identity.name) score += 1
  if (model.identity.years) score += 1

  // Revenue (15 pts) — avg ticket is more diagnostic than monthly revenue
  if (model.revenue.avg_ticket_inr) score += 10
  if (model.revenue.monthly_inr) score += 5

  // Workflow (20 pts) — lead source + process steps matter most
  if (model.workflow.lead_source.length >= 1) score += 7
  if (model.workflow.process_steps.length >= 2) score += 7
  if (model.workflow.bottlenecks.length >= 1) score += 6

  // Stage metrics (15 pts) — these are the real diagnostic evidence
  const sm = model.stage_metrics ?? {}
  const smKeys = Object.keys(sm).length
  if (smKeys >= 1) score += 5
  if (smKeys >= 2) score += 5
  if (smKeys >= 3) score += 5

  // Leaks quantified (20 pts) — the actual output of a good diagnostic
  if (model.leaks.length >= 1) score += 8
  if (model.leaks.length >= 2) score += 7
  if (model.leaks.length >= 3) score += 5

  // Operating context (10 pts)
  if (model.ai_readiness.tools.length >= 1) score += 4
  if (model.owner_by_step && Object.keys(model.owner_by_step).length > 0) score += 4
  if (model.ai_readiness.tech_comfort !== 'low') score += 2

  // Intelligence layer (5 pts)
  if (model.competitors.names.length >= 1) score += 2
  if (model.diagnoses.length >= 1) score += 2
  if (model.actions.length >= 1) score += 1

  return Math.min(100, score)
}

function dedup(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)))
}
