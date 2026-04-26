export type AgentPhase =
  | 'diagnostic'
  | 'quantifying'
  | 'competitor_xray'
  | 'synthesis'
  | 'sales'
  | 'complete'

export type ConfidenceLevel = 'stated' | 'calculated' | 'inferred'

export interface RevenueLeak {
  description: string
  frequency_per_week: number
  cost_per_instance_inr: number
  annual_leak_inr: number
  confidence: ConfidenceLevel
}

export interface Hypothesis {
  theory: string
  evidence_for: string[]
  evidence_against: string[]
  status: 'open' | 'confirmed' | 'rejected'
}

export interface CompetitorFinding {
  name: string
  strengths: string[]
  weaknesses: string[]
  ai_usage: string
  threat_level: 'low' | 'medium' | 'high'
}

export interface BusinessModel {
  identity: {
    name?: string
    industry?: string
    city?: string
    team_size?: number
    years?: number
  }
  revenue: {
    monthly_inr?: number
    avg_ticket_inr?: number
    confidence: ConfidenceLevel
  }
  workflow: {
    lead_source: string[]
    process_steps: string[]
    bottlenecks: string[]
  }
  leaks: RevenueLeak[]
  competitors: {
    names: string[]
    xray_findings: CompetitorFinding[]
  }
  ai_readiness: {
    tools: string[]
    tech_comfort: 'low' | 'medium' | 'high'
    budget_signal: 'low' | 'medium' | 'high'
  }
  hypotheses: Hypothesis[]
  completeness_score: number
}

export const EMPTY_BUSINESS_MODEL: BusinessModel = {
  identity: {},
  revenue: { confidence: 'inferred' },
  workflow: { lead_source: [], process_steps: [], bottlenecks: [] },
  leaks: [],
  competitors: { names: [], xray_findings: [] },
  ai_readiness: { tools: [], tech_comfort: 'low', budget_signal: 'low' },
  hypotheses: [],
  completeness_score: 0,
}

export interface RoadmapStage {
  month: number
  label: string
  initiatives: Array<{
    title: string
    description: string
    impact_inr: number
    weeks_to_build: number
  }>
}

export interface DigitalTwinNode {
  id: string
  label: string
  type: 'process' | 'decision' | 'ai_agent' | 'leak'
  leak_inr_monthly?: number
  ai_replacement?: string
}

export interface DigitalTwinData {
  today_nodes: DigitalTwinNode[]
  future_nodes: DigitalTwinNode[]
  total_annual_leak_inr: number
  projected_annual_save_inr: number
}

export interface CompetitorXRayData {
  competitors: CompetitorFinding[]
  urgency_narrative: string
}

export interface ReportPayload {
  session_id: string
  business_model: BusinessModel
  digital_twin: DigitalTwinData
  competitor_xray: CompetitorXRayData
  roadmap: RoadmapStage[]
  sales_narrative: {
    restatement: string
    urgency: string
    social_proof: string
    roadmap_summary: string
    cta_primary: 'agency_call' | 'saas_signup'
  }
  prototype_id?: string
  prototype_html_url?: string
  ai_readiness_score: number
  generated_at: string
  competitor_findings?: {
    name: string
    findings: string[]
    urgency_score: number
  }[]
}

export interface AgentTurnResult {
  reply: string
  updated_model: BusinessModel
  phase: AgentPhase
  report_ready: boolean
  report_payload?: ReportPayload
  tool_calls_made: string[]
}
