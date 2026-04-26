import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { runAgentTurn } from '@/lib/agent/orchestrator'
import { AnthropicBusyError } from '@/lib/anthropic'
import { logger } from '@/lib/logger'
import type { ChatResponse, ApiError } from '@/lib/types'
import { processDueJobs } from '@/lib/jobs'
import { rateLimit, getIP } from '@/lib/rateLimit'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse | ApiError>
) {
  const requestId = Math.random().toString(36).slice(2, 10)
  const startedAt = Date.now()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const ip = getIP(req)
  const { allowed } = await rateLimit(ip, { limit: 10, windowMs: 60000 })
  if (!allowed) {
    return res.status(429).json({ error: 'Too many messages. Please wait 1 minute.', code: 'RATE_LIMIT_EXCEEDED' })
  }

  const { session_id, message } = req.body as { session_id: string; message: string }

  if (!session_id || typeof session_id !== 'string' || !message || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message or session_id', code: 'BAD_REQUEST' })
  }

  try {
    const supabase = getServiceClient()

    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('status')
      .eq('id', session_id)
      .single()

    if (fetchError || !session) {
      return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' })
    }

    if (session.status === 'report_generated') {
      return res.status(410).json({ error: 'Session complete', code: 'SESSION_CLOSED' })
    }

    const result = await runAgentTurn(session_id, message)

    let reportId: string | undefined
    if (result.report_ready) {
      const { data: report } = await supabase
        .from('reports')
        .select('id')
        .eq('session_id', session_id)
        .single()
      reportId = report?.id
    }

    return res.status(200).json({
      reply: result.reply,
      phase: 1, // v2 uses agent_phase string; legacy field kept for UI compat
      report_ready: result.report_ready,
      report_id: reportId,
    })
  } catch (err) {
    if (err instanceof AnthropicBusyError) {
      return res.status(503).json({ error: 'AI is busy — please try again in a moment.', code: 'UPSTREAM_BUSY' })
    }
    const error = err as Error
    logger.error('Chat error', { msg: error.message, requestId })
    return res.status(500).json({ error: 'Service Unavailable', code: 'INTERNAL_ERROR' })
  } finally {
    processDueJobs(5).catch((err: unknown) => {
      const e = err as Error
      logger.warn('Background job drain failed', { requestId, message: e.message })
    })
    logger.info('Chat completed', { requestId, durationMs: Date.now() - startedAt })
  }
}
