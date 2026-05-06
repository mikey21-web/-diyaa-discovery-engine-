// ========================================
// diyaa.ai — POST /api/session
// Creates a new discovery session.
// Updated: 2026-04-27 for Vercel redeploy
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { seedBusinessModel } from '@/lib/agent/businessModel'
import { rateLimit, getIP } from '@/lib/rateLimit'
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

  // Rate limit: 10 new sessions per IP per hour
  const ip = getIP(req)
  const { allowed } = await rateLimit(ip, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (!allowed) {
    return res.status(429).json({ error: 'Too many sessions. Please try again later.', code: 'RATE_LIMIT_EXCEEDED' })
  }

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
      real_estate: `I'm Diyaa, a revenue consultant at diyaa.ai. In real estate, response speed often decides who closes the deal. Walk me through what happens the moment a new inquiry hits your team.`,
      hospitality: `I'm Diyaa, a revenue consultant at diyaa.ai. In hospitality, no-shows and slow confirmations can quietly hurt margins. What does your booking confirmation process look like right now?`,
      fnb: `I'm Diyaa, a revenue consultant at diyaa.ai. In F&B, repeat orders usually decide long-term growth. What does your current repeat-customer process look like today?`,
      coaching: `I'm Diyaa, a revenue consultant at diyaa.ai. In coaching, no-shows and slow follow-up can break conversion. How does a new lead move from first message to paid session in your business?`,
      d2c_fashion: `I'm Diyaa, a revenue consultant at diyaa.ai. In D2C fashion, drop-offs often happen between cart and checkout. What is your current process when someone abandons cart?`,
    }

    const OPENING_MESSAGE = industry && industryOpenings[industry]
      ? industryOpenings[industry]
      : `I'm Diyaa, a revenue consultant at diyaa.ai. What's the one part of your business that costs you the most time or deals right now — getting customers, serving them, or keeping them?`

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
