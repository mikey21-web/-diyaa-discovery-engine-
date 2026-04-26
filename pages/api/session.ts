// ========================================
// diyaa.ai — POST /api/session
// Creates a new discovery session.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { seedBusinessModel } from '@/lib/agent/businessModel'
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

    const industryMap: Record<string, string> = {
      real_estate: 'real estate',
      hospitality: 'hotel & hospitality',
      fnb: 'restaurant',
      coaching: 'coaching',
      d2c_fashion: 'D2C fashion',
    }

    const industryOpenings: Record<string, string> = {
      real_estate: `Real estate in India moves fast — leads go cold in under an hour if you don't respond. Walk me through what happens the moment a new inquiry hits you.`,
      hospitality: `In hospitality, the biggest revenue drain is usually no-shows and guests who never come back. What's your biggest operational headache right now?`,
      fnb: `FnB lives or dies on repeat customers and table turns. What part of your day-to-day still feels like it's on you personally to manage?`,
      coaching: `Coaches lose 30-40% of booked calls to no-shows — it's the silent killer. How does your current booking and follow-up process work?`,
      d2c_fashion: `D2C fashion — 90% of mobile carts get abandoned before checkout. What's your current recovery process look like when someone drops off?`,
    }

    const OPENING_MESSAGE = industry && industryOpenings[industry]
      ? `Hey, I'm Diyaa from diyaa.ai.\n\n${industryOpenings[industry]}`
      : `Hey, I'm Diyaa from diyaa.ai.\n\nBefore I ask you anything — what's the one part of your business that's costing you the most time or deals right now?`

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

    if (industry) {
      await seedBusinessModel(data.id, industry).catch(() => {})
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
