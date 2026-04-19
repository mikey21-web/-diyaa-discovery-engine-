// ========================================
// diyaa.ai — POST /api/report
// Returns report data for a session.
// ========================================

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServiceClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getBenchmarksForVertical } from '@/lib/benchmarks'
import { getScoreInterpretation } from '@/lib/scoring'
import { getBaseUrl } from '@/lib/utils'
import type { ApiError, ExtractedData, VerticalKey } from '@/lib/types'

interface ReportData {
  report_id: string
  report_url: string
  business_name: string
  industry: string
  extracted_data: ExtractedData
  benchmarks: Record<string, unknown>
  readiness: {
    score: number
    tier: string
    description: string
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReportData | ApiError>
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const sessionId =
    req.method === 'POST' ? req.body.session_id : (req.query.session_id as string)

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id', code: 'BAD_REQUEST' })
  }

  try {
    const supabase = getServiceClient()

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' })
    }

    if (!session.extracted_data) {
      return res.status(400).json({
        error: 'Report not yet generated for this session',
        code: 'REPORT_NOT_READY',
      })
    }

    // Fetch report record
    const { data: report } = await supabase
      .from('reports')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    const extractedData = session.extracted_data as ExtractedData
    const vertical = (extractedData.industry || 'other') as VerticalKey
    const benchmarks = getBenchmarksForVertical(vertical)

    // Build a mock session state for scoring
    const readinessScore = session.ai_readiness_score || extractedData.ai_readiness_score || 0
    const interpretation = getScoreInterpretation(readinessScore)

    logger.info('Report fetched', { sessionId, reportId: report?.id })

    return res.status(200).json({
      report_id: report?.id || sessionId,
      report_url: `${getBaseUrl()}/report/${sessionId}`,
      business_name: extractedData.business_name || extractedData.business || 'Your Business',
      industry: extractedData.industry || 'other',
      extracted_data: extractedData,
      benchmarks: benchmarks as unknown as Record<string, unknown>,
      readiness: {
        score: readinessScore,
        tier: interpretation.tier,
        description: interpretation.description,
      },
    })
  } catch (err) {
    const error = err as Error
    logger.error('Report fetch failed', { message: error.message })
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
}
