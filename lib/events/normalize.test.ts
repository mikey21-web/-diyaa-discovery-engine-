import { normalizeEvent } from './normalize'

describe('normalizeEvent', () => {
  it('normalizes a valid event payload', () => {
    const normalized = normalizeEvent({
      session_id: 'session-1',
      event_type: 'lead_created',
      entity_id: 'lead-100',
      occurred_at: '2026-05-01T10:00:00.000Z',
      value: '1200',
      meta: { channel: 'whatsapp' },
    })

    expect(normalized).toEqual({
      session_id: 'session-1',
      event_type: 'lead_created',
      entity_id: 'lead-100',
      occurred_at: '2026-05-01T10:00:00.000Z',
      value: 1200,
      meta: { channel: 'whatsapp' },
    })
  })

  it('rejects payload with unsupported event type', () => {
    const normalized = normalizeEvent({
      session_id: 'session-1',
      event_type: 'unknown_event',
      entity_id: 'lead-100',
      occurred_at: '2026-05-01T10:00:00.000Z',
    })

    expect(normalized).toBeNull()
  })

  it('rejects payload with missing required fields or invalid occurred_at', () => {
    expect(
      normalizeEvent({
        session_id: 'session-1',
        event_type: 'lead_created',
        occurred_at: '2026-05-01T10:00:00.000Z',
      })
    ).toBeNull()

    expect(
      normalizeEvent({
        session_id: 'session-1',
        event_type: 'lead_created',
        entity_id: 'lead-100',
        occurred_at: 'not-a-date',
      })
    ).toBeNull()
  })

  it('maps root action attribution fields into meta for deterministic ROI attribution', () => {
    const normalized = normalizeEvent({
      session_id: 'session-2',
      event_type: 'payment_completed',
      entity_id: 'pay-1',
      occurred_at: '2026-05-01T10:00:00.000Z',
      value: 5000,
      attributed_action_id: 'sla_nudge_whatsapp',
    })

    expect(normalized?.meta).toEqual({
      attributed_action_id: 'sla_nudge_whatsapp',
    })
  })
})

