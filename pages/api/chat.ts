// ========================================
// diyaa.ai — POST /api/chat
// Handles one conversation turn.
// Manages history, detects [REPORT_READY].
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { getClaudeResponse, UpstreamBusyError } from '@/lib/claude'
import { logger } from '@/lib/logger'
import type { ChatRequest, ChatResponse, ApiError, ConversationMessage } from '@/lib/types'
import { compactConversationHistory } from '@/lib/chatContext'
import { processDueJobs } from '@/lib/jobs'

import { rateLimit, getIP } from '@/lib/rateLimit'
import { getBaseUrl } from '@/lib/utils'

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

  const { session_id, message } = req.body as ChatRequest

  if (!session_id || typeof session_id !== 'string' || !message || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message or session_id', code: 'BAD_REQUEST' })
  }

  try {
    const supabase = getServiceClient()

    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('conversation_history, phase, status')
      .eq('id', session_id)
      .single()

    if (fetchError || !session) {
      return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' })
    }

    if (session.status !== 'active') {
      return res.status(410).json({ error: 'Session expired/complete', code: 'SESSION_CLOSED' })
    }

    const history: ConversationMessage[] = session.conversation_history || []
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    })

    const claudeMessages = compactConversationHistory(history)

    const claudeResponse = await getClaudeResponse(claudeMessages, session.phase)

    history.push({
      role: 'assistant',
      content: claudeResponse.content,
      timestamp: new Date().toISOString(),
    })

    let reportId: string | undefined

    // ATOMIC PREPARATION
    const isReportReady = Boolean(claudeResponse.reportReady && claudeResponse.extractedData)
    const finalStatus = isReportReady ? 'report_generated' : 'active'

    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        conversation_history: history,
        phase: claudeResponse.phase,
        status: finalStatus,
        extracted_data: isReportReady ? claudeResponse.extractedData : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', session_id)
      .eq('status', 'active'); // ATOMIC LOCK

    if (updateError) {
      throw new Error('Atomic update failed - likely race condition');
    }

    if (isReportReady) {
      const { data: report } = await supabase
        .from('reports')
        .upsert({
          session_id: session_id,
          share_url: `${getBaseUrl()}/report/${session_id}`,
        }, { onConflict: 'session_id' })
        .select('id')
        .single()
      
      reportId = report?.id
    }

    return res.status(200).json({
      reply: claudeResponse.content,
      phase: claudeResponse.phase,
      report_ready: isReportReady,
      report_id: reportId,
    })
  } catch (err) {
    if (err instanceof UpstreamBusyError) {
      return res.status(503).json({ error: err.message, code: 'UPSTREAM_BUSY' })
    }

    const error = err as Error
    logger.error('Chat error', { msg: error.message, requestId })
    return res.status(500).json({ error: 'Service Unavailable', code: 'INTERNAL_ERROR' })
  } finally {
    processDueJobs(5).catch((err: unknown) => {
      const error = err as Error
      logger.warn('Background job drain failed from chat', { requestId, message: error.message })
    })
    logger.info('Chat request completed', { requestId, durationMs: Date.now() - startedAt })
  }
}
