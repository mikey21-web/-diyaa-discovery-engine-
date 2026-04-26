import type { Tool } from '@anthropic-ai/sdk/resources/messages'

interface IndustryFact {
  metric: string
  value: string
  context: string
  source: string
}

const INDUSTRY_DATA: Record<string, IndustryFact[]> = {
  real_estate: [
    { metric: 'lead_response_time_top', value: '5 minutes', context: 'Top-performing agents respond within 5 minutes', source: 'Kraya AI 2026' },
    { metric: 'lead_response_time_avg_india', value: '4.2 hours', context: 'Average Indian real estate agent response time', source: 'CampaignHQ 2026' },
    { metric: 'whatsapp_inquiry_share', value: '60-70%', context: 'Share of property inquiries that come via WhatsApp in India', source: 'RhinoAgents 2025' },
    { metric: 'conversion_rate_manual', value: '2-3%', context: 'Lead-to-deal conversion rate without automation', source: 'Industry data' },
    { metric: 'conversion_rate_automated', value: '4-6%', context: 'Lead-to-deal conversion rate with AI follow-up', source: 'Industry data' },
    { metric: 'follow_up_attempts_needed', value: '7', context: 'Average touches needed to close a real estate deal', source: 'Sales research' },
    { metric: 'follow_up_attempts_avg_team', value: '2', context: 'Average attempts most real estate teams actually make', source: 'diyaa.ai client data' },
  ],
  hospitality: [
    { metric: 'whatsapp_response_target', value: 'under 2 minutes', context: 'Top hotels respond to WhatsApp booking inquiries in under 2 minutes', source: 'Hyperleap AI 2026' },
    { metric: 'whatsapp_response_avg', value: '2-4 hours', context: 'Average WhatsApp response time for Indian hotels', source: 'Industry data' },
    { metric: 'no_show_reduction', value: '25-40%', context: 'No-show rate reduction with automated WhatsApp reminders', source: 'Hyperleap AI 2026' },
    { metric: 'upsell_via_chat', value: '15-20%', context: 'Upsell conversion rate via automated in-stay WhatsApp messages', source: 'Industry data' },
    { metric: 'repeat_guest_rate_top', value: '35%', context: 'Top-performing boutique hotels achieve 35% repeat guest rate', source: 'Industry data' },
  ],
  fashion_d2c: [
    { metric: 'cart_abandonment_india_mobile', value: '90%', context: 'Cart abandonment rate on mobile in India', source: 'Statista 2025' },
    { metric: 'whatsapp_cart_recovery', value: '28%', context: 'Cart recovery conversion via WhatsApp message', source: 'CampaignHQ 2026' },
    { metric: 'email_cart_recovery', value: '3-5%', context: 'Cart recovery conversion via email', source: 'Cooby 2024' },
    { metric: 'repeat_purchase_whatsapp', value: '3x vs email', context: 'Repeat purchase rate for WhatsApp-engaged customers vs email-only', source: 'CampaignHQ 2026' },
  ],
  coaching: [
    { metric: 'lead_to_call_manual', value: '15-20%', context: 'Lead-to-discovery-call rate without automation', source: 'Industry surveys' },
    { metric: 'lead_to_call_automated', value: '35-45%', context: 'Lead-to-discovery-call rate with AI follow-up bot', source: 'diyaa.ai client data' },
    { metric: 'no_show_without_reminder', value: '30-40%', context: 'No-show rate for coaching discovery calls without reminders', source: 'Industry data' },
    { metric: 'no_show_with_whatsapp', value: '10-15%', context: 'No-show rate with WhatsApp reminder sequence', source: 'diyaa.ai client data' },
  ],
  fnb: [
    { metric: 'order_response_target', value: 'under 3 minutes', context: 'Industry standard response time for F&B WhatsApp orders', source: 'WhatsApp Business reports' },
    { metric: 'review_via_whatsapp', value: '40% higher', context: 'Review generation rate via WhatsApp vs email request', source: 'Cooby 2024' },
    { metric: 'repeat_order_whatsapp', value: '3x vs email', context: 'Repeat order rate for WhatsApp-engaged F&B customers', source: 'Cooby 2024' },
  ],
  logistics: [
    { metric: 'delivery_status_inquiries', value: '35% of support volume', context: 'Share of support tickets that are just delivery status inquiries', source: 'Industry data' },
    { metric: 'whatsapp_tracking_satisfaction', value: '89%', context: 'Customer satisfaction rate with WhatsApp delivery updates', source: 'Industry data' },
  ],
  healthcare: [
    { metric: 'appointment_no_show', value: '20-30%', context: 'No-show rate for medical appointments without reminders', source: 'Healthcare industry data' },
    { metric: 'no_show_with_whatsapp', value: '8-12%', context: 'No-show rate with WhatsApp reminder + confirmation flow', source: 'diyaa.ai client data' },
    { metric: 'refill_reminder_conversion', value: '60%', context: 'Patient compliance rate with automated prescription refill reminders', source: 'Healthcare research' },
  ],
  retail: [
    { metric: 'inventory_stockout_cost', value: '4-8% of revenue', context: 'Revenue lost annually to stockouts in Indian retail', source: 'Industry data' },
    { metric: 'whatsapp_offer_open_rate', value: '98%', context: 'WhatsApp message open rate vs 21-25% for email', source: 'AISensy 2026' },
  ],
  general: [
    { metric: 'whatsapp_open_rate', value: '98%', context: 'WhatsApp message open rate', source: 'AISensy 2026' },
    { metric: 'email_open_rate', value: '21-25%', context: 'Email open rate in India', source: 'Industry benchmark' },
    { metric: 'response_5min_lift', value: '9x higher conversion', context: 'Lead conversion when responded to within 5 minutes vs 30+ minutes', source: 'Harvard Business Review' },
    { metric: 'india_smb_ai_planning', value: '95.6%', context: 'Indian SMBs investing in or planning AI adoption', source: 'LinkedIn India 2025' },
    { metric: 'india_smb_whatsapp', value: '78%', context: 'Indian SMBs using WhatsApp for business', source: 'Industry data' },
  ],
}

