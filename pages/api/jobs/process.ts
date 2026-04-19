import type { NextApiRequest, NextApiResponse } from 'next'
import { processDueJobs } from '@/lib/jobs'

type JobsProcessResponse = {
  ok: boolean
  processed: number
  failed: number
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JobsProcessResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const configuredSecret = process.env.CRON_SECRET
  const providedSecret = req.headers['x-job-secret']

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { processed, failed } = await processDueJobs(25)
  return res.status(200).json({ ok: true, processed, failed })
}
