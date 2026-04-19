// ========================================
// diyaa.ai — Industry Benchmarks
// Real data used in reports to show gap
// between founder's state and top performers.
// ========================================

import type { VerticalKey } from './types'

export interface VerticalBenchmark {
  lead_response_time_top?: string
  lead_response_time_average_india?: string
  lead_response_time_gap_multiplier?: string
  whatsapp_inquiry_share?: string
  conversion_rate_without_automation?: string
  conversion_rate_with_automation?: string
  follow_up_attempts_needed?: number
  follow_up_attempts_average_team?: number
  ai_roi_example?: string
  whatsapp_booking_response_target?: string
  whatsapp_booking_response_average?: string
  no_show_reduction_with_whatsapp_reminders?: string
  repeat_guest_rate_top?: string
  upsell_conversion_via_chat?: string
  cart_abandonment_rate_india?: string
  cart_recovery_whatsapp_vs_email?: string
  repeat_customer_rate_with_whatsapp?: string
  support_response_target?: string
  lead_to_call_conversion_average?: string
  lead_to_call_conversion_with_bot?: string
  no_show_rate_without_reminder?: string
  no_show_rate_with_whatsapp_reminder?: string
  order_inquiry_response_target?: string
  repeat_order_rate_with_whatsapp?: string
  review_generation_via_whatsapp?: string
  stat_source: string
}

export const BENCHMARKS: Partial<Record<VerticalKey, VerticalBenchmark>> & { general: VerticalBenchmark } = {
  real_estate: {
    lead_response_time_top: '5 minutes',
    lead_response_time_average_india: '4.2 hours',
    lead_response_time_gap_multiplier: '50x',
    whatsapp_inquiry_share: '60-70% of all property inquiries in India',
    conversion_rate_without_automation: '2-3%',
    conversion_rate_with_automation: '4-6%',
    follow_up_attempts_needed: 7,
    follow_up_attempts_average_team: 2,
    ai_roi_example: 'Developer at 80L avg ticket, 200 leads/month: improving close rate 3% to 6% = 4.8Cr extra revenue/month',
    stat_source: 'Kraya AI 2026, CampaignHQ 2026, RhinoAgents 2025',
  },
  hospitality: {
    whatsapp_booking_response_target: 'under 2 minutes',
    whatsapp_booking_response_average: '2-4 hours',
    no_show_reduction_with_whatsapp_reminders: '25-40%',
    repeat_guest_rate_top: '35%',
    upsell_conversion_via_chat: '15-20%',
    stat_source: 'Hyperleap AI 2026, industry data',
  },

  coaching: {
    lead_to_call_conversion_average: '15-20%',
    lead_to_call_conversion_with_bot: '35-45%',
    no_show_rate_without_reminder: '30-40%',
    no_show_rate_with_whatsapp_reminder: '10-15%',
    stat_source: 'Industry surveys, diyaa.ai client data',
  },
  fnb: {
    order_inquiry_response_target: 'under 3 minutes',
    repeat_order_rate_with_whatsapp: '3x vs email',
    review_generation_via_whatsapp: '40% higher vs email request',
    stat_source: 'Cooby 2024, WhatsApp Business reports',
  },
  healthcare: {
    lead_response_time_top: '10 minutes',
    lead_response_time_average_india: '6 hours',
    no_show_rate_without_reminder: '25-35%',
    no_show_rate_with_whatsapp_reminder: '8-12%',
    stat_source: 'Industry reports 2025',
  },
  logistics: {
    lead_response_time_top: '15 minutes',
    lead_response_time_average_india: '3 hours',
    conversion_rate_without_automation: '5-8%',
    conversion_rate_with_automation: '12-18%',
    stat_source: 'Industry reports 2025',
  },
  retail: {
    cart_abandonment_rate_india: '85% overall',
    cart_recovery_whatsapp_vs_email: 'WhatsApp: 25% vs Email: 4%',
    repeat_customer_rate_with_whatsapp: '2.5x vs no engagement',
    stat_source: 'Statista 2025, RetailNext 2025',
  },
  d2c_fashion: {
    cart_abandonment_rate_india: '90% on mobile',
    cart_recovery_whatsapp_vs_email: 'WhatsApp: 28% conversion vs Email: 3-5%',
    repeat_customer_rate_with_whatsapp: '3x vs email-only',
    support_response_target: 'under 10 minutes on WhatsApp',
    stat_source: 'CampaignHQ 2026, Cooby 2024, Statista 2025',
  },
  education: {
    lead_to_call_conversion_average: '15-20%',
    lead_to_call_conversion_with_bot: '35-45%',
    no_show_rate_without_reminder: '30-40%',
    no_show_rate_with_whatsapp_reminder: '10-15%',
    stat_source: 'Industry surveys 2025',
  },
  manufacturing: {
    lead_response_time_top: '30 minutes',
    lead_response_time_average_india: '8 hours',
    conversion_rate_without_automation: '5-8%',
    conversion_rate_with_automation: '12-18%',
    stat_source: 'General industry data 2025',
  },
  marketing_agency: {
    lead_response_time_top: '5 minutes',
    lead_response_time_average_india: '3 hours',
    conversion_rate_without_automation: '4-6%',
    conversion_rate_with_automation: '10-15%',
    stat_source: 'HubSpot 2025, diyaa.ai client data',
  },
  professional_services: {
    lead_response_time_top: '15 minutes',
    lead_response_time_average_india: '6 hours',
    no_show_rate_without_reminder: '25-35%',
    no_show_rate_with_whatsapp_reminder: '8-12%',
    stat_source: 'Industry reports 2025',
  },
  other: {
    lead_response_time_top: '10 minutes',
    lead_response_time_average_india: '5 hours',
    conversion_rate_without_automation: '3-5%',
    conversion_rate_with_automation: '8-12%',
    stat_source: 'General industry data 2025',
  },
  tech_startup: {
    lead_response_time_top: 'Real-time',
    lead_response_time_average_india: '4-8 hours',
    conversion_rate_without_automation: '1-3%',
    conversion_rate_with_automation: '5-10%',
    whatsapp_inquiry_share: '50% for B2C, 25% for B2B',
    stat_source: 'Startup India Data 2025',
  },
  general: {
    stat_source: 'LinkedIn India 2025, AISensy 2026, Harvard Business Review',
  },
}

export function getBenchmarksForVertical(vertical: VerticalKey): VerticalBenchmark & VerticalBenchmark {
  const verticalData = BENCHMARKS[vertical] || BENCHMARKS.other
  const generalData = BENCHMARKS.general
  return { ...generalData, ...verticalData }
}