export function lookupIndustryFact(industry: string, metric: string): IndustryFact | null {
  const key = normalizeIndustry(industry)
  const facts = INDUSTRY_DATA[key] ?? INDUSTRY_DATA.general
  return facts.find(f => f.metric === metric) ?? null
}

export function listIndustryFacts(industry: string): IndustryFact[] {
  const key = normalizeIndustry(industry)
  const specific = INDUSTRY_DATA[key] ?? []
  return [...specific, ...INDUSTRY_DATA.general]
}

function normalizeIndustry(raw: string): string {
  const map: Record<string, string> = {
    'real estate': 'real_estate',
    realestate: 'real_estate',
    property: 'real_estate',
    hotel: 'hospitality',
    hotels: 'hospitality',
    restaurant: 'fnb',
    food: 'fnb',
    'f&b': 'fnb',
    fashion: 'fashion_d2c',
    ecommerce: 'fashion_d2c',
    clothing: 'fashion_d2c',
    coaching: 'coaching',
    education: 'coaching',
    consulting: 'coaching',
    healthcare: 'healthcare',
    clinic: 'healthcare',
    logistics: 'logistics',
    retail: 'retail',
  }
  const lower = raw.toLowerCase()
  return map[lower] ?? lower.replace(/\s+/g, '_')
}

export const industryDataToolSchema: Tool = {
  name: 'industry_data',
  description:
    'Look up real benchmark data for a specific industry vertical. Use to inject credible statistics into the conversation when making comparisons or quantifying gaps.',
  input_schema: {
    type: 'object' as const,
    properties: {
      industry: {
        type: 'string',
        description: 'Industry vertical (e.g. "real estate", "hospitality", "coaching", "fnb", "healthcare", "retail")',
      },
      metric: {
        type: 'string',
        description: 'Specific metric to look up, or "all" to get all facts for this industry',
      },
    },
    required: ['industry', 'metric'],
  },
}
