import { computeEventMetrics } from './metrics'
import type { BusinessEvent } from './normalize'

describe('computeEventMetrics', () => {
  it('computes lead SLA, no-show rate, and payment completion rate', () => {
    const events: BusinessEvent[] = [
      {
        session_id: 's1',
        event_type: 'lead_created',
        entity_id: 'l1',
        occurred_at: '2026-05-01T10:00:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'lead_replied',
        entity_id: 'l1',
        occurred_at: '2026-05-01T10:10:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'lead_created',
        entity_id: 'l2',
        occurred_at: '2026-05-01T10:00:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'lead_replied',
        entity_id: 'l2',
        occurred_at: '2026-05-01T10:30:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'booking_created',
        entity_id: 'b1',
        occurred_at: '2026-05-01T11:00:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'booking_created',
        entity_id: 'b2',
        occurred_at: '2026-05-01T11:00:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'booking_attended',
        entity_id: 'b1',
        occurred_at: '2026-05-01T11:30:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'payment_initiated',
        entity_id: 'p1',
        occurred_at: '2026-05-01T12:00:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'payment_initiated',
        entity_id: 'p2',
        occurred_at: '2026-05-01T12:00:00.000Z',
      },
      {
        session_id: 's1',
        event_type: 'payment_completed',
        entity_id: 'p1',
        occurred_at: '2026-05-01T12:05:00.000Z',
      },
    ]

    const result = computeEventMetrics(events)

    expect(result).toEqual({
      leads: 2,
      response_sla_minutes: 20,
      no_show_rate: 50,
      payment_completion_rate: 50,
    })
  })

  it('returns null metrics when dependent event pairs are absent', () => {
    const events: BusinessEvent[] = [
      {
        session_id: 's1',
        event_type: 'lead_created',
        entity_id: 'l1',
        occurred_at: '2026-05-01T10:00:00.000Z',
      },
    ]

    const result = computeEventMetrics(events)

    expect(result).toEqual({
      leads: 1,
      response_sla_minutes: null,
      no_show_rate: null,
      payment_completion_rate: null,
    })
  })
})

