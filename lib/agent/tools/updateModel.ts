import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { BusinessModel } from '../types'

export interface UpdateModelInput {
  business_name?: string
  industry?: 'real_estate' | 'hospitality' | 'd2c_fashion' | 'coaching' | 'fnb' | 'healthcare' | 'logistics' | 'retail' | 'general'
  city?: string
  team_size?: number
  years_in_operation?: number
  avg_ticket_inr?: number
  monthly_revenue_inr?: number
  lead_sources?: string[]
  tools?: string[]
  process_steps?: string[]
  bottlenecks?: string[]
  response_time_minutes?: number
  weekly_leads?: number
  no_show_rate_pct?: number
  repeat_rate_pct?: number
  payment_completion_rate_pct?: number
  stage_conversion_pct?: number
  follow_up_attempts?: number
  owner_follow_up?: string
  owner_lead_response?: string
  tech_comfort?: 'low' | 'medium' | 'high'
  budget_signal?: 'low' | 'medium' | 'high'
  constraints?: string[]
}

export function applyUpdateModelPatch(input: UpdateModelInput, model: BusinessModel): Partial<BusinessModel> {
  const patch: Partial<BusinessModel> = {}

  // Identity — only overwrite if not already set (first stated value wins)
  const identityPatch: Partial<BusinessModel['identity']> = {}
  if (input.business_name && !model.identity.name) identityPatch.name = input.business_name
  if (input.industry && !model.identity.industry) identityPatch.industry = input.industry
  if (input.city && !model.identity.city) identityPatch.city = input.city
  if (input.team_size && !model.identity.team_size) identityPatch.team_size = input.team_size
  if (input.years_in_operation && !model.identity.years) identityPatch.years = input.years_in_operation
  if (Object.keys(identityPatch).length > 0) patch.identity = identityPatch

  // Revenue — only overwrite if not already set
  if (input.avg_ticket_inr && !model.revenue.avg_ticket_inr) {
    patch.revenue = { ...(patch.revenue ?? {}), avg_ticket_inr: input.avg_ticket_inr, confidence: 'stated' }
  }
  if (input.monthly_revenue_inr && !model.revenue.monthly_inr) {
    patch.revenue = { ...(patch.revenue ?? {}), monthly_inr: input.monthly_revenue_inr, confidence: 'stated' }
  }

  // Workflow — additive
  if (input.lead_sources?.length || input.process_steps?.length || input.bottlenecks?.length) {
    patch.workflow = {
      lead_source: input.lead_sources ?? [],
      process_steps: input.process_steps ?? [],
      bottlenecks: input.bottlenecks ?? [],
    }
  }

  // Tools — additive
  if (input.tools?.length) {
    patch.ai_readiness = {
      tools: input.tools,
      tech_comfort: model.ai_readiness.tech_comfort,
      budget_signal: model.ai_readiness.budget_signal,
    }
  }

  // Stage metrics — additive, overwrite individual fields
  const sm: Record<string, number> = {}
  if (input.response_time_minutes != null) sm.response_time_minutes = input.response_time_minutes
  if (input.weekly_leads != null) sm.weekly_leads = input.weekly_leads
  if (input.no_show_rate_pct != null) sm.no_show_rate_pct = input.no_show_rate_pct
  if (input.repeat_rate_pct != null) sm.repeat_rate_pct = input.repeat_rate_pct
  if (input.payment_completion_rate_pct != null) sm.payment_completion_rate_pct = input.payment_completion_rate_pct
  if (input.stage_conversion_pct != null) sm.stage_conversion_pct = input.stage_conversion_pct
  if (input.follow_up_attempts != null) sm.follow_up_attempts = input.follow_up_attempts
  if (Object.keys(sm).length > 0) patch.stage_metrics = sm

  // Ownership
  const own: Record<string, string> = {}
  if (input.owner_follow_up) own.follow_up = input.owner_follow_up
  if (input.owner_lead_response) own.lead_response = input.owner_lead_response
  if (Object.keys(own).length > 0) patch.owner_by_step = own

  // Readiness signals
  if (input.tech_comfort || input.budget_signal) {
    patch.ai_readiness = {
      tools: patch.ai_readiness?.tools ?? model.ai_readiness.tools,
      tech_comfort: input.tech_comfort ?? (patch.ai_readiness?.tech_comfort ?? model.ai_readiness.tech_comfort),
      budget_signal: input.budget_signal ?? (patch.ai_readiness?.budget_signal ?? model.ai_readiness.budget_signal),
    }
  }

  // Constraints
  if (input.constraints?.length) patch.constraints = input.constraints

  return patch
}

