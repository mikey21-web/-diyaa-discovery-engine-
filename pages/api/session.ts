// ========================================
// diyaa.ai — POST /api/session
// Creates a new discovery session.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { CreateSessionResponse, ApiError } from '@/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateSessionResponse | ApiError>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  try {
    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        status: 'active',
        phase: 1,
        conversation_history: [
          {
            role: 'assistant',
            content: "Hey, I'm Diyaa \u{1F44B}\n\nTell me what you do — and I'll tell you what's broken before you finish explaining.",
            timestamp: new Date().toISOString()
          }
        ],
        extracted_data: null,
        ai_readiness_score: null,
      })
      .select('id, created_at')
      .single()

    if (error) {
      logger.error('Failed to create session', { error: error.message })
      return res.status(500).json({ error: 'Failed to create session', code: 'DB_ERROR' })
    }

    logger.info('Session created', { sessionId: data.id })

    return res.status(201).json({
      session_id: data.id,
      created_at: data.created_at,
      opening_message: "Hey, I'm Diyaa 👋\n\nTell me what you do — and I'll tell you what's broken before you finish explaining.",
    })
  } catch (err) {
    const error = err as Error
    logger.error('Session creation failed', { message: error.message })
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
}
