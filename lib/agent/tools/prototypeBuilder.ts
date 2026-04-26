import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { BusinessModel } from '../types'

export interface BotConfig {
  instance_name: string
  welcome_message: string
  fallback_message: string
  persona_name: string
  business_context: string
  industry: string
  capabilities: string[]
  escalation_phrase: string
  language: 'en' | 'hi' | 'hinglish'
  flows: BotFlow[]
}

export interface BotFlow {
  trigger_keywords: string[]
  response_template: string
  collect_fields?: string[]
}

export function buildBotConfigFromModel(model: BusinessModel): BotConfig {
  const industry = model.identity.industry ?? 'general'
  const businessName = model.identity.name ?? 'this business'
  const persona = derivePersona(industry)

  const flows = buildFlows(industry, businessName, model)

  return {
    instance_name: `diyaa-sandbox-${Date.now()}`,
    welcome_message: buildWelcome(businessName, industry, model),
    fallback_message: `I'll connect you with the team at ${businessName} shortly. For urgent queries, reply URGENT.`,
    persona_name: persona,
    business_context: buildBusinessContext(model),
    industry,
    capabilities: deriveCapabilities(model),
    escalation_phrase: 'HUMAN',
    language: 'hinglish',
    flows,
  }
}

function buildWelcome(name: string, industry: string, model: BusinessModel): string {
  const templates: Record<string, string> = {
    real_estate: `Hi! I'm the AI assistant for ${name}. Looking for a property? Tell me your budget and preferred location and I'll find your best options instantly.`,
    hospitality: `Welcome to ${name}! I can help you check room availability, make a booking, or answer any questions. What brings you here today?`,
    coaching: `Hi! I help with enquiries for ${name}. Interested in our programs? Tell me what you're looking to achieve and I'll match you with the right option.`,
    fnb: `Hey! Welcome to ${name}. Want to place an order, reserve a table, or check our menu? Just tell me what you need!`,
    healthcare: `Hello! I'm the assistant for ${name}. Need to book an appointment or have a health query? I'm here to help.`,
    default: `Hi! I'm the AI assistant for ${name}. How can I help you today?`,
  }

  const key = normalizeIndustryKey(industry)
  return templates[key] ?? templates.default
}

function buildBusinessContext(model: BusinessModel): string {
  const parts = [
    model.identity.name ? `Business: ${model.identity.name}` : '',
    model.identity.industry ? `Industry: ${model.identity.industry}` : '',
    model.identity.city ? `Location: ${model.identity.city}` : '',
    model.workflow.lead_source.length
      ? `Lead sources: ${model.workflow.lead_source.join(', ')}`
      : '',
    model.workflow.bottlenecks.length
      ? `Key pain points: ${model.workflow.bottlenecks.join(', ')}`
      : '',
  ]
  return parts.filter(Boolean).join('. ')
}

function deriveCapabilities(model: BusinessModel): string[] {
  const caps = ['Answer FAQs', 'Capture lead information', 'Escalate to human agent']
  const industry = normalizeIndustryKey(model.identity.industry ?? '')

  if (['real_estate', 'hospitality', 'coaching'].includes(industry)) {
    caps.push('Schedule appointment or site visit')
  }
  if (['fnb', 'retail'].includes(industry)) {
    caps.push('Take orders and process requests')
  }
  if (model.workflow.bottlenecks.some(b => b.toLowerCase().includes('follow'))) {
    caps.push('Automated follow-up sequences')
  }

  return caps
}

function buildFlows(industry: string, businessName: string, model: BusinessModel): BotFlow[] {
  const key = normalizeIndustryKey(industry)
  const baseFlows: BotFlow[] = [
    {
      trigger_keywords: ['price', 'cost', 'rate', 'how much', 'kitna'],
      response_template: `Our pricing depends on your specific requirements. Can you tell me more about what you're looking for? I'll get you an exact quote.`,
    },
    {
      trigger_keywords: ['location', 'address', 'where', 'kahan'],
      response_template: `We operate in ${model.identity.city ?? 'your city'}. Would you like to schedule a visit or call?`,
    },
    {
      trigger_keywords: ['contact', 'call', 'speak', 'human', 'team'],
      response_template: `I'll connect you with our team right away. Please share your name and phone number and someone will call you within 30 minutes.`,
      collect_fields: ['name', 'phone'],
    },
  ]

  const industryFlows: Record<string, BotFlow[]> = {
    real_estate: [
      {
        trigger_keywords: ['flat', 'apartment', 'villa', 'plot', 'property', 'buy', 'rent'],
        response_template: `Great! I can help you find the perfect property. What's your budget range and preferred location? Also, are you looking to buy or rent?`,
        collect_fields: ['budget', 'location', 'intent'],
      },
      {
        trigger_keywords: ['visit', 'site visit', 'tour', 'see property'],
        response_template: `I'll arrange a site visit for you. When are you free? We have slots available this week.`,
        collect_fields: ['preferred_date', 'name', 'phone'],
      },
    ],
    coaching: [
      {
        trigger_keywords: ['course', 'program', 'batch', 'join', 'enroll'],
        response_template: `Interested in joining ${businessName}? Tell me your current situation and what you're trying to achieve — I'll recommend the right program.`,
        collect_fields: ['goal', 'experience_level'],
      },
    ],
    hospitality: [
      {
        trigger_keywords: ['room', 'book', 'available', 'check in', 'checkin'],
        response_template: `I'll check availability for you! What dates are you looking at and how many guests?`,
        collect_fields: ['check_in', 'check_out', 'guests'],
      },
    ],
  }

  return [...(industryFlows[key] ?? []), ...baseFlows]
}

function derivePersona(industry: string): string {
  const personas: Record<string, string> = {
    real_estate: 'Arya - Property Consultant',
    hospitality: 'Arya - Guest Relations',
    coaching: 'Arya - Program Advisor',
    fnb: 'Arya - Restaurant Assistant',
    healthcare: 'Arya - Patient Care Assistant',
    default: 'Arya - Business Assistant',
  }
  return personas[normalizeIndustryKey(industry)] ?? personas.default
}

function normalizeIndustryKey(raw: string): string {
  const map: Record<string, string> = {
    'real estate': 'real_estate',
    realestate: 'real_estate',
    property: 'real_estate',
    hotel: 'hospitality',
    hotels: 'hospitality',
    restaurant: 'fnb',
    food: 'fnb',
    'f&b': 'fnb',
    fashion: 'retail',
    ecommerce: 'retail',
    coaching: 'coaching',
    education: 'coaching',
    healthcare: 'healthcare',
    clinic: 'healthcare',
  }
  return map[raw.toLowerCase()] ?? raw.toLowerCase().replace(/\s+/g, '_')
}

export const prototypeBuilderToolSchema: Tool = {
  name: 'prototype_builder',
  description:
    'Generate a WhatsApp bot configuration for the founder\'s specific business. Call this during the sales phase after the business model is sufficiently complete (completeness_score >= 60). This creates a sandboxed demo bot they can try immediately.',
  input_schema: {
    type: 'object' as const,
    properties: {
      trigger: {
        type: 'string',
        description: 'Why you are building the prototype now (e.g. "completeness_score reached 75, sales phase")',
      },
    },
    required: ['trigger'],
  },
}
