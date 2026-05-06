import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getBaseUrl } from '@/lib/utils'
import { rateLimit, getIP } from '@/lib/rateLimit'
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

  // Rate limit POST (report generation) - 5 per IP per hour
  if (req.method === 'POST') {
    const ip = getIP(req)
    const { allowed } = await rateLimit(ip, { limit: 5, windowMs: 60 * 60 * 1000 })
    if (!allowed) {
      return res.status(429).json({ error: 'Too many report requests. Please try again later.', code: 'RATE_LIMIT_EXCEEDED' })
    }
  }

  const sessionOrReportId = req.method === 'POST'
    ? ((req.body.report_id as string | undefined) || (req.body.session_id as string | undefined))
    : ((req.query.report_id as string | undefined) || (req.query.session_id as string | undefined))

  if (!sessionOrReportId) {
    return res.status(400).json({ error: 'Missing session_id or report_id', code: 'BAD_REQUEST' })
  }

  try {
    const supabase = getServiceClient()

    // Find the session directly if sessionId is a session UUID, OR indirectly if it's a report UUID
    let actualSessionId = sessionOrReportId
    
    // Check if what we got is actually a report_id
    const { data: maybeReport } = await supabase
      .from('reports')
      .select('session_id')
        .eq('id', sessionOrReportId)
      .maybeSingle()

    if (maybeReport && maybeReport.session_id) {
      actualSessionId = maybeReport.session_id
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('extracted_data, ai_readiness_score, lead_captured')
      .eq('id', actualSessionId)
      .single()

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' })
    }

    if (!session.extracted_data) {
      return res.status(400).json({ error: 'Report not yet generated', code: 'REPORT_NOT_READY' })
    }

    if (!session.lead_captured) {
      return res.status(403).json({ error: 'Lead must be submitted to view the report', code: 'LEAD_REQUIRED' })
    }

    const { data: report } = await supabase
      .from('reports')
      .select('id')
      .eq('session_id', actualSessionId)
      .single()

    const payload = session.extracted_data as ReportPayload

    logger.info('Report fetched', { sessionId: actualSessionId, reportId: report?.id })

    return res.status(200).json({
      report_id: report?.id ?? actualSessionId,
      report_url: `${getBaseUrl()}/report/${report?.id ?? actualSessionId}`,
      payload,
    })
  } catch (err) {
    const error = err as Error
    logger.error('Report fetch failed', { message: error.message })
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
}
