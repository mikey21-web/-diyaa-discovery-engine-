export type BusinessEventType =
  | 'lead_created'
  | 'lead_replied'
  | 'booking_created'
  | 'booking_attended'
  | 'payment_initiated'
  | 'payment_completed'

export const BUSINESS_EVENT_TYPES: ReadonlySet<BusinessEventType> = new Set<BusinessEventType>([
  'lead_created',
  'lead_replied',
  'booking_created',
  'booking_attended',
  'payment_initiated',
  'payment_completed',
])

export interface BusinessEvent {
  session_id: string
  event_type: BusinessEventType
  entity_id: string
  occurred_at: string
  value?: number
  meta?: Record<string, unknown>
}

function isBusinessEventType(value: string): value is BusinessEventType {
  return BUSINESS_EVENT_TYPES.has(value as BusinessEventType)
}

export function normalizeEvent(raw: Record<string, unknown>): BusinessEvent | null {
  const sessionId = String(raw.session_id || '').trim()
  const eventTypeRaw = String(raw.event_type || '').trim()
  const entityId = String(raw.entity_id || '').trim()
  if (!sessionId || !entityId || !eventTypeRaw) return null
  if (!isBusinessEventType(eventTypeRaw)) return null

  const occurredAt = raw.occurred_at ? String(raw.occurred_at) : new Date().toISOString()
  if (!Number.isFinite(new Date(occurredAt).getTime())) return null

  const valueRaw = raw.value
  const value =
    typeof valueRaw === 'number'
      ? valueRaw
      : typeof valueRaw === 'string' && valueRaw.trim() !== '' && Number.isFinite(Number(valueRaw))
        ? Number(valueRaw)
        : undefined

  const metaBase =
    typeof raw.meta === 'object' && raw.meta && !Array.isArray(raw.meta)
      ? (raw.meta as Record<string, unknown>)
      : undefined
  const attributedActionIdRaw = raw.attributed_action_id ?? raw.action_id
  const attributedActionId =
    typeof attributedActionIdRaw === 'string' && attributedActionIdRaw.trim() !== ''
      ? attributedActionIdRaw.trim()
      : undefined
  const meta = attributedActionId
    ? { ...(metaBase ?? {}), attributed_action_id: attributedActionId }
    : metaBase

  return {
    session_id: sessionId,
    event_type: eventTypeRaw,
    entity_id: entityId,
    occurred_at: occurredAt,
    value,
    meta,
  }
}
