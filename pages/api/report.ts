import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getBaseUrl } from '@/lib/utils'
import type { ApiError } from '@/lib/types'
import type { ReportPayload } from '@/lib/agent/types'

interface ReportResponse {
  report_id: string
  report_url: string
  payload: ReportPayload
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReportResponse | ApiError>
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const sessionId =
    req.method === 'POST' ? (req.body.session_id as string) : (req.query.session_id as string)

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id', code: 'BAD_REQUEST' })
  }

  try {
    const supabase = getServiceClient()

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('extracted_data, ai_readiness_score')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' })
    }

    if (!session.extracted_data) {
      return res.status(400).json({ error: 'Report not yet generated', code: 'REPORT_NOT_READY' })
    }

    const { data: report } = await supabase
      .from('reports')
      .select('id')
      .eq('session_id', sessionId)
      .single()

    const payload = session.extracted_data as ReportPayload

    // Increment view count
    // Increment view count (non-critical, fire-and-forget)
    supabase
      .from('reports')
      .update({ view_count: 1 })
      .eq('session_id', sessionId)
      .then(() => null, () => null)

    logger.info('Report fetched', { sessionId, reportId: report?.id })

    return res.status(200).json({
      report_id: report?.id ?? sessionId,
      report_url: `${getBaseUrl()}/report/${sessionId}`,
      payload,
    })
  } catch (err) {
    const error = err as Error
    logger.error('Report fetch failed', { message: error.message })
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
}
