import type { BusinessEvent } from './normalize'

export interface EventMetrics {
  leads: number
  response_sla_minutes: number | null
  no_show_rate: number | null
  payment_completion_rate: number | null
}

export function computeEventMetrics(events: BusinessEvent[]): EventMetrics {
  const leadCreated = events.filter((e) => e.event_type === 'lead_created')
  const leadReplied = events.filter((e) => e.event_type === 'lead_replied')
  const bookingCreated = events.filter((e) => e.event_type === 'booking_created')
  const bookingAttended = events.filter((e) => e.event_type === 'booking_attended')
  const payInit = events.filter((e) => e.event_type === 'payment_initiated')
  const payDone = events.filter((e) => e.event_type === 'payment_completed')

  const responseSla = computeMedianResponseMinutes(leadCreated, leadReplied)
  const noShowRate = bookingCreated.length ? Math.max(0, Math.round(((bookingCreated.length - bookingAttended.length) / bookingCreated.length) * 100)) : null
  const paymentRate = payInit.length ? Math.round((payDone.length / payInit.length) * 100) : null

  return {
    leads: leadCreated.length,
    response_sla_minutes: responseSla,
    no_show_rate: noShowRate,
    payment_completion_rate: paymentRate,
  }
}

function computeMedianResponseMinutes(created: BusinessEvent[], replied: BusinessEvent[]): number | null {
  if (!created.length || !replied.length) return null
  const diffs: number[] = []
  for (const c of created) {
    const r = replied.find((x) => x.entity_id === c.entity_id)
    if (!r) continue
    const d = (new Date(r.occurred_at).getTime() - new Date(c.occurred_at).getTime()) / 60000
    if (Number.isFinite(d) && d >= 0) diffs.push(d)
  }
  if (!diffs.length) return null
  diffs.sort((a, b) => a - b)
  const mid = Math.floor(diffs.length / 2)
  return Math.round(diffs.length % 2 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2)
}