export const updateModelToolSchema: Tool = {
  name: 'update_business_model',
  description: `Extract and store structured business facts from the founder's last message.
Call this FIRST on every founder reply — before generating your response.
Only include fields where you have clear evidence from their exact words.
Never guess. Never infer without explicit founder confirmation. If unsure, omit the field.
This is called silently — do not mention it, do not say "I'm updating my notes".`,
  input_schema: {
    type: 'object' as const,
    properties: {
      business_name: {
        type: 'string',
        description: 'Company or brand name if explicitly mentioned by the founder',
      },
      industry: {
        type: 'string',
        enum: ['real_estate', 'hospitality', 'd2c_fashion', 'coaching', 'fnb', 'healthcare', 'logistics', 'retail', 'general'],
        description: 'Industry vertical — only set if clearly evident from what they described',
      },
      city: {
        type: 'string',
        description: 'Primary city or market they operate in (e.g. Hyderabad, Dubai, Pune)',
      },
      team_size: {
        type: 'number',
        description: 'Number of people in the business — use exact number if stated',
      },
      years_in_operation: {
        type: 'number',
        description: 'Years the business has been running',
      },
      avg_ticket_inr: {
        type: 'number',
        description: 'Average deal, order, or booking value in INR — convert if they use L/Cr shorthand (1L = 100000)',
      },
      monthly_revenue_inr: {
        type: 'number',
        description: 'Monthly revenue in INR — convert L/Cr if needed',
      },
      lead_sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Channels leads arrive through (e.g. WhatsApp, Instagram, referrals, walk-ins, Google Ads)',
      },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Software or platforms the team uses day-to-day (e.g. WhatsApp, Zoho CRM, Google Sheets, Calendly)',
      },
      process_steps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Named steps in their customer journey they described (e.g. Lead capture, First response, Site visit, Booking, Payment)',
      },
      bottlenecks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific pain points or manual steps they said slow them down — use their words, not generic labels',
      },
      response_time_minutes: {
        type: 'number',
        description: 'Minutes it takes them to respond to an inquiry — convert hours to minutes',
      },
      weekly_leads: {
        type: 'number',
        description: 'Number of leads or inquiries per week',
      },
      no_show_rate_pct: {
        type: 'number',
        description: 'Percentage of booked appointments or sessions that are no-shows',
      },
      repeat_rate_pct: {
        type: 'number',
        description: 'Percentage of customers who buy again',
      },
      payment_completion_rate_pct: {
        type: 'number',
        description: 'Percentage of payment attempts that complete',
      },
      stage_conversion_pct: {
        type: 'number',
        description: 'Lead to paying customer conversion rate as a percentage',
      },
      follow_up_attempts: {
        type: 'number',
        description: 'How many follow-up messages or calls the team currently makes per lead',
      },
      owner_follow_up: {
        type: 'string',
        description: 'Who is responsible for follow-up today (e.g. founder, sales manager, nobody, front desk)',
      },
      owner_lead_response: {
        type: 'string',
        description: 'Who responds to incoming leads (e.g. founder, sales team, reception, nobody)',
      },
      tech_comfort: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'How comfortable the team is with software — infer from what they described',
      },
      budget_signal: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Willingness to invest in tools or automation — infer from context',
      },
      constraints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Practical limits they mentioned: small team, tight budget, seasonal business, owner does everything, compliance requirements',
      },
    },
    required: [],
  },
}
