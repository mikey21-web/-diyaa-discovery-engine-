import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { computeEventMetrics } from '@/lib/events/metrics'
import type { BusinessEvent } from '@/lib/events/normalize'
import type { ActionId } from '@/lib/actions/registry'
import { buildAttributionUpdates, type ActionRunRecord } from '@/lib/events/attribution'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const sessionId = req.query.session_id as string
  if (!sessionId) return res.status(400).json({ error: 'Missing session_id' })
  const supabase = getServiceClient()

  const { data: events } = await supabase
    .from('business_events')
    .select('session_id,event_type,entity_id,occurred_at,value,meta')
    .eq('session_id', sessionId)
    .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  const { data: runs } = await supabase
    .from('action_runs')
    .select('id,action_id,mode,status,expected_impact_inr,attributable_revenue_inr,created_at')
    .eq('session_id', sessionId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  if (!events) return res.status(500).json({ error: 'Failed to load events' })
  if (!runs) return res.status(500).json({ error: 'Failed to load action runs' })

  const typedEvents = events as BusinessEvent[]
  const typedRuns = runs as Array<
    Omit<ActionRunRecord, 'action_id'> & { action_id: ActionId }
  >

  const attributionUpdates = buildAttributionUpdates(typedRuns, typedEvents)
  if (attributionUpdates.length > 0) {
    const updateResults = await Promise.all(
      attributionUpdates.map((update) =>
        supabase
          .from('action_runs')
          .update({
            status: update.status,
            attributable_revenue_inr: update.attributable_revenue_inr,
          })
          .eq('id', update.id)
          .select('id,status,action_id,mode,created_at,attributable_revenue_inr')
          .single()
      )
    )

    const firstUpdateError = updateResults.find((result) => result.error)
    if (firstUpdateError?.error) return res.status(500).json({ error: firstUpdateError.error.message })

    for (const result of updateResults) {
      if (!result.data) continue
      const idx = typedRuns.findIndex((run) => run.id === result.data.id)
      if (idx >= 0) {
        typedRuns[idx] = {
          id: result.data.id,
          action_id: result.data.action_id as ActionId,
          mode: result.data.mode as 'preview' | 'execute',
          status: result.data.status,
          created_at: result.data.created_at,
          attributable_revenue_inr: result.data.attributable_revenue_inr,
        }
      }
    }
  }

  const metrics = computeEventMetrics(typedEvents)
  const recovered = typedRuns
    .filter((r) => r.status === 'attributed')
    .reduce((sum, r) => sum + (r.attributable_revenue_inr || 0), 0)
  const executed = typedRuns.filter((r) => r.mode === 'execute').length

  return res.status(200).json({
    window_days: 7,
    metrics,
    recovered_revenue_inr: recovered,
    actions_executed: executed,
    summary: `This week tracked ${executed} executed actions and ₹${recovered.toLocaleString('en-IN')} in attributed recovery across ${metrics.leads} leads.`,
  })
}
