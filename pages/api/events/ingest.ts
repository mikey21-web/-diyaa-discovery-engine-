import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { normalizeEvent } from '@/lib/events/normalize'
import { logger } from '@/lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (secret) {
    const headerSecret = req.headers['x-events-secret']
    if (headerSecret !== secret) {
      logger.warn('Events ingest rejected: invalid secret')
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const payload = Array.isArray(req.body?.events) ? req.body.events : [req.body]
  if (payload.length > 500) return res.status(413).json({ error: 'Too many events in one request' })

  const normalized: Array<ReturnType<typeof normalizeEvent>> = []
  for (const item of payload as unknown[]) {
    if (typeof item !== 'object' || !item) continue
    normalized.push(normalizeEvent(item as Record<string, unknown>))
  }
  const validEvents = normalized.filter(
    (event): event is NonNullable<ReturnType<typeof normalizeEvent>> => event !== null
  )

  if (!validEvents.length) return res.status(400).json({ error: 'No valid events found' })
  const supabase = getServiceClient()
  const { error } = await supabase.from('business_events').insert(validEvents)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ inserted: validEvents.length })
}
