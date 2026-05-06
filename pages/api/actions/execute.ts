import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { ACTION_REGISTRY, type ActionId } from '@/lib/actions/registry'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { session_id, action_id, mode } = req.body as {
    session_id: string
    action_id: ActionId
    mode?: 'preview' | 'execute'
  }
  if (!session_id || !action_id) return res.status(400).json({ error: 'Missing session_id/action_id' })
  if (mode && mode !== 'preview' && mode !== 'execute') return res.status(400).json({ error: 'Invalid mode' })
  const action = ACTION_REGISTRY[action_id]
  if (!action) return res.status(400).json({ error: 'Unknown action' })

  const runMode = mode || 'preview'
  const status = runMode === 'execute' ? 'executed_pending_attribution' : 'preview'
  const supabase = getServiceClient()
  const executeSecret = process.env.ACTION_EXECUTE_SECRET
  if (runMode === 'execute' && executeSecret) {
    const providedSecret = req.headers['x-action-secret']
    const origin = String(req.headers.origin || '')
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || ''
    const trustedSameOrigin = allowedOrigin && origin.startsWith(allowedOrigin)
    if (providedSecret !== executeSecret && !trustedSameOrigin) {
      return res.status(401).json({ error: 'Unauthorized action execution request' })
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id,status,lead_captured')
    .eq('id', session_id)
    .single()

  if (sessionError || !session) return res.status(404).json({ error: 'Session not found' })
  if (!session.lead_captured) return res.status(403).json({ error: 'Lead capture required before action execution' })
  if (!['complete', 'report_generated'].includes(session.status)) {
    return res.status(409).json({ error: 'Session not ready for action execution' })
  }

  const { data, error } = await supabase
    .from('action_runs')
    .insert({
      session_id,
      action_id,
      mode: runMode,
      status,
      expected_impact_inr: action.default_impact_inr,
      attributable_revenue_inr: 0,
      created_at: new Date().toISOString(),
    })
    .select('id, status, expected_impact_inr, attributable_revenue_inr')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ action, run: data })
}
