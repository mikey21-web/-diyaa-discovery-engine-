import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { runAgentTurn } from '@/lib/agent/orchestrator'
import { logger } from '@/lib/logger'
import type { ChatResponse, ApiError } from '@/lib/types'
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

    // Attempt to acquire lock for concurrent requests
    const now = new Date()
    const lockThreshold = new Date(now.getTime() - 2 * 60 * 1000).toISOString() // 2 mins ago
    const { data: lockedSession, error: lockError } = await supabase
      .from('sessions')
      .update({ locked_at: now.toISOString() })
      .eq('id', session_id)
      .or(`locked_at.is.null,locked_at.lt.${lockThreshold}`)
      .select('id')
      .single()

    if (lockError || !lockedSession) {
      return res.status(409).json({ error: 'Session is currently processing another request', code: 'CONCURRENT_REQUEST' })
    }

    try {
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

    const phaseMap: Record<string, number> = {
      diagnostic: 1, quantifying: 2, competitor_xray: 3,
      synthesis: 4, sales: 5, complete: 6,
    }

    return res.status(200).json({
      reply: result.reply,
      phase: phaseMap[result.phase] ?? 1,
      report_ready: result.report_ready,
      report_id: reportId,
    })
    } finally {
      // Release the lock
      await supabase
        .from('sessions')
        .update({ locked_at: null })
        .eq('id', session_id)
    }
  } catch (err) {
    const error = err as any
    if (error.status === 429 || error.status === 402 || error.message?.includes('rate limit')) {
      return res.status(503).json({ error: 'AI service is busy — please try again in a moment.', code: 'UPSTREAM_BUSY' })
    }
    if (error.message?.includes('GROQ_API_KEY') || error.message?.includes('API key') || error.message?.includes('not set')) {
      logger.error('Missing API key', { requestId })
      return res.status(500).json({ error: 'Configuration incomplete — GROQ_API_KEY not set. Please add it to .env.local', code: 'CONFIG_ERROR' })
    }
    logger.error('Chat error', { msg: error.message, requestId, status: error.status, stack: (err as any)?.stack })
    return res.status(500).json({ error: error.message || 'Service Unavailable', code: 'INTERNAL_ERROR' })
  } finally {
    logger.info('Chat completed', { requestId, durationMs: Date.now() - startedAt })
  }
}
