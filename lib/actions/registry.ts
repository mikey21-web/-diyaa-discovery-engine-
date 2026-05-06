export type ActionId = 'sla_nudge_whatsapp' | 'no_show_reminder_flow' | 'lost_lead_reactivation'

export interface ActionDefinition {
  id: ActionId
  name: string
  description: string
  default_impact_inr: number
}

export const ACTION_REGISTRY: Record<ActionId, ActionDefinition> = {
  sla_nudge_whatsapp: {
    id: 'sla_nudge_whatsapp',
    name: 'Lead SLA Nudge',
    description: 'Send WhatsApp nudges to owners when first response SLA is breached.',
    default_impact_inr: 30000,
  },
  no_show_reminder_flow: {
    id: 'no_show_reminder_flow',
    name: 'No-show Reminder Flow',
    description: 'Send T-24h and T-1h reminders to reduce missed appointments.',
    default_impact_inr: 25000,
  },
  lost_lead_reactivation: {
    id: 'lost_lead_reactivation',
    name: 'Lost Lead Reactivation',
    description: 'Re-engage cold leads with contextual WhatsApp follow-up.',
    default_impact_inr: 40000,
  },
}

