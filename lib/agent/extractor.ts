import type { BusinessModel } from './types'

const CITY_NAMES = [
  'Bangalore', 'Bengaluru', 'Hyderabad', 'Mumbai', 'Delhi', 'New Delhi', 'Gurgaon',
  'Noida', 'Pune', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow',
  'Indore', 'Kochi', 'Coimbatore', 'Visakhapatnam', 'Dubai', 'Abu Dhabi', 'Sharjah',
]

const TOOL_NAMES = [
  'WhatsApp', 'HubSpot', 'Zoho', 'Salesforce', 'Pipedrive', 'Freshsales', 'Google Sheets',
  'Excel', 'Notion', 'Airtable', 'Slack', 'Gmail', 'Outlook', 'Calendly', 'Cal.com',
  'Shopify', 'WooCommerce', 'Razorpay', 'Stripe',
]

const LEAD_SOURCES: Array<{ label: string; pattern: RegExp }> = [
  { label: 'WhatsApp', pattern: /\bwhatsapp\b/i },
  { label: 'Instagram', pattern: /\binstagram|ig\b/i },
  { label: 'Facebook', pattern: /\bfacebook|fb ads?\b/i },
  { label: 'Google Ads', pattern: /\bgoogle ads?|search ads?\b/i },
  { label: 'Website', pattern: /\bwebsite|web site|organic\b/i },
  { label: 'Referrals', pattern: /\breferrals?|word of mouth\b/i },
  { label: 'Walk-ins', pattern: /\bwalk[- ]?ins?\b/i },
  { label: 'Marketplaces', pattern: /\bamazon|flipkart|zomato|swiggy|magicbricks|99acres\b/i },
]

const INDUSTRY_HINTS: Array<{ industry: string; pattern: RegExp }> = [
  { industry: 'real_estate', pattern: /\breal estate|property|properties|broker|builder|apartment|villa|plot\b/i },
  { industry: 'hospitality', pattern: /\bhotel|resort|guest house|staycation|room nights?\b/i },
  { industry: 'd2c_fashion', pattern: /\bd2c|fashion|apparel|clothing|garment|boutique\b/i },
  { industry: 'coaching', pattern: /\bcoaching|course|cohort|mentorship|training\b/i },
  { industry: 'fnb', pattern: /\brestaurant|cafe|food|f&b|cloud kitchen|dining\b/i },
  { industry: 'healthcare', pattern: /\bclinic|hospital|patient|doctor|medical|healthcare\b/i },
  { industry: 'logistics', pattern: /\blogistics|delivery|shipment|courier|fleet\b/i },
  { industry: 'retail', pattern: /\bretail|store|shop|showroom\b/i },
]

export function extractBusinessModelPatchFromMessage(
  message: string,
  currentModel: BusinessModel
): Partial<BusinessModel> {
  const text = message.trim()
  if (!text) return {}

  const patch = {
    identity: {},
    revenue: {},
    workflow: {
      lead_source: [],
      process_steps: [],
      bottlenecks: [],
    },
    competitors: {
      names: [],
      xray_findings: [],
    },
    ai_readiness: {
      tools: [],
    },
    channel_mix: {},
    stage_metrics: {},
    owner_by_step: {},
    constraints: [],
  } as unknown as Partial<BusinessModel>

  const industry = inferIndustry(text)
  if (industry && !currentModel.identity.industry) {
    patch.identity!.industry = industry
  }

  const city = inferCity(text)
  if (city && !currentModel.identity.city) {
    patch.identity!.city = city
  }

  const teamSize = inferTeamSize(text)
  if (teamSize && !currentModel.identity.team_size) {
    patch.identity!.team_size = teamSize
  }

  const years = inferYearsInOperation(text)
  if (years && !currentModel.identity.years) {
    patch.identity!.years = years
  }

  const businessName = inferBusinessName(text)
  if (businessName && !currentModel.identity.name) {
    patch.identity!.name = businessName
  }

  const avgTicket = inferAvgTicket(text)
  if (avgTicket && !currentModel.revenue.avg_ticket_inr) {
    patch.revenue!.avg_ticket_inr = avgTicket
  }

  const monthlyRevenue = inferMonthlyRevenue(text)
  if (monthlyRevenue && !currentModel.revenue.monthly_inr) {
    patch.revenue!.monthly_inr = monthlyRevenue
  }

  const techComfort = inferTechComfort(text)
  if (techComfort) {
    patch.ai_readiness!.tech_comfort = techComfort
  }

  const budgetSignal = inferBudgetSignal(text)
  if (budgetSignal) {
    patch.ai_readiness!.budget_signal = budgetSignal
  }

  for (const source of LEAD_SOURCES) {
    if (source.pattern.test(text)) {
      patch.workflow!.lead_source!.push(source.label)
    }
  }

  for (const toolName of TOOL_NAMES) {
    if (new RegExp(`\\b${escapeForRegex(toolName)}\\b`, 'i').test(text)) {
      patch.ai_readiness!.tools!.push(toolName)
    }
  }

  const ownerSignal = inferOwnerByStep(text)
  if (ownerSignal) {
    patch.owner_by_step![ownerSignal.step] = ownerSignal.owner
  }

  const stageMetrics = inferStageMetrics(text)
  Object.assign(patch.stage_metrics!, stageMetrics)

  const processSteps = inferProcessSteps(text)
  patch.workflow!.process_steps!.push(...processSteps)

  const bottlenecks = inferBottlenecks(text)
  patch.workflow!.bottlenecks!.push(...bottlenecks)

  const channelMix = inferChannelMix(text)
  Object.assign(patch.channel_mix!, channelMix)

  const constraints = inferConstraints(text)
  patch.constraints!.push(...constraints)

  pruneEmptyPatch(patch)
  return patch
}

