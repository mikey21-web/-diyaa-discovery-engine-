// ========================================
// diyaa.ai — Core Type Definitions
// ========================================

export type VerticalKey =
  | 'real_estate'
  | 'hospitality'
  | 'd2c_fashion'
  | 'coaching'
  | 'fnb'
  | 'healthcare'
  | 'logistics'
  | 'education'
  | 'manufacturing'
  | 'marketing_agency'
  | 'professional_services'
  | 'recruitment'
  | 'ca_firm'
  | 'legal'
  | 'auto'
  | 'salon'
  | 'travel'
  | 'interior'
  | 'wealth_management'
  | 'hr_tech'
  | 'retail'
  | 'tech_startup'
  | 'other'

export type RevenueRange =
  | 'under_5L'
  | '5L_20L'
  | '20L_50L'
  | '50L_1Cr'
  | 'above_1Cr'

export type SessionStatus = 'active' | 'complete' | 'report_generated'
export type TechComfort = 'low' | 'medium' | 'high'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted'
export type ConversationPhase = 1 | 2 | 3 | 4 | 5 | 6

export interface RevenueLeak {
  description: string
  frequency_per_week: number
  estimated_cost_inr: number
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface BusinessInfo {
  name: string
  industry: VerticalKey
  city: string
  team_size: number
  years_in_operation: number
  monthly_revenue_range: RevenueRange
}

export interface PriorityImplementation {
  title: string
  layer: string
  description: string
  before: string
  after: string
  hours_saved_per_week: number
  revenue_impact_inr_per_year: number
  build_complexity: string
  time_to_value: string
}

export interface InfraItem {
  title: string
  what_it_does: string
  impact: string
}

export interface SessionState {
  id: string
  created_at: string
  status: SessionStatus
  phase: ConversationPhase

  business: BusinessInfo

  tools_used: string[]
  lead_sources: string[]
  sales_cycle_days: number
  manual_processes: string[]

  revenue_leaks: RevenueLeak[]

  current_ai_tools: string[]
  ai_readiness_score: number
  tech_comfort: TechComfort

  conversation_history: ConversationMessage[]

  report_id: string | null
  lead_captured: boolean
}

export interface ExtractedData {
  // v5.0 fields
  business_name?: string
  business?: string
  industry: string
  city?: string | null
  team_size?: number
  ai_readiness_score?: number
  top_pain_point?: string
  current_fire?: string
  coming_fire?: string
  revenue_leak_inr_per_year?: number
  hours_wasted_per_week?: number
  realization_moment?: string
  confidence_score?: number
  confidence_note?: string
  revenue_leak_breakdown?: Array<{ label: string, value: string }>
  roadmap?: Array<{
    stage: string
    title: string
    agent: string
    what_it_does: string
    build_time: string
    monthly_value_inr: number
    confidence_score: number
  }>
  before_after?: {
    today?: string
    in_90_days?: string
  }
  conversation_summary?: string
  uday_briefing?: string

  // Legacy v4.0 fields (backward compat)
  monthly_revenue_range?: string
  tools_used?: string[]
  lead_sources?: string[]
  sales_cycle_days?: number
  manual_processes?: string[]
  revenue_leaks?: RevenueLeak[]
  current_ai_tools?: string[]
  tech_comfort?: TechComfort
  top_pain_points?: string[]
  key_insights?: string[]
}

// API Request/Response types
export interface CreateSessionResponse {
  session_id: string
  created_at: string
  opening_message: string
}

export interface ChatRequest {
  session_id: string
  message: string
}

export interface ChatResponse {
  reply: string
  phase: number
  report_ready: boolean
  report_id?: string
}

export interface ReportRequest {
  session_id: string
}

export interface ReportResponse {
  report_id: string
  report_url: string
}

export interface LeadRequest {
  session_id: string
  name: string
  email?: string
  whatsapp: string
}

export interface LeadResponse {
  success: boolean
  report_id?: string
}

export interface ApiError {
  error: string
  code: string
}
