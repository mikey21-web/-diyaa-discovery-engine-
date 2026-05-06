import type { ActionId } from '@/lib/actions/registry'
import type { BusinessEvent } from './normalize'

export interface ActionRunRecord {
  id: string
  action_id: ActionId
  mode: 'preview' | 'execute'
  status: string
  created_at: string
  attributable_revenue_inr: number | null
}

export interface AttributionUpdate {
  id: string
  attributable_revenue_inr: number
  status: 'attributed'
}

export function buildAttributionUpdates(
  runs: ActionRunRecord[],
  events: BusinessEvent[]
): AttributionUpdate[] {
  return runs
    .filter((run) => run.mode === 'execute' && run.status === 'executed_pending_attribution')
    .map((run) => {
      const attributable = calculateActionAttribution(run, events)
      return {
        id: run.id,
        attributable_revenue_inr: attributable,
        status: 'attributed' as const,
      }
    })
    .filter((update) => update.attributable_revenue_inr > 0)
}

function calculateActionAttribution(run: ActionRunRecord, events: BusinessEvent[]): number {
  const runTime = new Date(run.created_at).getTime()
  if (!Number.isFinite(runTime)) return 0

  return events
    .filter((event) => event.event_type === 'payment_completed')
    .filter((event) => {
      const eventTime = new Date(event.occurred_at).getTime()
      if (!Number.isFinite(eventTime) || eventTime < runTime) return false

      const attributedActionId =
        typeof event.meta?.attributed_action_id === 'string'
          ? event.meta.attributed_action_id
          : typeof event.meta?.action_id === 'string'
            ? event.meta.action_id
            : null
      return attributedActionId === run.action_id
    })
    .reduce((sum, event) => sum + (typeof event.value === 'number' ? event.value : 0), 0)
}

