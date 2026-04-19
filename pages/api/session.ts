// ========================================
// diyaa.ai — POST /api/session
// Creates a new discovery session.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { rateLimit, getIP } from '@/lib/rateLimit'
import type { CreateSessionResponse, ApiError } from '@/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateSessionResponse | ApiError>
) {
  // FIX 6 — HTTP Method Guard
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  // FIX 1 — Rate Limiting
  const ip = getIP(req);
  const { allowed } = rateLimit(ip, { limit: 10, windowMs: 60 * 60 * 1000 }); // 10 sessions per IP per hour
  if (!allowed) {
    return res.status(429).json({ error: 'Too many sessions. Please try again later.', code: 'RATE_LIMIT_EXCEEDED' } as any);
  }

  // FIX 5 — Input Validation
  const { vertical, metadata } = req.body;

  if (!vertical || typeof vertical !== 'string' || vertical.length > 100) {
    return res.status(400).json({ error: 'Invalid vertical', code: 'BAD_REQUEST' } as any);
  }

  try {
    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        status: 'active',
        phase: 1,
        vertical,
        metadata,
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
