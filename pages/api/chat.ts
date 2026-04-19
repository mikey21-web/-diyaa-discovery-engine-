// ========================================
// diyaa.ai — POST /api/chat
// Handles one conversation turn.
// Manages history, detects [REPORT_READY].
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { getClaudeResponse } from '@/lib/claude'
import { logger } from '@/lib/logger'
import type { ChatRequest, ChatResponse, ApiError, ConversationMessage } from '@/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse | ApiError>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const { session_id, message } = req.body as ChatRequest

  if (!session_id || !message) {
    return res.status(400).json({ error: 'Missing session_id or message', code: 'BAD_REQUEST' })
  }

  try {
    const supabase = getServiceClient()

    // 1. Fetch existing session — only columns we need
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('conversation_history, phase, status')
      .eq('id', session_id)
      .single()

    if (fetchError || !session) {
      logger.error('Session not found', { sessionId: session_id })
      return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' })
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is no longer active', code: 'SESSION_CLOSED' })
    }

    // 2. Build conversation history for Claude
    const history: ConversationMessage[] = session.conversation_history || []

    // Add the user's new message
    const userMsg: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }
    history.push(userMsg)

    // 3. Call Claude with full history
    const claudeMessages = history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    const claudeResponse = await getClaudeResponse(claudeMessages, session.phase)

    // 4. Add assistant response to history
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: claudeResponse.content,
      timestamp: new Date().toISOString(),
    }
    history.push(assistantMsg)

    // 5. Prepare update payload
    const updatePayload: Record<string, unknown> = {
      conversation_history: history,
      phase: claudeResponse.phase,
      updated_at: new Date().toISOString(),
    }

    let reportId: string | undefined

    // 6. If report ready, atomically lock session + write data in one operation
    if (claudeResponse.reportReady && claudeResponse.extractedData) {
      const { error: lockError } = await supabase
        .from('sessions')
        .update({
          status: 'complete',
          extracted_data: claudeResponse.extractedData,
          ai_readiness_score:
            (claudeResponse.extractedData as Record<string, unknown>).ai_readiness_score || 0,
        })
        .eq('id', session_id)
        .eq('status', 'active') // Optimistic lock — prevents duplicate processing

      if (lockError) {
        logger.warn('Session lock/data write failed — may have been processed already', {
          sessionId: session_id,
        })
      }

      updatePayload.status = 'report_generated'

      // C2: Upsert to prevent duplicate report rows on retry
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .upsert(
          {
            session_id: session_id,
            share_url: `${process.env.NEXT_PUBLIC_APP_URL}/report/${session_id}`,
          },
          { onConflict: 'session_id' }
        )
        .select('id')
        .single()

      if (!reportError && report) {
        reportId = report.id
        logger.info('Report created', { sessionId: session_id, reportId: report.id })
      }
    }

    // 7. Update session in Supabase
    const { error: updateError } = await supabase
      .from('sessions')
      .update(updatePayload)
      .eq('id', session_id)

    if (updateError) {
      logger.error('Failed to update session', { error: updateError.message })
    }

    logger.info('Chat turn completed', {
      sessionId: session_id,
      phase: claudeResponse.phase,
      reportReady: claudeResponse.reportReady,
    })

    return res.status(200).json({
      reply: claudeResponse.content,
      phase: claudeResponse.phase,
      report_ready: claudeResponse.reportReady,
      report_id: reportId,
    })
  } catch (err) {
    const error = err as Error
    logger.error('Chat handler failed', { message: error.message })
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
}
