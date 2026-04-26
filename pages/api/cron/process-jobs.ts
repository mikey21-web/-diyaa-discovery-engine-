// ========================================
// diyaa.ai — Vercel Cron: Process Background Jobs
// Called every 5 minutes via Vercel Crons (vercel.json)
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { processDueJobs } from '@/lib/jobs'
import { logger } from '@/lib/logger'

// Vercel validates cron requests with this header
const CRON_SECRET = process.env.CRON_SECRET

interface CronResponse {
  ok: boolean
  jobsProcessed?: number
  jobsFailed?: number
  message?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronResponse>
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  // Verify cron secret (Vercel provides this in the Authorization header)
  const authHeader = req.headers.authorization
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' })
  }

  try {
    logger.info('Starting cron job processor')
    const result = await processDueJobs(50)
    logger.info('Cron job processor complete', { processed: result.processed, failed: result.failed })

    return res.status(200).json({
      ok: true,
      jobsProcessed: result.processed,
      jobsFailed: result.failed,
      message: `Processed ${result.processed} jobs (${result.failed} failed)`
    })
  } catch (error) {
    const err = error as Error
    logger.error('Cron job processor failed', { message: err.message })
    return res.status(500).json({
      ok: false,
      message: 'Job processing failed'
    })
  }
}
