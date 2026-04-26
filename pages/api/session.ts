// ========================================
// diyaa.ai — POST /api/session
// Creates a new discovery session.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
// import { rateLimit, getIP } from '@/lib/rateLimit'
import type { CreateSessionResponse, ApiError } from '@/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateSessionResponse | ApiError>
) {
  const requestId = Math.random().toString(36).slice(2, 10)
  const startedAt = Date.now()

  // FIX 6 — HTTP Method Guard
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  // Session rate limit disabled for now - remove if you want to enable
  // const ip = getIP(req)
  // const { allowed } = await rateLimit(ip, { limit: 60, windowMs: 60 * 60 * 1000 })
  // if (!allowed) {
  //   return res.status(429).json({ error: 'Too many sessions. Please try again later.', code: 'RATE_LIMIT_EXCEEDED' })
  // }

  try {
    const supabase = getServiceClient()
    logger.info('Session init started', { requestId, hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL, hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY })
    const { industry } = req.body || {}

    // Map industry key to a human-readable term if provided
    const industryMap: Record<string, string> = {
      real_estate: 'real estate',
      hospitality: 'hotel & hospitality',
      fnb: 'restaurant',
      coaching: 'coaching',
      d2c_fashion: 'D2C fashion',
    }

    const industryMention = industry && industryMap[industry] ? ` your ${industryMap[industry]} ` : ' your '

    const OPENING_MESSAGE = `Hey there 👋 I'm Diyaa from diyaa.ai. In the next 10 minutes, I'll show you exactly where AI can save${industryMention}business time, money, and lost revenue. Let's start with your operations — tell me a bit about how you currently interact with your customers today?`

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        status: 'active',
        conversation_history: [
          ...(industry ? [{ role: 'system', content: `Context: The user came from the ${industryMap[industry] || industry} landing page.`, timestamp: new Date().toISOString() }] : []),
          {
            role: 'assistant',
            content: OPENING_MESSAGE,
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .select('id, created_at')
      .single()

    if (error) {
      logger.error('Failed to create session', { error: error.message, code: error.code, details: (error as any).details })
      return res.status(500).json({ error: `Failed to create session: ${error.message}`, code: 'DB_ERROR' })
    }

    logger.info('Session created', { sessionId: data.id, requestId })

    return res.status(201).json({
      session_id: data.id,
      created_at: data.created_at,
      opening_message: OPENING_MESSAGE,
    })
  } catch (err) {
    const error = err as Error
    logger.error('Session creation failed', { message: error.message, requestId })
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  } finally {
    logger.info('Session request completed', { requestId, durationMs: Date.now() - startedAt })
  }
}