function inferIndustry(text: string): string | undefined {
  return INDUSTRY_HINTS.find((hint) => hint.pattern.test(text))?.industry
}

function inferCity(text: string): string | undefined {
  const match = CITY_NAMES.find((city) => new RegExp(`\\b${escapeForRegex(city)}\\b`, 'i').test(text))
  return match?.replace(/^Bangalore$/i, 'Bengaluru')
}

function inferTeamSize(text: string): number | undefined {
  const match = text.match(/(?:team|staff|employees?|people)\s*(?:of|is|are)?\s*(\d{1,3})/i)
    ?? text.match(/(\d{1,3})\s*(?:people|employees?|staff|team members)/i)
  return match ? Number(match[1]) : undefined
}

function inferYearsInOperation(text: string): number | undefined {
  const match = text.match(/(\d{1,2})\s*(?:years?|yrs?)\s*(?:in business|old|running|operating)/i)
  return match ? Number(match[1]) : undefined
}

function inferBusinessName(text: string): string | undefined {
  const match = text.match(/(?:we are|my company is|my business is|our brand is)\s+([A-Z][A-Za-z0-9&.' -]{2,40})/i)
  return match?.[1]?.trim()
}

function inferAvgTicket(text: string): number | undefined {
  const match = text.match(/(?:avg|average|typical)\s*(?:ticket|order value|deal value|deal size|booking value|aov)\s*(?:is|around|about|=)?\s*₹?\s*([\d.,]+)\s*(k|l|lac|lakh|lakhs|cr|crore|crores)?/i)
  return match ? parseInrAmount(match[1], match[2]) : undefined
}

function inferMonthlyRevenue(text: string): number | undefined {
  const match = text.match(/(?:monthly revenue|revenue per month|do|doing|make|made)\s*(?:is|around|about|of)?\s*₹?\s*([\d.,]+)\s*(k|l|lac|lakh|lakhs|cr|crore|crores)?\s*(?:\/?\s*month|a month|monthly)?/i)
  return match ? parseInrAmount(match[1], match[2]) : undefined
}

function inferTechComfort(text: string): 'low' | 'medium' | 'high' | undefined {
  if (/\bvery tech[- ]savvy|comfortable with tools|we automate a lot|engineering team\b/i.test(text)) return 'high'
  if (/\bnot tech[- ]savvy|team struggles with tech|manual only|not comfortable with software\b/i.test(text)) return 'low'
  if (/\buse some tools|somewhat comfortable|okay with software\b/i.test(text)) return 'medium'
  return undefined
}

function inferBudgetSignal(text: string): 'low' | 'medium' | 'high' | undefined {
  if (/\bno budget|very tight budget|tight budget|budget is tight|can't spend|cannot spend|bootstrapped\b/i.test(text)) return 'low'
  if (/\bdepends on roi|if roi is clear|moderate budget\b/i.test(text)) return 'medium'
  if (/\bready to invest|can invest|budget is there|aggressive growth\b/i.test(text)) return 'high'
  return undefined
}

function inferOwnerByStep(text: string): { step: string; owner: string } | null {
  const match = text.match(/(i|founder|owner|sales team|sales manager|front desk|reception|ops team|operations team|counselor|admissions team)\s+(?:handle|handles|own|owns|manage|manages|looks after)\s+([^.!?\n]+)/i)
  if (!match) return null

  const owner = normalizeOwner(match[1])
  const phrase = match[2].trim().toLowerCase()
  const step = phrase.includes('follow') ? 'follow_up'
    : phrase.includes('lead') || phrase.includes('inquir') ? 'lead_response'
    : phrase.includes('book') || phrase.includes('appointment') ? 'booking'
    : phrase.includes('payment') || phrase.includes('checkout') ? 'payment'
    : phrase.includes('deliver') || phrase.includes('fulfillment') ? 'fulfillment'
    : 'operations'

  return { step, owner }
}

function inferStageMetrics(text: string): Record<string, number> {
  const metrics: Record<string, number> = {}

  const responseMatch = text.match(/(?:response time|respond|reply)\s*(?:is|around|about|takes?)?(?:\s+is|\s+around|\s+about)?\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)/i)
  if (responseMatch) {
    const value = Number(responseMatch[1])
    metrics.response_time_minutes = /hour|hr/i.test(responseMatch[2]) ? Math.round(value * 60) : Math.round(value)
  }

  const noShowMatch = text.match(/(?:no[- ]?show rate|no[- ]?shows?)\s*(?:is|are|around|about)?\s*(\d{1,3})\s*%/i)
  if (noShowMatch) metrics.no_show_rate_pct = Number(noShowMatch[1])

  const repeatMatch = text.match(/(?:repeat rate|repeat customers?|repeat purchase rate)\s*(?:is|are|around|about)?\s*(\d{1,3})\s*%/i)
  if (repeatMatch) metrics.repeat_rate_pct = Number(repeatMatch[1])

  const paymentMatch = text.match(/(?:payment completion|checkout completion|payment success)\s*(?:is|are|around|about)?\s*(\d{1,3})\s*%/i)
  if (paymentMatch) metrics.payment_completion_rate_pct = Number(paymentMatch[1])

  const conversionMatch = text.match(/(?:conversion rate|lead to call|lead-to-call|lead to sale|close rate)\s*(?:is|are|around|about)?\s*(\d{1,3})\s*%/i)
  if (conversionMatch) metrics.stage_conversion_pct = Number(conversionMatch[1])

  const weeklyLeadMatch = text.match(/(\d{1,4})\s*(?:leads?|inquiries?|enquiries?)\s*(?:a|per)?\s*week/i)
  if (weeklyLeadMatch) metrics.weekly_leads = Number(weeklyLeadMatch[1])

  return metrics
}

function inferProcessSteps(text: string): string[] {
  const steps: string[] = []
  if (/\binquiry|lead comes in|first message\b/i.test(text)) steps.push('Lead capture')
  if (/\brespond|reply|call back|first touch\b/i.test(text)) steps.push('Lead response')
  if (/\bfollow[- ]?up|nurture\b/i.test(text)) steps.push('Follow-up')
  if (/\bbook|appointment|demo|site visit|consultation\b/i.test(text)) steps.push('Booking')
  if (/\bpayment|checkout|advance|deposit\b/i.test(text)) steps.push('Payment')
  if (/\bdeliver|fulfil|fulfill|service|onboarding\b/i.test(text)) steps.push('Fulfillment')
  return steps
}

function inferBottlenecks(text: string): string[] {
  const bottlenecks: string[] = []
  if (/\bslow response|late response|takes too long to respond\b/i.test(text)) bottlenecks.push('Slow lead response')
  if (/\bno[- ]?show|missed appointment\b/i.test(text)) bottlenecks.push('Appointment no-shows')
  if (/\bfollow[- ]?up.*(manual|weak|poor)|leads? go cold|ghosted\b/i.test(text)) bottlenecks.push('Inconsistent follow-up')
  if (/\bpayment.*drop|abandon(ed)? checkout|failed payments?\b/i.test(text)) bottlenecks.push('Payment drop-off')
  if (/\bmanual|spreadsheet|sheet based|excel\b/i.test(text)) bottlenecks.push('Manual operations')
  return bottlenecks
}

function inferChannelMix(text: string): Record<string, number> {
  const mix: Record<string, number> = {}
  const patterns: Array<{ key: string; regex: RegExp }> = [
    { key: 'whatsapp', regex: /(\d{1,3})\s*%\s*(?:from|via)?\s*whatsapp/i },
    { key: 'instagram', regex: /(\d{1,3})\s*%\s*(?:from|via)?\s*instagram/i },
    { key: 'referrals', regex: /(\d{1,3})\s*%\s*(?:from|via)?\s*referrals?/i },
    { key: 'website', regex: /(\d{1,3})\s*%\s*(?:from|via)?\s*website/i },
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern.regex)
    if (match) mix[pattern.key] = Number(match[1])
  }

  return mix
}

function inferConstraints(text: string): string[] {
  const constraints: string[] = []
  if (/\bsmall team|lean team|understaffed|staff shortage\b/i.test(text)) constraints.push('Small team bandwidth')
  if (/\bbudget is tight|tight budget|no budget\b/i.test(text)) constraints.push('Budget sensitivity')
  if (/\bcompliance|regulation|regulated|privacy\b/i.test(text)) constraints.push('Compliance considerations')
  if (/\bseasonal|seasonality|peak season\b/i.test(text)) constraints.push('Seasonal demand swings')
  if (/\bowner dependent|founder dependent|everything comes to me\b/i.test(text)) constraints.push('Founder bottleneck')
  return constraints
}

function parseInrAmount(rawNumber: string, rawUnit?: string): number {
  const base = Number(rawNumber.replace(/,/g, ''))
  if (!Number.isFinite(base)) return 0

  const unit = (rawUnit || '').toLowerCase()
  if (unit === 'k') return Math.round(base * 1000)
  if (['l', 'lac', 'lakh', 'lakhs'].includes(unit)) return Math.round(base * 100000)
  if (['cr', 'crore', 'crores'].includes(unit)) return Math.round(base * 10000000)
  return Math.round(base)
}

function normalizeOwner(raw: string): string {
  return raw.toLowerCase() === 'i' ? 'founder' : raw.trim().toLowerCase()
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pruneEmptyPatch(patch: Partial<BusinessModel>): void {
  const mutablePatch = patch as any

  if (patch.identity && Object.keys(patch.identity).length === 0) delete mutablePatch.identity
  if (patch.revenue && Object.keys(patch.revenue).length === 1 && patch.revenue.confidence) delete mutablePatch.revenue
  if (patch.workflow) {
    const mutableWorkflow = patch.workflow as any
    if (!patch.workflow.lead_source?.length) delete mutableWorkflow.lead_source
    if (!patch.workflow.process_steps?.length) delete mutableWorkflow.process_steps
    if (!patch.workflow.bottlenecks?.length) delete mutableWorkflow.bottlenecks
    if (Object.keys(patch.workflow).length === 0) delete mutablePatch.workflow
  }
  if (patch.competitors && Object.keys(patch.competitors).length === 2 && !patch.competitors.names?.length && !patch.competitors.xray_findings?.length) {
    delete mutablePatch.competitors
  }
  if (patch.ai_readiness) {
    const mutableReadiness = patch.ai_readiness as any
    if (!patch.ai_readiness.tools?.length) delete mutableReadiness.tools
    if (Object.keys(patch.ai_readiness).length === 0) delete mutablePatch.ai_readiness
  }
  if (patch.channel_mix && Object.keys(patch.channel_mix).length === 0) delete mutablePatch.channel_mix
  if (patch.stage_metrics && Object.keys(patch.stage_metrics).length === 0) delete mutablePatch.stage_metrics
  if (patch.owner_by_step && Object.keys(patch.owner_by_step).length === 0) delete mutablePatch.owner_by_step
  if (patch.constraints && patch.constraints.length === 0) delete mutablePatch.constraints
}
